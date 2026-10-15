import { supabase } from '../lib/supabaseClient';
import type { Database } from '../types/database';

/**
 * Supabase client for the sync/recommendation layers.
 * Reuses the app's existing configured client (URL + anon key from
 * EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local).
 *
 * Verified schema (from generated types / live REST):
 *  - rounds:  round_id, user_id, game_id, timestamp, difficulty_source,
 *             difficulty_value (Insert accepts Json), time_taken_sec,
 *             expected_time_sec, total_attempts, correct_count, error_count,
 *             error_types (Json), completed, accuracy, synced (boolean, EXISTS)
 *  - reports: report_id, user_id, generated_at, window_start, window_end,
 *             opening_id, trend_id, strength_id, weakness_id, suggestion_id,
 *             slots (Json)  — NO `synced` column
 *  - patients: id (=auth uid), name, preferred_language, screening_assigned_level, ...
 */
export const supabaseClient = supabase;

export type DatabaseSchema = Database;

export { supabase };