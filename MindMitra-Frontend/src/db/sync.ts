import { supabase } from './supabase';
import type { Database } from '../types/database';
import {
  getUnsyncedRounds, markRoundsSynced,
  getUnsyncedReports, markReportsSynced,
  getReports, insertReport,
  getUnsyncedReminders, markRemindersSynced,
} from './local';

type RoundsRow = Database['public']['Tables']['rounds']['Insert'];
type ReportsRow = Database['public']['Tables']['reports']['Insert'];
type RemindersRow = Database['public']['Tables']['reminders']['Insert'];

async function isOnline(): Promise<boolean> {
  try {
    const healthUrl =
      (process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1').replace('/api/v1', '/');
    const res = await fetch(healthUrl, { headers: { 'ngrok-skip-browser-warning': 'true' } });
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

/**
 * PUSH: upsert unsynced local rounds + reports into their Supabase tables.
 * Converts JSON-stringified fields (difficulty_value, error_types, slots)
 * into their real JSON values for Supabase's jsonb columns.
 * Marks local rows synced ONLY for those that uploaded successfully.
 */
async function pushLocal(): Promise<void> {
  // --- Rounds ---
  const unsyncedRounds = await getUnsyncedRounds();
  const syncedIds: string[] = [];
  for (const r of unsyncedRounds) {
    // difficulty_value/error_types are stored JSON-stringified locally; send as JSON.
    let difficulty_value: unknown = r.difficulty_value;
    if (typeof r.difficulty_value === 'string') {
      try { difficulty_value = JSON.parse(r.difficulty_value); } catch { /* keep */ }
    }
    const row: RoundsRow = {
      round_id: r.round_id, user_id: r.user_id, game_id: r.game_id, timestamp: r.timestamp,
      difficulty_source: r.difficulty_source,
      difficulty_value: difficulty_value as RoundsRow['difficulty_value'],
      time_taken_sec: r.time_taken_sec, expected_time_sec: r.expected_time_sec,
      total_attempts: r.total_attempts, correct_count: r.correct_count, error_count: r.error_count,
      error_types: r.error_types as RoundsRow['error_types'],
      completed: r.completed, accuracy: r.accuracy, synced: true,
    };
    const { error } = await supabase.from('rounds').insert(row);
    if (!error) {
      syncedIds.push(r.round_id);
    } else if (String(error.code ?? '').startsWith('23')) {
      // Duplicate — already uploaded previously; count as synced.
      syncedIds.push(r.round_id);
    } else {
      console.warn('Push round failed:', error.message);
    }
  }
  if (syncedIds.length > 0) await markRoundsSynced(syncedIds, true);

  // --- Reports ---
  const unsyncedReports = await getUnsyncedReports();
  const syncedReportIds: string[] = [];
  for (const rp of unsyncedReports) {
    const row: ReportsRow = {
      report_id: rp.report_id, user_id: rp.user_id, generated_at: rp.generated_at,
      window_start: rp.window_start, window_end: rp.window_end,
      opening_id: rp.opening_id, trend_id: rp.trend_id, strength_id: rp.strength_id,
      weakness_id: rp.weakness_id, suggestion_id: rp.suggestion_id,
      slots: rp.slots as ReportsRow['slots'],
    };
    const { error } = await supabase.from('reports').insert(row);
    if (!error) syncedReportIds.push(rp.report_id);
    else if (String(error.code ?? '').startsWith('23')) syncedReportIds.push(rp.report_id);
    else console.warn('Push report failed:', error.message);
  }
  if (syncedReportIds.length > 0) await markReportsSynced(syncedReportIds, true);

  // --- Reminders ---
  const unsyncedReminders = await getUnsyncedReminders();
  const syncedReminderIds: string[] = [];
  for (const rm of unsyncedReminders) {
    const row: RemindersRow = {
      id: rm.id, patient_id: rm.patient_id, title: rm.title,
      description: rm.description ?? undefined,
      reminder_type: (rm.reminder_type || undefined) as RemindersRow['reminder_type'],
      scheduled_time: (rm.scheduled_time ?? undefined) as RemindersRow['scheduled_time'],
      repeat_pattern: (rm.repeat_pattern ?? undefined) as RemindersRow['repeat_pattern'],
      is_active: rm.is_active,
    };
    const { error } = await supabase.from('reminders').insert(row);
    if (!error) syncedReminderIds.push(rm.id);
    else if (String(error.code ?? '').startsWith('23')) syncedReminderIds.push(rm.id);
    else console.warn('Push reminder failed:', error.message);
  }
  if (syncedReminderIds.length > 0) await markRemindersSynced(syncedReminderIds, true);
}

/**
 * PULL: query Supabase for reports belonging to the current user not yet
 * present locally (covers reports generated server-side via the online
 * /report endpoint) and insert them into local SQLite with synced=1.
 * Rounds are created locally first — we never pull rounds back down.
 */
async function pullServerReports(userId: string): Promise<void> {
  const local = await getReports(userId);
  const localIds = new Set(local.map((r) => r.report_id));

  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.warn('Pull reports failed:', error.message);
    return;
  }
  for (const r of data ?? []) {
    if (localIds.has(r.report_id)) continue;
    await insertReport({
      report_id: r.report_id, user_id: r.user_id, generated_at: r.generated_at,
      window_start: r.window_start, window_end: r.window_end,
      opening_id: r.opening_id, trend_id: r.trend_id, strength_id: r.strength_id,
      weakness_id: r.weakness_id, suggestion_id: r.suggestion_id,
      slots: (r.slots as Record<string, unknown>) ?? {}, synced: true,
    });
  }
}

/**
 * Full sync, triggered on reconnect (or app start):
 *   1. push unsynced local rounds + reports -> Supabase
 *   2. pull server-generated reports for this user -> local (synced=1)
 */
export async function syncNow(userId?: string): Promise<void> {
  if (!(await isOnline())) return;
  await pushLocal();
  if (userId) await pullServerReports(userId);
}