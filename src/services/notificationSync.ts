import type { SQLiteDatabase } from 'expo-sqlite';
import * as Notifications from 'expo-notifications';

export async function syncScheduledNotifications(_db: SQLiteDatabase): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}