import { syncNow } from './sync';

/**
 * Reconnect sync trigger.
 *
 * @react-native-community/netinfo isn't installed in this project, so we use
 * a lightweight poller: every few seconds check the backend health endpoint;
 * the instant connectivity returns (offline -> online), run syncNow().
 * (Swap in `@react-native-community/netinfo`'s addEventListener for a true
 * push-based trigger later.)
 */

const POLL_MS = 5000;
const TIMEOUT_MS = 2500;

let started = false;
let wasOnline = false;
let currentUserId: string | null = null;

async function isOnline(): Promise<boolean> {
  const healthUrl =
    (process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1').replace('/api/v1', '/');
  const attempt = fetch(healthUrl, { headers: { 'ngrok-skip-browser-warning': 'true' } })
    .then((r) => r.status === 200)
    .catch(() => false);
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), TIMEOUT_MS));
  return Promise.race([attempt, timeout]);
}

/**
 * Start the reconnect listener; only one instance runs. `setUserId` lets the
 * sync know which user's server-generated reports to pull.
 */
export function startReconnectSync(userId?: string | null): void {
  if (userId !== undefined) currentUserId = userId;
  if (started) return;
  started = true;
  wasOnline = false;

  void (async () => {
    while (true) {
      try {
        const online = await isOnline();
        if (online && !wasOnline) {
          console.log('Reconnect detected — syncing local DB with Supabase.');
          try {
            await syncNow(currentUserId ?? undefined);
          } catch (e) {
            console.warn('syncNow after reconnect failed', e);
          }
        }
        wasOnline = online;
      } catch (e) {
        /* keep polling */
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  })();
}