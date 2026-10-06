import type { SQLiteDatabase } from 'expo-sqlite';

import type { SettingValue } from '../types';

type Row = { value: string };

export const SETTINGS_KEYS = {
  theme: 'theme',
  monthlyLimitCents: 'monthly_limit_cents',
  limitEnabled: 'limit_enabled',
  limitThresholds: 'limit_thresholds',
  limitCategoryOverrides: 'limit_category_overrides',
  notificationsEnabled: 'notifications_enabled',
  limitNotificationsEnabled: 'limit_notifications_enabled',
  billNotificationsEnabled: 'bill_notifications_enabled',
  billReminderDays: 'bill_reminder_days',
  billReminderTime: 'bill_reminder_time',
  lockEnabled: 'lock_enabled',
  lockMethod: 'lock_method',
  biometricEnabled: 'biometric_enabled',
  driveAutoBackup: 'drive_auto_backup',
  driveLastBackupAt: 'drive_last_backup_at',
  lastVariableCategoryId: 'last_variable_category_id',
  scheduledBillNotifications: 'scheduled_bill_notifications',
} as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[keyof typeof SETTINGS_KEYS];

/** Lê o texto cru da coluna, sem interpretar. */
async function readRaw(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<Row>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

/** Grava o texto cru na coluna, sem reinterpretar. */
async function writeRaw(db: SQLiteDatabase, key: string, raw: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    raw
  );
}

export const settingsRepo = {
  /**
   * Lê um valor escalar. Retorna `fallback` quando a chave não existe, e
   * `null` quando não há chave nem fallback — daí o `| null` no retorno.
   */
  async get(db: SQLiteDatabase, key: string, fallback?: SettingValue): Promise<SettingValue | null> {
    const raw = await readRaw(db, key);
    if (raw === null) return fallback ?? null;
    try {
      return JSON.parse(raw) as SettingValue;
    } catch {
      // Valor gravado fora do padrão: devolve como texto em vez de perder a config.
      return raw;
    }
  },

  /** Grava um valor escalar. Sempre serializado, para tipagem estável. */
  async set(db: SQLiteDatabase, key: string, value: SettingValue): Promise<void> {
    await writeRaw(db, key, JSON.stringify(value));
  },

  /**
   * Lê um valor estruturado (array/objeto). Aceita tanto o JSON gravado por
   * `setJson` quanto um escalar gravado por `set`, porque `JSON.parse` de
   * `"12"` devolve número — não vale a pena recusar isso.
   */
  async getJson<T>(db: SQLiteDatabase, key: string, fallback: T): Promise<T> {
    const raw = await readRaw(db, key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  /**
   * Grava um valor estruturado.
   *
   * Serializa direto para a coluna em vez de passar por `set`: `set` serializa
   * de novo, e o caminho `set -> getJson` teria de parsear duas vezes para dar
   * certo. Aqui a serialização acontece uma vez só.
   */
  async setJson(db: SQLiteDatabase, key: string, value: unknown): Promise<void> {
    await writeRaw(db, key, JSON.stringify(value ?? null));
  },

  async remove(db: SQLiteDatabase, key: string): Promise<void> {
    await db.runAsync('DELETE FROM settings WHERE key = ?', key);
  },
};