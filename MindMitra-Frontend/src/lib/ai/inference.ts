import { syncService, RoundRecord } from '../syncService';
import { supabase } from '../supabaseClient';
import { getOfflineRecommendation } from './offlineInference';
import { getAllRoundsForUser, getPatientLocal } from '../../db/local';
import { getRecommendation as getCachedRecommendation } from '../../services/recommendationCache';
// import { LlamaContext } from 'llama.rn'; // Will be used for offline mode

import { Platform } from 'react-native';

const CLOUD_API_URL = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/v1' : 'http://127.0.0.1:8000/api/v1');

// ngrok's free tier intercepts browser requests with an interstitial page unless
// this skip-header is sent. fetch() from a mobile app would otherwise get a 404
// HTML page, break the isOnline() health check, and silently fall to offline mode.
const NGROK_SKIP = { 'ngrok-skip-browser-warning': 'true' };

export const GAME_ID_TO_PYTHON_KEY: Record<string, string> = {
  'c2325c82-87aa-47fc-9b08-569b5d135694': 'match2',
  'f6832a47-78fc-49d5-81cc-c2b1418f9d08': 'sequence',
  '2aeaf7c0-cd7d-4095-8518-53b23fdf6223': 'meet_and_greet',
  '65adbc99-6e1f-4e60-aa86-afbde105fd16': 'monument_memory',
  '8b3a79a3-c25a-4430-a821-3566bad38ce7': 'sort_match',
  '9eaaafd6-9272-4bc6-89f1-44c6829b56f7': 'triple_stack',
  'f23f9c95-c873-4c2b-8cda-ff86ad72906c': 'missing_objects',
};

export const PYTHON_KEY_TO_GAME_ID = Object.fromEntries(
  Object.entries(GAME_ID_TO_PYTHON_KEY).map(([k, v]) => [v, k])
);

/**
 * Map every game_id via the UUID -> python-key table. Rows that are already
 * python keys (or unknown) pass through unchanged.
 */
const mapRoundGameIds = (rounds: RoundRecord[]) =>
  rounds.map(r => ({
    ...r,
    game_id: GAME_ID_TO_PYTHON_KEY[r.game_id] || r.game_id,
  }));

/**
 * Basic network check. In production, use expo-network or @react-native-community/netinfo.
 */
async function isOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 2000);
    // The health check is at the root, not /api/v1
    const healthUrl = CLOUD_API_URL.replace('/api/v1', '/');
    const res = await fetch(healthUrl, { signal: controller.signal, headers: NGROK_SKIP });
    clearTimeout(id);
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

