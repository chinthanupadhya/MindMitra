import { initLlama, type LlamaContext } from 'llama.rn';
import { getShortWindow, getLongWindow, countRounds } from '../db/local';
import { supabase } from '../db/supabase';
import type { LocalRound } from '../db/local';

/**
 * On-device / cloud recommendation engine.
 *
 * OFFLINE: read the short window (last 1-4 rounds for the relevant game) from
 *          local SQLite, format each round with generate.py's round_tokens
 *          shape, run it through llama.rn (bundled GGUF) with the system
 *          prompt base from main.py, and parse the JSON reply.
 * ONLINE : POST the same window to the existing FastAPI /api/v1/recommend.
 *
 * getReport(): long window; <5 rounds -> "gathering_data" without a model
 *              call. Otherwise branch offline (local GGUF, template IDs) /
 *              online (/api/v1/report).
 */

const MODEL_ASSET_BASEPATH = 'models/mindmitra_qwen_q4_k_m.gguf';

// Game key <-> frontend UUID (must match `games` table ids).
const PYTHON_KEY_TO_GAME_ID: Record<string, string> = {
  match2: 'c2325c82-87aa-47fc-9b08-569b5d135694',
  sequence: 'f6832a47-78fc-49d5-81cc-c2b1418f9d08',
  meet_and_greet: '2aeaf7c0-cd7d-4095-8518-53b23fdf6223',
  monument_memory: '65adbc99-6e1f-4e60-aa86-afbde105fd16',
  sort_match: '8b3a79a3-c25a-4430-a821-3566bad38ce7',
  triple_stack: '9eaaafd6-9272-4bc6-89f1-44c6829b56f7',
  missing_objects: 'f23f9c95-c873-4c2b-8cda-ff86ad72906c',
};
const GAME_ID_TO_PYTHON_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(PYTHON_KEY_TO_GAME_ID).map(([k, v]) => [v, k])
);

const CLOUD_API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  'http://127.0.0.1:8000/api/v1';

// Mirror of main.py's NORMALIZATION prompt for structured decision output.
const SYSTEM_PROMPT_BASE = `You are MindMitra's difficulty recommender (memory-care app).
Output ONLY valid JSON with exactly these keys:
{"recommended_game_id": string, "recommended_difficulty_value": number, "reason_code": string}
reason_code from: recommend_harder, recommend_easier, recommend_hold, recommend_new_game_maxed, recommend_new_game_plateaued.
recommended_game_id from: ${Object.keys(PYTHON_KEY_TO_GAME_ID).join(', ')}.
Rules (spec §5.3): harder if accuracy>=0.85 AND time<=expected; if maxed, next game in the same domain (overlap graph); easier if accuracy<0.5 OR recall errors>=2; else hold.`;

// generate.py's round_tokens
function roundTokens(r: LocalRound): string {
  const dv = r.difficulty_value;
  let dvS: string;
  if (dv && typeof dv === 'object') {
    dvS = Object.entries(dv as Record<string, unknown>).map(([k, v]) => `${k}:${v}`).join(';');
  } else { dvS = String(dv ?? ''); }
  return `g=${GAME_ID_TO_PYTHON_KEY[r.game_id] ?? r.game_id} src=${r.difficulty_source} v=${dvS} ` +
    `t=${r.time_taken_sec ?? ''} exp=${r.expected_time_sec ?? ''} ` +
    `att=${r.total_attempts} cor=${r.correct_count} err=${r.error_count} ` +
    `et=[${(r.error_types ?? []).join(',')}] done=${r.completed ? 1 : 0} acc=${r.accuracy ?? ''}`;
}

