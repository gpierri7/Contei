import type { SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';

export function runDatabaseTransaction(
  db: SQLiteDatabase,
  task: (connection: SQLiteDatabase) => Promise<void>
): Promise<void> {
  if (Platform.OS === 'web') {
    return db.withTransactionAsync(() => task(db));
  }

  return db.withExclusiveTransactionAsync((transaction) => task(transaction));
}
