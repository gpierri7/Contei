import type { SQLiteDatabase } from 'expo-sqlite';
import * as Notifications from 'expo-notifications';

import { SETTINGS_KEYS, settingsRepo } from '@/database/repositories/settings';
import { formatCurrency } from '@/utils/currency';
import { monthEndExclusive, monthStart } from '@/utils/date';
import { LIMIT_NOTIFICATIONS_CHANNEL_ID } from './notifications';

const NEAR_LIMIT_RATIO = 0.9;
const ALERT_STATE_KEY = 'limit_alert_events';

export function normalizeCategoryLimits(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([id, cents]) =>
        /^\d+$/.test(id) &&
        typeof cents === 'number' &&
        Number.isFinite(cents) &&
        cents > 0
    )
  );
}

export type MonthlyCategorySpend = {
  category_id: number;
  name: string;
  total_cents: number;
};

export async function getMonthlyCategorySpend(
  db: SQLiteDatabase,
  monthKey: string
): Promise<MonthlyCategorySpend[]> {
  const from = monthStart(monthKey).getTime();
  const to = monthEndExclusive(monthKey).getTime();

  return db.getAllAsync<MonthlyCategorySpend>(
    `SELECT expenses.category_id, COALESCE(c.name, 'Categoria') AS name,
            SUM(expenses.amount_cents) AS total_cents
       FROM (
         SELECT category_id, amount_cents FROM variable_expenses
          WHERE date >= ? AND date < ?
         UNION ALL
         SELECT category_id, amount_cents FROM fixed_expenses
          WHERE archived = 0
         UNION ALL
         SELECT category_id, amount_cents FROM installments
          WHERE due_date >= ? AND due_date < ?
       ) expenses
       LEFT JOIN categories c ON expenses.category_id = c.id
      GROUP BY expenses.category_id
      ORDER BY name COLLATE NOCASE ASC`,
    [from, to, from, to]
  );
}

export async function checkSpendingLimitNotifications(
  db: SQLiteDatabase,
  now: Date = new Date()
): Promise<void> {
  const notificationsEnabled = await settingsRepo.get(
    db,
    SETTINGS_KEYS.notificationsEnabled,
    true
  );
  const limitNotificationsEnabled = await settingsRepo.get(
    db,
    SETTINGS_KEYS.limitNotificationsEnabled,
    true
  );
  if (notificationsEnabled !== true || limitNotificationsEnabled !== true) return;

  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [globalEnabled, globalLimit, categoryLimits, spends] = await Promise.all([
    settingsRepo.get(db, SETTINGS_KEYS.limitEnabled, false),
    settingsRepo.get(db, SETTINGS_KEYS.monthlyLimitCents, 0),
    settingsRepo.getJson<unknown>(db, SETTINGS_KEYS.limitCategoryOverrides, {}),
    getMonthlyCategorySpend(db, monthKey),
  ]);

  const targets: { key: string; label: string; total: number; limit: number }[] = [];
  if (globalEnabled === true && typeof globalLimit === 'number' && globalLimit > 0) {
    targets.push({
      key: 'geral',
      label: 'Geral',
      total: spends.reduce((sum, category) => sum + category.total_cents, 0),
      limit: globalLimit,
    });
  }

  const spendByCategory = new Map(spends.map((spend) => [String(spend.category_id), spend]));
  for (const [categoryId, limit] of Object.entries(normalizeCategoryLimits(categoryLimits))) {
    const category = spendByCategory.get(categoryId);
    if (!category) continue;
    targets.push({
      key: `categoria-${categoryId}`,
      label: category.name,
      total: category.total_cents,
      limit,
    });
  }

  if (targets.length === 0) return;

  const permission = await Notifications.getPermissionsAsync();
  const permissionGranted =
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
  if (!permissionGranted) {
    console.warn('Alertas de limite estão habilitados, mas a permissão de notificações foi revogada.');
    return;
  }

  const storedState = await settingsRepo.getJson<unknown>(db, ALERT_STATE_KEY, []);
  const state = Array.isArray(storedState) ? storedState : [];
  const sent = new Set(
    state.filter((entry): entry is string => typeof entry === 'string' && entry.startsWith(`${monthKey}:`))
  );

  for (const target of targets) {
    const ratio = target.total / target.limit;
    const threshold = ratio >= 1 ? 'atingido' : ratio >= NEAR_LIMIT_RATIO ? 'proximo' : null;
    if (!threshold) continue;

    const eventKey = `${monthKey}:${target.key}:${threshold}`;
    if (sent.has(eventKey)) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: threshold === 'atingido' ? 'Limite de gastos atingido' : 'Você está perto do limite',
        body:
          threshold === 'atingido'
            ? `${target.label}: ${formatCurrency(target.total)} gastos para um limite de ${formatCurrency(target.limit)}.`
            : `${target.label}: você já usou ${Math.floor(ratio * 100)}% do limite (${formatCurrency(target.total)} de ${formatCurrency(target.limit)}).`,
        data: { url: '/limites' },
        sound: 'default',
      },
      trigger: { channelId: LIMIT_NOTIFICATIONS_CHANNEL_ID },
    });

    sent.add(eventKey);
    if (threshold === 'atingido') sent.add(`${monthKey}:${target.key}:proximo`);
    await settingsRepo.setJson(db, ALERT_STATE_KEY, [...sent]);
  }
}
