// This module intentionally does NOT statically `import * as Notifications
// from 'expo-notifications'` at the top level. On some Android/Expo Go
// combinations (SDK 53+, no development build), simply importing that
// package throws synchronously — and since this file is pulled in by
// AuthContext, which the root layout loads unconditionally, that crash
// used to take down the entire app before a single screen could render.
//
// Instead, the native module is loaded lazily inside each function, behind
// a try/catch. If it fails to load (Expo Go on Android without a dev
// build, or any other native-module issue), every function here degrades
// to a safe no-op instead of crashing anything.
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabaseClient';
import type { Tables } from '@/types/database';
// Type-only import — erased at compile time, never executes any runtime
// code, so this alone cannot crash the app the way a value import can.
import type * as NotificationsModule from 'expo-notifications';

type Reminder = Tables<'reminders'>;

let cachedModule: typeof NotificationsModule | null | undefined;
let handlerInstalled = false;

/**
 * Lazily loads expo-notifications. Returns null (instead of throwing) if
 * the native module isn't usable in this environment — e.g. Expo Go on
 * Android without a development build. Cached after the first attempt so
 * we don't retry a doomed import on every call.
 */
async function getNotifications(): Promise<typeof NotificationsModule | null> {
  if (cachedModule !== undefined) return cachedModule;

  try {
    const mod = await import('expo-notifications');
    cachedModule = mod;

    if (!handlerInstalled) {
      handlerInstalled = true;
      // Show the notification even if the app is open in the foreground —
      // otherwise reminders would silently do nothing while the app is
      // active, which is exactly the "nothing happens" pattern we're
      // trying to avoid.
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }

    return mod;
  } catch {
    cachedModule = null;
    return null;
  }
}

/**
 * Asks for notification permission. Must be called before scheduling
 * anything, or the OS will silently drop the request. Returns whether
 * permission was actually granted. Returns false (never throws) if
 * notifications aren't usable in this environment at all.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0D631B',
        });
      } catch {
        // Reminders will still be scheduled; they just may not use the
        // custom channel styling on this device.
      }
    }

    return finalStatus === 'granted';
  } catch {
    return false;
  }
}

const REMINDER_TITLES: Record<Reminder['reminder_type'], string> = {
  medicine: '💊 Medicine reminder',
  hydration: '💧 Time to hydrate',
  activity: '🧠 Activity reminder',
  appointment: '🩺 Appointment reminder',
};

/**
 * Schedules a real, repeating daily local notification for a reminder.
 * Uses the reminder's own id as the notification identifier — scheduling
 * again with the same reminder just overwrites the previous one instead of
 * creating a duplicate, so this is safe to call on every edit or app start.
 * No-ops silently if notifications aren't usable in this environment.
 */
export async function scheduleReminderNotification(reminder: Reminder): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  if (!reminder.is_active) {
    await cancelReminderNotification(reminder.id);
    return;
  }

  const [hourStr, minuteStr] = reminder.scheduled_time.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr ?? '0', 10);

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: {
        title: REMINDER_TITLES[reminder.reminder_type],
        body: reminder.description ? `${reminder.title} — ${reminder.description}` : reminder.title,
        sound: true,
        data: { reminderId: reminder.id, reminderType: reminder.reminder_type },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  } catch {
    // Reminder is still saved in the database either way — just won't
    // produce a device notification on this environment.
  }
}

export async function cancelReminderNotification(reminderId: string): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(reminderId);
  } catch {
    // Nothing to clean up if notifications were never usable here.
  }
}

/**
 * Re-schedules every active reminder for a patient. Call this once when the
 * app starts and a patient session is confirmed — local notifications don't
 * survive an app reinstall or a cleared notification store, so this keeps
 * the device in sync with what's actually in the database. Safe to call
 * even when notifications aren't usable in this environment at all.
 */
export async function syncAllReminderNotifications(patientId: string): Promise<void> {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const { data: reminders, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('patient_id', patientId);

  if (error || !reminders) return;

  try {
    // Cancel everything first so a reminder that was deleted or
    // deactivated doesn't leave a stale notification still scheduled.
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Continue anyway — worst case a stale notification lingers.
  }

  await Promise.all(
    reminders.filter((r) => r.is_active).map((r) => scheduleReminderNotification(r))
  );
}
