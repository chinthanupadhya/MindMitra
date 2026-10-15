import * as SQLite from 'expo-sqlite';

/**
 * Local SQLite database — mirrors the ACTUAL Supabase schema for `rounds`
 * and `reports` (verified from the generated types), plus a small `patients`
 * cache for the current user's metadata (preferred_language,
 * screening_assigned_level).
 *
 * Differences from Supabase (intentional, local-only):
 *   - `reports.synced`  (0/1) — does NOT exist in Supabase; kept local.
 *   - `rounds.synced`   EXISTS in Supabase (boolean) — mirrored 1:1.
 *   - JSON-typed columns (`difficulty_value`, `error_types`, `slots`) are
 *     stored as TEXT (JSON.stringify) in SQLite; `difficulty_value` and
 *     `error_types` are sent to Supabase as their real JSON values.
 */

const DB_NAME = 'mindmitra.db';
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
PRAGMA journal_mode = 'wal';

CREATE TABLE IF NOT EXISTS rounds (
  round_id TEXT PRIMARY KEY NOT NULL,          -- uuid (device-generated)
  user_id TEXT NOT NULL,                       -- FK -> patients.id
  game_id TEXT NOT NULL,                       -- FK -> games.id
  timestamp TEXT NOT NULL,                     -- ISO timestamptz
  difficulty_source TEXT NOT NULL,             -- enum: ai_recommended | user_selected_preset
  difficulty_value TEXT NOT NULL,              -- JSON-stringified (depends on Supabase type)
  time_taken_sec REAL,
  expected_time_sec REAL,
  total_attempts INTEGER,
  correct_count INTEGER,
  error_count INTEGER,
  error_types TEXT,                            -- JSON-stringified array
  completed INTEGER NOT NULL DEFAULT 0,        -- 0/1
  accuracy REAL,
  synced INTEGER NOT NULL DEFAULT 0            -- 0/1 (also in Supabase)
);
CREATE INDEX IF NOT EXISTS idx_rounds_user_ts ON rounds(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_rounds_user_game_ts ON rounds(user_id, game_id, timestamp);

CREATE TABLE IF NOT EXISTS reports (
  report_id TEXT PRIMARY KEY NOT NULL,         -- uuid
  user_id TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  opening_id TEXT NOT NULL,
  trend_id TEXT NOT NULL,
  strength_id TEXT NOT NULL,
  weakness_id TEXT NOT NULL,
  suggestion_id TEXT NOT NULL,
  slots TEXT NOT NULL,                         -- JSON-stringified object
  synced INTEGER NOT NULL DEFAULT 0            -- LOCAL ONLY (not in Supabase)
);
CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_id);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  preferred_language TEXT,
  screening_assigned_level TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY NOT NULL,
  patient_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reminder_type TEXT,
  scheduled_time TEXT,
  repeat_pattern TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  synced INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_reminders_patient ON reminders(patient_id);