let ctxPromise: Promise<LlamaContext> | null = null;
let ctxFailed = false;
function initContext(): Promise<LlamaContext> {
  if (ctxPromise) return ctxPromise;
  if (ctxFailed) return Promise.reject(new Error('model unavailable'));
  ctxPromise = (async () => {
    const ctx = await initLlama({
      model: MODEL_ASSET_BASEPATH,
      is_model_asset: true,
      n_ctx: 2048, n_batch: 256, n_threads: 2, n_gpu_layers: 0,
    });
    return ctx;
  })().catch((e) => { ctxFailed = true; ctxPromise = null; throw e; });
  return ctxPromise;
}

async function checkOnline(): Promise<boolean> {
  try {
    const res = await fetch(CLOUD_API_URL.replace('/api/v1', '/'), {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    return res.status === 200;
  } catch (e) { return false; }
}

export type Recommendation = {
  recommended_game_id: string;   // python-key (e.g. "match2")
  recommended_difficulty_value: number | Record<string, number>;
  reason_code: string;
  recommended_game_uuid?: string;
};

export interface ReportResult {
  status: 'success' | 'gathering_data';
  report?: {
    opening_id: string; trend_id: string; strength_id: string;
    weakness_id: string; suggestion_id: string; slots: Record<string, unknown>;
  };
}

const recommendationEngine = {
  /**
   * Get a game recommendation for the short window of the relevant game.
   */
  async getRecommendation(userId: string, gameId: string): Promise<Recommendation | { status: string; reason_code: string }> {
    const window = await getShortWindow(userId, gameId, 4);
    if (window.length === 0) {
      return { status: 'cold_start', reason_code: 'gathering_data' };
    }

    if (await checkOnline()) {
      try {
        const payload = window.map((r) => ({
          game_id: GAME_ID_TO_PYTHON_KEY[r.game_id] ?? r.game_id,
          difficulty_source: r.difficulty_source,
          difficulty_value: r.difficulty_value,
          time_taken_sec: r.time_taken_sec,
          expected_time_sec: r.expected_time_sec,
          total_attempts: r.total_attempts,
          correct_count: r.correct_count,
          error_count: r.error_count,
          error_types: r.error_types,
          completed: r.completed,
          accuracy: r.accuracy,
        }));
        const res = await fetch(`${CLOUD_API_URL}/recommend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        const rec: Recommendation = {
          recommended_game_id: data.recommended_game_id ?? GAME_ID_TO_PYTHON_KEY[gameId],
          recommended_difficulty_value: data.recommended_difficulty_value ?? 6,
          reason_code: data.reason_code ?? 'recommend_hold',
          recommended_game_uuid: PYTHON_KEY_TO_GAME_ID[data.recommended_game_id] ?? gameId,
        };
        return rec;
      } catch (e) {
        console.warn('Cloud recommend failed, falling back to local', e);
      }
    }

    // OFFLINE: local GGUF
    try {
      const ctx = await initContext();
      const prompt = `${SYSTEM_PROMPT_BASE}

Rounds (short window):
${window.map(roundTokens).join('\n')}

Return the JSON now.`;
      const result = await ctx.completion({
        messages: [{ role: 'system', content: prompt }],
        n_predict: 120,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });
      const text = result.text ?? '';
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        const key = String(parsed.recommended_game_id ?? GAME_ID_TO_PYTHON_KEY[gameId]);
        return {
          recommended_game_id: key,
          recommended_difficulty_value: parsed.recommended_difficulty_value ?? 6,
          reason_code: String(parsed.reason_code ?? 'recommend_hold'),
          recommended_game_uuid: PYTHON_KEY_TO_GAME_ID[key] ?? gameId,
        };
      }
    } catch (e) {
      console.warn('Local GGUF recommend failed', e);
    }

    // Fallback: deterministic rule (spec §5.3) from the window.
    return ruleFallback(window, gameId);
  },

  /**
   * Generate a report from the long window. Fewer than 5 total rounds ->
   * "gathering_data" without any model call (matches main.py threshold).
   */
  async getReport(userId: string, userName?: string): Promise<ReportResult> {
    const total = await countRounds(userId);
    if (total < 5) return { status: 'gathering_data' };

    const longWindow = await getLongWindow(userId, 14, 30);
    if (longWindow.length < 5) return { status: 'gathering_data' };

    if (await checkOnline()) {
      try {
        const res = await fetch(`${CLOUD_API_URL}/report?user_name=${encodeURIComponent(userName ?? '')}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
          body: JSON.stringify(longWindow.map((r) => ({
            game_id: GAME_ID_TO_PYTHON_KEY[r.game_id] ?? r.game_id,
            difficulty_source: r.difficulty_source,
            difficulty_value: r.difficulty_value,
            time_taken_sec: r.time_taken_sec,
            total_attempts: r.total_attempts,
            correct_count: r.correct_count,
            error_count: r.error_count,
            error_types: r.error_types,
            completed: r.completed,
            accuracy: r.accuracy,
          }))),
        });
        const data = await res.json();
        if (data.report) return { status: 'success', report: data.report };
      } catch (e) { console.warn('Cloud report failed', e); }
    }

    // Offline: run local GGUF, request template IDs + slots.
    try {
      const ctx = await initContext();
      const prompt = `${SYSTEM_PROMPT_BASE}
Now produce a PROGRESS REPORT from the long window (last 14 rounds, 30-day cap).
Output ONLY JSON: {"opening_id": string, "trend_id": string, "strength_id": string, "weakness_id": string, "suggestion_id": string, "slots": object}
Template IDs like opening_03, trend_07. slots may include name, n, domain, strong_domain, weak_domain, specific_skill, recommended_game.

Rounds:
${longWindow.map(roundTokens).join('\n')}
Return the JSON now.`;
      const result = await ctx.completion({
        messages: [{ role: 'system', content: prompt }],
        n_predict: 200,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });
      const m = (result.text ?? '').match(/\{[\s\S]*\}/);
      if (m) {
        const p = JSON.parse(m[0]);
        return {
          status: 'success',
          report: {
            opening_id: String(p.opening_id ?? 'opening_01'),
            trend_id: String(p.trend_id ?? 'trend_01'),
            strength_id: String(p.strength_id ?? 'strength_01'),
            weakness_id: String(p.weakness_id ?? 'weakness_01'),
            suggestion_id: String(p.suggestion_id ?? 'suggestion_01'),
            slots: p.slots ?? {},
          },
        };
      }
    } catch (e) { console.warn('Local GGUF report failed', e); }

    return { status: 'gathering_data' };
  },
};

function ruleFallback(window: LocalRound[], gameId: string): Recommendation {
  const gameKey = GAME_ID_TO_PYTHON_KEY[gameId] ?? 'match2';
  const totalAtt = window.reduce((s, r) => s + (r.total_attempts || 0), 0);
  const correct = window.reduce((s, r) => s + (r.correct_count || 0), 0);
  const acc = totalAtt > 0 ? correct / totalAtt : 0;
  const last = window[window.length - 1];
  const timeTaken = last.time_taken_sec ?? 0;
  const expected = last.expected_time_sec ?? 60;
  const recallErr = (last.error_types ?? []).filter((e) => ['recall_failure', 'wrong_pair', 'wrong_answer'].includes(e)).length;
  const dv = last.difficulty_value;
  const val = typeof dv === 'number' ? dv : 6;

  let reason = 'recommend_hold';
  let outVal = val;
  if (acc >= 0.85 && timeTaken <= expected) {
    reason = 'recommend_harder'; outVal = Math.min(15, val + 2);
  } else if (acc < 0.5 || recallErr >= 2) {
    reason = 'recommend_easier'; outVal = Math.max(3, val - 2);
  }
  return { recommended_game_id: gameKey, recommended_difficulty_value: outVal, reason_code: reason };
}

// Supabase import kept referenced for diagnostics future use.
void supabase;

export { recommendationEngine };