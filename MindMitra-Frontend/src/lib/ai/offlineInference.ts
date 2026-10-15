import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { initLlama, type LlamaContext } from 'llama.rn';
import { getShortWindow, getAllRoundsForUser } from '../../db/local';
import type { LocalRound } from '../../db/local';

/**
 * Offline game recommendation (spec §5.1, §5.3, §9).
 *
 * Data source: db/local (canonical local SQLite rounds table, spec §6.2).
 * Input window : short window = last 1-4 rounds FOR THE RELEVANT GAME.
 * Model       : trained Qwen GGUF via llama.rn (is_model_asset).
 * Output      : { recommended_game_id, recommended_difficulty_value, reason_code }
 *               — exact schema from spec §5.2.
 * Fallback    : deterministic rule from spec §5.3 (with domain-overlap graph
 *               routing + least-recently-played tie-break) so the app works
 *               even when the GGUF asset isn't available.
 */

const MODEL_FILENAME = 'mindmitra_qwen_q4_k_m.gguf';
const MODEL_ASSET_BASEPATH = `models/${MODEL_FILENAME}`;

// Game key <-> frontend UUID.
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

// Per-game difficulty bounds (Easy=lower, Hard=upper) from spec §3.
const GAME_BOUNDS: Record<string, { lower: number; upper: number }> = {
  match2: { lower: 6, upper: 15 },
  sequence: { lower: 3, upper: 12 },
  meet_and_greet: { lower: 3, upper: 12 },
  monument_memory: { lower: 3, upper: 12 },
  sort_match: { lower: 2, upper: 12 },
  triple_stack: { lower: 8, upper: 12 },
  missing_objects: { lower: 1, upper: 5 },
};

// Domain overlap graph (spec §3) for cross-game routing.
const DOMAIN_OVERLAP: Record<string, string[]> = {
  match2: ['sequence', 'meet_and_greet', 'monument_memory', 'missing_objects', 'triple_stack'],
  sequence: ['match2', 'meet_and_greet', 'monument_memory'],
  meet_and_greet: ['sequence', 'match2', 'monument_memory', 'sort_match'],
  monument_memory: ['sequence', 'match2', 'meet_and_greet'],
  missing_objects: ['match2', 'triple_stack'],
  triple_stack: ['match2', 'missing_objects'],
  sort_match: ['meet_and_greet'],
};

let ctxPromise: Promise<LlamaContext> | null = null;
let ctxFailed = false;

async function getModelPath(): Promise<string> {
  if (Platform.OS === 'android') {
    const destPath = `${RNFS.DocumentDirectoryPath}/${MODEL_FILENAME}`;
    const exists = await RNFS.exists(destPath);
    if (!exists) {
      console.log('Copying model from assets to documents...');
      await RNFS.copyFileAssets(MODEL_ASSET_BASEPATH, destPath);
    }
    return destPath;
  }
  return MODEL_ASSET_BASEPATH;
}

function initContext(): Promise<LlamaContext> {
  if (ctxPromise) return ctxPromise;
  if (ctxFailed) return Promise.reject(new Error('model unavailable'));
  ctxPromise = (async () => {
    const modelPath = await getModelPath();
    const ctx = await initLlama({
      model: modelPath,
      is_model_asset: Platform.OS === 'ios',
      n_ctx: 2048,
      n_batch: 256,
      n_threads: 2,
      n_gpu_layers: 0, // CPU-only (mobile-safe)
    });
    return ctx;
  })().catch((e) => {
    ctxFailed = true;
    ctxPromise = null;
    throw e;
  });
  return ctxPromise;
}

function num(r: LocalRound, key: keyof LocalRound): number {
  const v = r[key];
  return typeof v === 'number' && isFinite(v) ? v : 0;
}

/** Most recent difficulty value used for this game (for +/- adjustments). */
function currentDifficulty(rounds: LocalRound[]): number {
  const last = rounds[rounds.length - 1];
  const v = last?.difficulty_value;
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object') {
    const first = Object.values(v as Record<string, unknown>)[0];
    if (typeof first === 'number') return first;
  }
  return 6;
}

function isMaxed(gameKey: string, value: number): boolean {
  const b = GAME_BOUNDS[gameKey];
  return (b && value >= b.upper) || !b;
}