export const inferenceEngine = {
  /**
   * Get a game recommendation based on the short window (last 1-4 rounds of the
   * relevant game). Pending local rounds are flushed to Supabase first so the
   * just-played round is always visible the moment the user returns.
   */
  async getGameRecommendation(userId: string, gameId: string) {
    // Make sure any round the user just played is synced before we read.
    await syncService.flush();

    // PRIMARY source of rounds: the canonical local SQLite DB (db/local,
    // spec §6.2). It holds the full history — pulled from Supabase while
    // online PLUS rounds played offline.
    const localRoundRows = await getAllRoundsForUser(userId).catch(() => []);

    // Short window: last 1-4 rounds FOR THIS GAME, ordered by timestamp.
    const gameRounds = localRoundRows
      .filter((r) => String(r.game_id) === gameId)
      .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))
      .slice(-4);

    if (gameRounds.length === 0) {
      return {
        status: 'cold_start',
        recommended_game_uuid: gameId,
        reason_code: 'gathering_data'
      };
    }

    if (await isOnline()) {
      // Cloud Path — send the SAME local window (old+new) to main.py.
      try {
        const pythonGameId = GAME_ID_TO_PYTHON_KEY[gameId] || gameId;
        const mappedRounds = gameRounds.map((r) => ({
          ...r,
          game_id: GAME_ID_TO_PYTHON_KEY[r.game_id] || r.game_id,
        }));

        const response = await fetch(`${CLOUD_API_URL}/recommend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...NGROK_SKIP },
          body: JSON.stringify(mappedRounds),
        });
        const data = await response.json();

        // Translate Python string key back to our internal UUID
        if (data.recommended_game_id && PYTHON_KEY_TO_GAME_ID[data.recommended_game_id]) {
          data.recommended_game_uuid = PYTHON_KEY_TO_GAME_ID[data.recommended_game_id];
        }

        return data;
      } catch (error) {
        console.error('Cloud recommendation failed:', error);
      }
    }

    // Offline Path — use the pre-computed recommendation cache first (instant),
    // which was already refreshed in the background after the last round save.
    // Only falls back to a cold model call if the cache has no entry yet.
    console.log('Using recommendation cache (local GGUF pre-computed)...');
    try {
      // Cold-start needs the screening-assigned level (spec §5.4).
      // IMPORTANT: read from local SQLite patients cache FIRST so this works
      // offline. Only fall back to Supabase if the local row is missing.
      let screening: string | null = null;
      try {
        const localPatient = await getPatientLocal(userId);
        screening = localPatient?.screening_assigned_level ?? null;
      } catch {
        // local DB miss — try Supabase (online only)
      }
      if (screening === null) {
        try {
          const { data: profile } = await supabase
            .from('patients')
            .select('screening_assigned_level')
            .eq('id', userId)
            .maybeSingle();
          screening = profile?.screening_assigned_level ?? null;
        } catch {
          // network offline — leave screening as null, cold-start uses lower bound
        }
      }
      const cached = await getCachedRecommendation(userId, gameId, screening);
      return cached;
    } catch (error) {
      console.error('Offline recommendation failed:', error);
      return {
        status: 'offline_fallback',
        recommended_game_uuid: gameId,
        reason_code: 'recommend_hold',
        recommended_difficulty_value: gameRounds.length > 0 ? gameRounds[gameRounds.length - 1].difficulty_value : null
      };
    }
  },

  /**
   * Generate a structured report based on the long window (last 10-14 rounds).
   */
  async generateReport(userId: string, userName: string, language: string = 'en') {
    // Make sure the round the user just played is in Supabase before we read.
    await syncService.flush();

    const { data: rounds, error } = await supabase
      .from('rounds')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(14);

    if (error || !rounds || rounds.length < 5) {
      return {
        status: 'gathering_data',
        message: 'Fewer than 5 rounds completed.',
        report: null,
      };
    }
    // Supabase returns newest first, reverse for chronological order
    rounds.reverse();

    if (await isOnline()) {
      // Cloud Path
      try {
        const response = await fetch(`${CLOUD_API_URL}/report?user_name=${encodeURIComponent(userName)}&language=${encodeURIComponent(language)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...NGROK_SKIP },
          // game_id must be the python key (e.g. "match2"), not the UUID —
          // main.py's report logic does GAMES[r["game_id"]] and would 500
          // on a raw UUID.
          body: JSON.stringify(mapRoundGameIds(rounds)),
        });
        const data = await response.json();

        // Cache the generated report in Supabase
        if (data.report) {
          await supabase.from('reports').insert({
            user_id: rounds[0].user_id,
            generated_at: new Date().toISOString(),
            window_start: rounds[0].timestamp!,
            window_end: rounds[rounds.length - 1].timestamp!,
            ...data.report
          });
        }

        // Cached report written to Supabase; per spec §7 the payload is
        // template IDs + slots only — the frontend renders the (translated)
        // templates locally, the AI never produces displayed text.
        return data.report;
      } catch (error) {
        console.error('Cloud report generation failed:', error);
      }
    }

    // Offline Path (Fallback to llama.rn)
    console.log('Running local offline report generation via llama.rn...');
    // TODO: Initialize LlamaContext and generate slot JSON locally
    return null;
  }
};