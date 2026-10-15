import { getDb } from '../db/local';

/**
 * Stats layer — computed entirely from SQL against the LOCAL rounds table.
 * Never stored separately; always derived, so they're correct after any sync
 * (rows may originate from local gameplay or were pulled from Supabase —
 * both live in the same local table).
 */

export const statsService = {
  /** COUNT of completed rounds for a user (total activities). */
  async getTotalActivities(userId: string): Promise<number> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ c: number }>(
      'SELECT COUNT(*) AS c FROM rounds WHERE user_id = ? AND completed = 1',
      userId
    );
    return row?.c ?? 0;
  },

  /** AVG(accuracy) over the last `days` days (rolling). */
  async getRollingAccuracy(userId: string, days = 7): Promise<number> {
    const db = await getDb();
    const since = new Date();
    since.setDate(since.getDate() - days);
    const row = await db.getFirstAsync<{ a: number | null }>(
      'SELECT AVG(accuracy) AS a FROM rounds WHERE user_id = ? AND timestamp >= ? AND accuracy IS NOT NULL',
      userId, since.toISOString()
    );
    return row?.a ?? 0;
  },

  /**
   * Consecutive calendar days with at least one completed round, ending today
   * or yesterday (don't break the streak if today has no rounds yet but
   * yesterday did).
   */
  async getStreak(userId: string): Promise<number> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ day: string }>(
      `SELECT DISTINCT date(timestamp) AS day FROM rounds
       WHERE user_id = ? AND completed = 1
       ORDER BY day DESC`,
      userId
    );

    if (rows.length === 0) return 0;

    // Build a Set of "YYYY-MM-DD" strings.
    const days = new Set(rows.map((r) => r.day));

    // Start from today; if today is empty, start from yesterday (grace).
    const today = new Date();
    const start = new Date(today);
    if (!days.has(toKey(start))) {
      start.setDate(start.getDate() - 1);
      if (!days.has(toKey(start))) return 0;
    }

    let streak = 0;
    const cursor = new Date(start);
    while (days.has(toKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  },
};

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}