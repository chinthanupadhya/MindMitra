/**
 * RecommendationCache
 * ===================
 * Automatically pre-computes and caches recommendations from the local GGUF
 * after every round is saved to SQLite.
 *
 * Flow:
 *   1. A game screen calls syncService.saveRound() → local SQLite is updated.
 *   2. saveRound() calls notifyRoundSaved(userId, gameId) on this module.
 *   3. This module reads the fresh short window from SQLite and runs
 *      getOfflineRecommendation() in the background (non-blocking).
 *   4. The result is cached in memory under `${userId}:${gameId}`.
 *   5. Next time getRecommendation() is called (from a game screen or
 *      inferenceEngine), the cached value is returned instantly — no model
 *      cold-start delay on the critical UI path.
 *   6. Additionally, a periodic poll re-freshens stale entries so the cache
 *      stays current even when no new round has been saved (e.g. after a
 *      Supabase pull adds historical rows).
 *
 * The cache is NEVER the primary truth source for online users — if the
 * app is online, inferenceEngine still hits the FastAPI /recommend endpoint
 * and ignores the cache.  The cache is the offline fallback's "instant answer".
 */

import { getOfflineRecommendation } from '../lib/ai/offlineInference';
import { getShortWindow, getAllRoundsForUser } from '../db/local';

// ── Types ──────────────────────────────────────────────────────────────────

export type CachedRecommendation = {
  status: string;
  reason_code: string;
  recommended_game_uuid?: string;
  recommended_difficulty_value?: number | Record<string, number>;
  /** ISO timestamp of when this entry was computed. */
  cachedAt: string;
  /** How many rounds were in the window used to produce this entry. */
  windowSize: number;
};

type CacheEntry = {
  value: CachedRecommendation;
  /** true while a background refresh is in-flight for this key. */
  refreshing: boolean;
};

// ── Internal state ─────────────────────────────────────────────────────────

/** userId:gameId → cached recommendation */
const cache = new Map<string, CacheEntry>();

/**
 * Active user IDs we should keep warm (registered via registerUser()).
 * Maps userId → set of gameIds that user has played at least once locally.
 */
const watchedGames = new Map<string, Set<string>>();

/** Milliseconds before a cached entry is considered stale and re-computed. */
const STALE_AFTER_MS = 5 * 60 * 1000; // 5 minutes

/** How often the background poller re-checks stale entries. */
const POLL_INTERVAL_MS = 60 * 1000; // every 60 seconds

let pollerStarted = false;

// ── Key helpers ────────────────────────────────────────────────────────────

function key(userId: string, gameId: string): string {
  return `${userId}:${gameId}`;
}

function isStale(entry: CacheEntry): boolean {
  const age = Date.now() - new Date(entry.value.cachedAt).getTime();
  return age > STALE_AFTER_MS;
}

// ── Background refresh ────────────────────────────────────────────────────

/**
 * Internal: run getOfflineRecommendation for a (userId, gameId) pair and
 * store the result in cache.  Silently swallows errors — the cache just
 * keeps serving the previous value (or nothing) if the model call fails.
 */
async function refreshEntry(
  userId: string,
  gameId: string,
  screeningLevel?: string | null
): Promise<void> {
  const k = key(userId, gameId);
  const existing = cache.get(k);

  // Don't pile up duplicate in-flight refreshes for the same key.
  if (existing?.refreshing) return;

  cache.set(k, { value: existing?.value ?? ({} as CachedRecommendation), refreshing: true });

  try {
    // Read how many rounds are in the short window BEFORE calling the model,
    // so we can record windowSize in the cached entry.
    let windowSize = 0;
    try {
      const win = await getShortWindow(userId, gameId, 4);
      windowSize = win.length;
    } catch {
      // non-fatal
    }

    const rec = await getOfflineRecommendation(userId, gameId, screeningLevel ?? null);

    const newEntry: CacheEntry = {
      value: {
        ...rec,
        cachedAt: new Date().toISOString(),
        windowSize,
      },
      refreshing: false,
    };
    cache.set(k, newEntry);
    console.log(
      `[RecommendationCache] refreshed ${k} → reason=${rec.reason_code} windowSize=${windowSize}`
    );
  } catch (e) {
    // Restore previous entry (un-flag refreshing).
    cache.set(k, { value: existing?.value ?? ({} as CachedRecommendation), refreshing: false });
    console.warn(`[RecommendationCache] refresh failed for ${k}:`, e);
  }
}

// ── Background poller ─────────────────────────────────────────────────────

/**
 * Periodically re-freshen stale cache entries for all watched (userId, gameId)
 * pairs.  Started once on first registerUser() call.
 */