/**
 * Spec §5.3 decision rule over the short window (last 1-4 rounds for the
 * relevant game), with the domain-overlap graph + least-recently-played
 * tie-break for cross-game routing.
 */
function ruleBasedRecommendation(
  rounds: LocalRound[],
  gameKey: string,
  allRounds: LocalRound[]
) {
  if (!rounds || rounds.length === 0) {
    return { status: 'cold_start', reason_code: 'gathering_data' };
  }

  const totalAttempts = rounds.reduce((s, r) => s + num(r, 'total_attempts'), 0);
  const correct = rounds.reduce((s, r) => s + num(r, 'correct_count'), 0);
  const acc = totalAttempts > 0 ? correct / totalAttempts : 0;

  const recallErrors =
    rounds.reduce((s, r) => {
      const et = r.error_types;
      if (Array.isArray(et)) {
        const heavy = et.filter((e) => e === 'recall_failure' || e === 'wrong_pair' || e === 'wrong_answer');
        return s + heavy.length;
      }
      return s;
    }, 0) >= 2;

  const last = rounds[rounds.length - 1];
  const timeTaken = num(last, 'time_taken_sec');
  const expected = num(last, 'expected_time_sec') || 60;
  const val = currentDifficulty(rounds);
  const bounds = GAME_BOUNDS[gameKey] ?? { lower: 3, upper: 12 };
  const gid = PYTHON_KEY_TO_GAME_ID[gameKey] ?? PYTHON_KEY_TO_GAME_ID.match2!;

  if (acc >= 0.85 && (timeTaken === 0 || timeTaken <= expected * 1.5)) {
    if (isMaxed(gameKey, val)) {
      // Maxed out in this game → recommend next game in the same domain,
      // tie-broken by least-recently-played.
      const candidates = (DOMAIN_OVERLAP[gameKey] ?? [])
        .map((k) => ({ k, lastTs: lastPlayedTs(allRounds, k) }))
        .sort((a, b) => a.lastTs - b.lastTs); // least-recently-played first
      const nextKey = candidates[0]?.k ?? 'match2';
      return {
        status: 'offline',
        reason_code: 'recommend_new_game_maxed',
        recommended_game_uuid: PYTHON_KEY_TO_GAME_ID[nextKey] ?? gid,
        recommended_difficulty_value: (GAME_BOUNDS[nextKey] ?? bounds).lower,
      };
    }
    return {
      status: 'offline',
      reason_code: 'recommend_harder',
      recommended_game_uuid: gid,
      recommended_difficulty_value: Math.min(bounds.upper, val + 2),
    };
  }
  if (acc < 0.5 || recallErrors) {
    return {
      status: 'offline',
      reason_code: 'recommend_easier',
      recommended_game_uuid: gid,
      recommended_difficulty_value: Math.max(bounds.lower, val - 2),
    };
  }
  return {
    status: 'offline',
    reason_code: 'recommend_hold',
    recommended_game_uuid: gid,
    recommended_difficulty_value: val,
  };
}

function lastPlayedTs(allRounds: LocalRound[], gameKey: string): number {
  const gid = PYTHON_KEY_TO_GAME_ID[gameKey];
  const matches = allRounds
    .map((r) => ({ gid: r.game_id, ts: new Date(String(r.timestamp ?? '')).getTime() }))
    .filter((x) => x.gid === gid);
  if (matches.length === 0) return 0; // never played → play first
  return Math.max(...matches.map((m) => m.ts));
}

function buildPrompt(rounds: LocalRound[], userId: string, gameKey: string): string {
  // Short window ONLY: last 1-4 rounds for the relevant game (spec §5.1).
  const window = rounds.slice(-4).map((r) => {
    const gkey = GAME_ID_TO_PYTHON_KEY[String(r.game_id)] ?? String(r.game_id);
    const src = r.difficulty_source === 'ai_recommended' ? 'ai_recommended' : 'user_selected_preset';
    const et = Array.isArray(r.error_types) ? r.error_types.join(',') : '';
    return `g=${gkey} src=${src} v=${JSON.stringify(r.difficulty_value)} t=${num(r, 'time_taken_sec')} exp=${num(r, 'expected_time_sec')} att=${num(r, 'total_attempts')} cor=${num(r, 'correct_count')} err=${num(r, 'error_count')} et=[${et}] done=${r.completed ? 1 : 0} acc=${r.accuracy ?? ''}`;
  }).join('\n');

  return `You are MindMitra's difficulty recommender (memory-care app, spec §5).
Given the SHORT WINDOW (last 1-4 rounds) for game "${gameKey}" of user ${userId}, output ONLY valid JSON with exactly these keys:
{"reason_code": string, "recommended_game_id": string, "recommended_difficulty_value": number}

reason_code ∈ {"recommend_harder","recommend_easier","recommend_hold","recommend_new_game_maxed","recommend_new_game_plateaued"}
recommended_game_id ∈ {${Object.keys(PYTHON_KEY_TO_GAME_ID).join(',')}}
recommended_difficulty_value within bounds for that game — harder +2, easier -2, hold same.

Rules (spec §5.3): harder if accuracy>=0.85 AND time<=expected; if already maxed pick next game in the same domain (via overlap graph); easier if accuracy<0.5 OR recall errors >= 2; else hold.

Rounds:
${window}`;
}