`);
}

// Types ---------------------------------------------------------------

export type LocalRound = {
  round_id: string;
  user_id: string;
  game_id: string;
  timestamp: string;
  difficulty_source: 'ai_recommended' | 'user_selected_preset';
  difficulty_value: unknown; // JSON-stringified in storage, JSON value in memory
  time_taken_sec: number | null;
  expected_time_sec: number | null;
  total_attempts: number;
  correct_count: number;
  error_count: number;
  error_types: string[];
  completed: boolean;
  accuracy: number | null;
  synced: boolean;
};

export type LocalReport = {
  report_id: string;
  user_id: string;
  generated_at: string;
  window_start: string;
  window_end: string;
  opening_id: string;
  trend_id: string;
  strength_id: string;
  weakness_id: string;
  suggestion_id: string;
  slots: Record<string, unknown>;
  synced: boolean;
};

export type LocalPatient = {
  id: string;
  name: string;
  preferred_language: string | null;
  screening_assigned_level: string | null;
  updated_at: string | null;
};

// Rounds ---------------------------------------------------------------

export async function insertRound(r: {
  round_id: string;
  user_id: string;
  game_id: string;
  timestamp: string;
  difficulty_source: string;
  difficulty_value: unknown;
  time_taken_sec?: number | null;
  expected_time_sec?: number | null;
  total_attempts?: number;
  correct_count?: number;
  error_count?: number;
  error_types?: unknown[] | string[];
  completed?: boolean;
  accuracy?: number | null;
  synced?: boolean;
}): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO rounds
      (round_id, user_id, game_id, timestamp, difficulty_source, difficulty_value,
       time_taken_sec, expected_time_sec, total_attempts, correct_count, error_count,
       error_types, completed, accuracy, synced)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    r.round_id, r.user_id, r.game_id, r.timestamp, r.difficulty_source,
    JSON.stringify(r.difficulty_value ?? null),
    r.time_taken_sec ?? null, r.expected_time_sec ?? null,
    r.total_attempts ?? 0, r.correct_count ?? 0, r.error_count ?? 0,
    JSON.stringify(Array.isArray(r.error_types) ? r.error_types : []),
    r.completed ? 1 : 0, r.accuracy ?? null, r.synced ? 1 : 0
  );
}

function mapRoundRow(r: any): LocalRound {
  let difficulty_value: unknown = null;
  try { difficulty_value = JSON.parse(r.difficulty_value); } catch { difficulty_value = r.difficulty_value; }
  let error_types: string[] = [];
  try { error_types = JSON.parse(r.error_types || '[]'); } catch { error_types = []; }
  return {
    round_id: r.round_id, user_id: r.user_id, game_id: r.game_id, timestamp: r.timestamp,
    difficulty_source: r.difficulty_source === 'ai_recommended' ? 'ai_recommended' : 'user_selected_preset',
    difficulty_value,
    time_taken_sec: r.time_taken_sec, expected_time_sec: r.expected_time_sec,
    total_attempts: r.total_attempts, correct_count: r.correct_count, error_count: r.error_count,
    error_types, completed: !!r.completed, accuracy: r.accuracy, synced: !!r.synced,
  };
}

/** Short window: last `limit` (1-4) rounds for the relevant game, ordered by timestamp. */
export async function getShortWindow(userId: string, gameId: string, limit = 4): Promise<LocalRound[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM rounds WHERE user_id = ? AND game_id = ? ORDER BY timestamp ASC`,
    userId, gameId
  );
  return rows.slice(-limit).map(mapRoundRow);
}

/** Long window: last `limit` (10-14) rounds across all games, capped at `maxDays`. */
export async function getLongWindow(userId: string, limit = 14, maxDays = 30): Promise<LocalRound[]> {
  const db = await getDb();
  const since = new Date();
  since.setDate(since.getDate() - maxDays);
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM rounds WHERE user_id = ? AND timestamp >= ? ORDER BY timestamp ASC`,
    userId, since.toISOString()
  );
  return rows.slice(-limit).map(mapRoundRow);
}

export async function getUnsyncedRounds(): Promise<LocalRound[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM rounds WHERE synced = 0');
  return rows.map(mapRoundRow);
}

/** All local rounds for a user (no window cap) — for tie-break/overlap logic. */
export async function getAllRoundsForUser(userId: string): Promise<LocalRound[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM rounds WHERE user_id = ? ORDER BY timestamp ASC',
    userId
  );
  return rows.map(mapRoundRow);
}

/** All local rounds (no user filter) for tools like getRecentRounds. */
export async function getAllRounds(limit = 200): Promise<LocalRound[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    'SELECT * FROM rounds ORDER BY timestamp DESC LIMIT ?',
    limit
  );
  return rows.map(mapRoundRow);
}

export async function markRoundsSynced(roundIds: string[], synced = true): Promise<void> {
  if (roundIds.length === 0) return;
  const db = await getDb();
  const placeholders = roundIds.map(() => '?').join(',');
  await db.runAsync(`UPDATE rounds SET synced = ? WHERE round_id IN (${placeholders})`, synced ? 1 : 0, ...roundIds);
}

export async function countRounds(userId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM rounds WHERE user_id = ?', userId);
  return row?.c ?? 0;
}

// Reports ---------------------------------------------------------------

export async function insertReport(r: {
  report_id?: string;
  user_id: string;
  generated_at: string;
  window_start: string;
  window_end: string;
  opening_id: string;
  trend_id: string;
  strength_id: string;
  weakness_id: string;
  suggestion_id: string;
  slots?: Record<string, unknown>;
  synced?: boolean;
}): Promise<void> {
  const db = await getDb();
  const rid = r.report_id ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const m = Math.random() * 16 | 0; const v = c === 'x' ? m : (m & 0x3 | 0x8); return v.toString(16);
  });
  await db.runAsync(
    `INSERT OR REPLACE INTO reports
      (report_id, user_id, generated_at, window_start, window_end, opening_id, trend_id,
       strength_id, weakness_id, suggestion_id, slots, synced)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    rid, r.user_id, r.generated_at, r.window_start, r.window_end,
    r.opening_id, r.trend_id, r.strength_id, r.weakness_id, r.suggestion_id,
    JSON.stringify(r.slots ?? {}), r.synced ? 1 : 0
  );
}