function startPoller(): void {
  if (pollerStarted) return;
  pollerStarted = true;

  void (async () => {
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      try {
        for (const [userId, gameIds] of watchedGames) {
          for (const gameId of gameIds) {
            const k = key(userId, gameId);
            const entry = cache.get(k);
            if (!entry || isStale(entry)) {
              // Fire in background — don't await so we refresh all games in
              // parallel instead of sequentially.
              void refreshEntry(userId, gameId);
            }
          }
        }
      } catch (e) {
        // Keep polling even if one iteration fails.
      }
    }
  })();
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Register a user so the cache knows which (userId, gameId) pairs to keep
 * warm.  Call this once at app start (e.g. in AuthContext after login).
 * Also auto-discovers which games the user has already played from SQLite.
 */
export async function registerUser(
  userId: string,
  screeningLevel?: string | null
): Promise<void> {
  if (!watchedGames.has(userId)) {
    watchedGames.set(userId, new Set());
  }

  startPoller();

  // Discover games already played locally → prime the cache immediately.
  try {
    const allRounds = await getAllRoundsForUser(userId);
    const gameIds = [...new Set(allRounds.map((r) => r.game_id))];
    const watched = watchedGames.get(userId)!;
    for (const gameId of gameIds) {
      watched.add(gameId);
      const k = key(userId, gameId);
      if (!cache.has(k)) {
        // Kick off first-time refresh in background.
        void refreshEntry(userId, gameId, screeningLevel);
      }
    }
  } catch (e) {
    console.warn('[RecommendationCache] registerUser discovery failed:', e);
  }
}

/**
 * Notify the cache that a new round was just saved to SQLite for a given
 * (userId, gameId).  This triggers an immediate background model re-run so
 * the recommendation is up-to-date before the user opens the next game.
 *
 * Call this from syncService.saveRound() right after the SQLite write.
 */
export function notifyRoundSaved(
  userId: string,
  gameId: string,
  screeningLevel?: string | null
): void {
  // Register this game as watched (covers the first-ever round for a user).
  if (!watchedGames.has(userId)) {
    watchedGames.set(userId, new Set());
    startPoller();
  }
  watchedGames.get(userId)!.add(gameId);

  // Fire the refresh in background — non-blocking so saveRound() returns fast.
  void refreshEntry(userId, gameId, screeningLevel);
}

/**
 * Get the cached recommendation for a (userId, gameId) pair.
 * Returns null if no cached entry exists yet (still computing first result).
 *
 * This is instant — no model call on the critical path.
 */
export function getCachedRecommendation(
  userId: string,
  gameId: string
): CachedRecommendation | null {
  const entry = cache.get(key(userId, gameId));
  // Return the value even if it's currently being refreshed (serve stale while revalidating).
  if (!entry || !entry.value?.cachedAt) return null;
  return entry.value;
}

/**
 * Get a recommendation for a (userId, gameId) pair.
 *
 * - Returns cached value instantly if available (even if stale — a background
 *   refresh is already in-flight).
 * - If no cached value exists yet, falls through to getOfflineRecommendation()
 *   synchronously (first-time call for this game).
 *
 * This is the function inferenceEngine should call when offline instead of
 * calling getOfflineRecommendation() directly.
 */
export async function getRecommendation(
  userId: string,
  gameId: string,
  screeningLevel?: string | null
): Promise<CachedRecommendation> {
  const cached = getCachedRecommendation(userId, gameId);
  if (cached) {
    // Kick off a background refresh if stale, but return the cached value now.
    const entry = cache.get(key(userId, gameId))!;
    if (isStale(entry) && !entry.refreshing) {
      void refreshEntry(userId, gameId, screeningLevel);
    }
    return cached;
  }

  // No cache yet — compute synchronously (first call for this game).
  await refreshEntry(userId, gameId, screeningLevel);
  const fresh = getCachedRecommendation(userId, gameId);
  if (fresh) return fresh;

  // Absolute fallback (model unavailable, no cache):
  return {
    status: 'offline_fallback',
    reason_code: 'recommend_hold',
    cachedAt: new Date().toISOString(),
    windowSize: 0,
  };
}

/**
 * Force-invalidate the cache for a specific user/game pair.
 * Useful after a Supabase pull that adds historical rounds.
 */
export function invalidate(userId: string, gameId?: string): void {
  if (gameId) {
    cache.delete(key(userId, gameId));
  } else {
    // Invalidate all entries for this user.
    for (const [userId2, gameIds] of watchedGames) {
      if (userId2 === userId) {
        for (const gid of gameIds) {
          cache.delete(key(userId, gid));
        }
      }
    }
  }
}

/**
 * Debugging: dump the full cache state.
 */
export function dumpCache(): Record<string, CachedRecommendation> {
  const out: Record<string, CachedRecommendation> = {};
  for (const [k, entry] of cache) {
    if (entry.value?.cachedAt) out[k] = entry.value;
  }
  return out;
}