/**
 * Get an offline game recommendation. Returns the spec §5.2 shape, with
 * status "offline" (or "cold_start").
 */
export async function getOfflineRecommendation(
  userId: string,
  gameId: string,
  screeningLevel?: string | null
): Promise<{
  status: string;
  reason_code: string;
  recommended_game_uuid?: string;
  recommended_difficulty_value?: number | Record<string, number>;
}> {
  // Primary offline store: the SQLite rounds table (spec §6.2). Fall back to
  // Canonical source: db/local short window for this game (spec §5.1).
  // Canonical source: db/local short window for this game (spec §5.1).
  let gameRounds: LocalRound[] = [];
  try {
    gameRounds = await getShortWindow(userId, gameId, 4);
  } catch (e) {
    gameRounds = [];
  }
  const mine = await getAllRoundsForUser(userId);

  const gameKey = GAME_ID_TO_PYTHON_KEY[gameId] ?? 'match2';

  if (gameRounds.length === 0) {
    // Cold-start for this game: default to the screening-assigned level
    // (spec §5.1 / §5.4). Map "easy"|"medium"|"hard" to the game's presets.
    const gid = PYTHON_KEY_TO_GAME_ID[gameKey];
    const preset = screeningLevel ? String(screeningLevel).toLowerCase() : '';
    const bounds = GAME_BOUNDS[gameKey] ?? { lower: 3, upper: 12 };
    const levelVal =
      preset === 'hard'
        ? bounds.upper
        : preset === 'medium'
        ? Math.round((bounds.lower + bounds.upper) / 2)
        : bounds.lower;
    return {
      status: 'cold_start',
      reason_code: 'screening_level',
      recommended_game_uuid: gid,
      recommended_difficulty_value: levelVal,
    };
  }

  let ctx;
  try {
    ctx = await initContext();
  } catch (e) {
    console.warn('Offline LLM init failed:', e);
    return ruleBasedRecommendation(gameRounds, gameKey, mine);
  }

  try {
    const sysPrompt = 'You are MindMitra\'s difficulty recommender.';
    const userPrompt = buildPrompt(gameRounds, userId, gameKey);
    // Qwen uses ChatML formatting. Build it manually to avoid getFormattedChat exceptions.
    const finalPrompt = `<|im_start|>system\n${sysPrompt}<|im_end|>\n<|im_start|>user\n${userPrompt}<|im_end|>\n<|im_start|>assistant\n`;

    const result = await ctx.completion({
      prompt: finalPrompt,
      n_predict: 120,
      temperature: 0.2,
      stop: ['<|im_end|>', '<|endoftext|>'],
    });

    const text = result.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const recGameKey = String(parsed.recommended_game_id ?? gameKey);
      const gid = PYTHON_KEY_TO_GAME_ID[recGameKey];
      if (gid && Object.keys(PYTHON_KEY_TO_GAME_ID).includes(recGameKey)) {
        return {
          status: 'offline',
          reason_code: String(parsed.reason_code ?? 'recommend_hold'),
          recommended_game_uuid: gid,
          recommended_difficulty_value:
            typeof parsed.recommended_difficulty_value === 'number'
              ? parsed.recommended_difficulty_value
              : parsed.recommended_difficulty_value,
        };
      }
    }
  } catch (e) {
    console.warn('Offline LLM completion failed:', e);
  }

  return ruleBasedRecommendation(gameRounds, gameKey, mine);
}