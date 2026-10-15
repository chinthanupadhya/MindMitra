import { Database } from '../types/database';
import { insertRound, getAllRounds } from '../db/local';
import { syncNow } from '../db/sync';
import { notifyRoundSaved } from '../services/recommendationCache';

export type RoundRecord = Database['public']['Tables']['rounds']['Insert'];

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export type SaveRoundResult = { ok: boolean; error?: string };

// Serializes concurrent sync calls so two callers never double-insert.
let syncInFlight: Promise<number> | null = null;

/**
 * Canonical round-save + sync facade. All game screens call saveRound(), which
 * writes to the local SQLite DB (db/local.ts — the single source of truth,
 * spec §6.2) and then attempts a cloud sync via db/sync.syncNow().
 */
export const syncService = {
  /**
   * Save a round locally (SQLite), then try to push it to Supabase.
   * Offline-safe: the round is persisted regardless of connectivity and is
   * pushed later by syncNow (reconnect / poller / flush).
   */
  async saveRound(roundData: Omit<RoundRecord, 'round_id' | 'synced' | 'timestamp'>): Promise<SaveRoundResult> {
    const newRound: RoundRecord = {
      ...roundData,
      round_id: generateUUID(),
      timestamp: new Date().toISOString(),
      synced: false,
    };

    // 1. Canonical local write (SQLite).
    try {
      await insertRound({
        round_id: String(newRound.round_id),
        user_id: String(newRound.user_id),
        game_id: String(newRound.game_id),
        timestamp: newRound.timestamp ?? new Date().toISOString(),
        difficulty_source: newRound.difficulty_source,
        difficulty_value: newRound.difficulty_value,
        time_taken_sec: newRound.time_taken_sec ?? null,
        expected_time_sec: newRound.expected_time_sec ?? null,
        total_attempts: newRound.total_attempts ?? 0,
        correct_count: newRound.correct_count ?? 0,
        error_count: newRound.error_count ?? 0,
        error_types: Array.isArray(newRound.error_types) ? (newRound.error_types as unknown as string[]) : [],
        completed: newRound.completed ?? false,
        accuracy: newRound.accuracy ?? null,
        synced: false,
      });
    } catch (e) {
      console.warn('SQLite round write failed', e);
    }

    // 2. Notify the recommendation cache so the local GGUF re-runs in the
    //    background immediately after this round lands in SQLite.  This is
    //    non-blocking — saveRound() returns before the model finishes.
    notifyRoundSaved(
      String(newRound.user_id),
      String(newRound.game_id)
    );

    // 3. Fire a sync attempt (online: pushes immediately; offline: no-op).
    await this.syncRounds();

    return { ok: true };
  },

  /**
   * Push unsynced local rounds (and reports) to Supabase. Only touches the
   * cloud when online; marks local rows synced only on success.
   */
  async syncRounds(): Promise<number> {
    if (syncInFlight) return syncInFlight;
    syncInFlight = (async () => {
      try {
        await syncNow(); // push + (no user id → skip pull; fine for a round save)
      } catch (e) {
        console.warn('syncNow failed', e);
      }
      return 0;
    })();
    try {
      return await syncInFlight;
    } finally {
      syncInFlight = null;
    }
  },

  /**
   * Flush any pending local rounds to Supabase. Called before AI queries so
   * the just-played round is visible online.
   */
  async flush(): Promise<number> {
    return this.syncRounds();
  },

  /** Recent rounds for AI context windows (from the canonical local DB). */
  async getRecentRounds(limit: number = 14): Promise<RoundRecord[]> {
    try {
      const rounds = await getAllRounds(limit);
      return rounds as unknown as RoundRecord[];
    } catch (e) {
      console.error('Failed to get recent rounds', e);
      return [];
    }
  },
};