function mapReportRow(r: any): LocalReport {
  let slots: Record<string, unknown> = {};
  try { slots = JSON.parse(r.slots || '{}'); } catch { slots = {}; }
  return {
    report_id: r.report_id, user_id: r.user_id, generated_at: r.generated_at,
    window_start: r.window_start, window_end: r.window_end,
    opening_id: r.opening_id, trend_id: r.trend_id, strength_id: r.strength_id,
    weakness_id: r.weakness_id, suggestion_id: r.suggestion_id,
    slots, synced: !!r.synced,
  };
}

export async function getReports(userId: string): Promise<LocalReport[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM reports WHERE user_id = ? ORDER BY generated_at DESC', userId);
  return rows.map(mapReportRow);
}

export async function getUnsyncedReports(): Promise<LocalReport[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM reports WHERE synced = 0');
  return rows.map(mapReportRow);
}

export async function markReportsSynced(reportIds: string[], synced = true): Promise<void> {
  if (reportIds.length === 0) return;
  const db = await getDb();
  const placeholders = reportIds.map(() => '?').join(',');
  await db.runAsync(`UPDATE reports SET synced = ? WHERE report_id IN (${placeholders})`, synced ? 1 : 0, ...reportIds);
}

// Patients cache ----------------------------------------------------------

export async function upsertPatientLocal(p: {
  id: string; name: string; preferred_language?: string | null;
  screening_assigned_level?: string | null; updated_at?: string | null;
}): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO patients (id, name, preferred_language, screening_assigned_level, updated_at)
     VALUES (?,?,?,?,?)`,
    p.id, p.name, p.preferred_language ?? null, p.screening_assigned_level ?? null, p.updated_at ?? null
  );
}

export async function getPatientLocal(id: string): Promise<LocalPatient | null> {
  const db = await getDb();
  const r = await db.getFirstAsync<any>('SELECT * FROM patients WHERE id = ?', id);
  if (!r) return null;
  return {
    id: r.id, name: r.name, preferred_language: r.preferred_language,
    screening_assigned_level: r.screening_assigned_level, updated_at: r.updated_at,
  };
}

export async function getPatientsLocal(): Promise<LocalPatient[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM patients ORDER BY name ASC');
  return rows.map((r) => ({
    id: r.id, name: r.name, preferred_language: r.preferred_language,
    screening_assigned_level: r.screening_assigned_level, updated_at: r.updated_at,
  }));
}

// Reminders ---------------------------------------------------------------

export type LocalReminder = {
  id: string;
  patient_id: string;
  title: string;
  description: string | null;
  reminder_type: string | null;
  scheduled_time: string | null;
  repeat_pattern: string | null;
  is_active: boolean;
  synced: boolean;
};

export async function upsertReminderLocal(r: {
  id: string; patient_id: string; title: string;
  description?: string | null; reminder_type?: string | null;
  scheduled_time?: string | null; repeat_pattern?: string | null;
  is_active?: boolean; synced?: boolean;
}): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO reminders
      (id, patient_id, title, description, reminder_type, scheduled_time, repeat_pattern, is_active, synced)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    r.id, r.patient_id, r.title, r.description ?? null, r.reminder_type ?? null,
    r.scheduled_time ?? null, r.repeat_pattern ?? null, r.is_active === false ? 0 : 1, r.synced ? 1 : 0
  );
}

export async function getUnsyncedReminders(): Promise<LocalReminder[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM reminders WHERE synced = 0');
  return rows.map((r) => ({
    id: r.id, patient_id: r.patient_id, title: r.title, description: r.description,
    reminder_type: r.reminder_type, scheduled_time: r.scheduled_time,
    repeat_pattern: r.repeat_pattern, is_active: !!r.is_active, synced: !!r.synced,
  }));
}

export async function markRemindersSynced(ids: string[], synced = true): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`UPDATE reminders SET synced = ? WHERE id IN (${placeholders})`, synced ? 1 : 0, ...ids);
}