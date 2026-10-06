import type { SQLiteDatabase } from 'expo-sqlite';

import { monthEndExclusive, monthStart } from '@/utils/date';

import type { Income, IncomeSource, PaymentMethod } from '../types';

export type IncomeSourceInput = {
  name: string;
  color: string;
  icon: string;
  recurrence: 'monthly_day' | 'oneoff';
  day_of_month: number | null;
  expected_cents?: number;
};

export type IncomeInput = {
  source_id: number;
  amount_cents: number;
  date: number;
  description?: string | null;
  method?: PaymentMethod;
};

export type IncomeWithSource = Income & {
  source_name: string;
  source_color: string;
  source_icon: string;
  source_day: number | null;
};

const sourcesRepo = {
  async list(db: SQLiteDatabase, includeArchived = false): Promise<IncomeSource[]> {
    const clause = includeArchived ? '' : 'WHERE archived = 0';
    return db.getAllAsync<IncomeSource>(
      `SELECT * FROM income_sources ${clause} ORDER BY archived ASC,
        CASE WHEN day_of_month IS NULL THEN 1 ELSE 0 END ASC,
        day_of_month ASC, name COLLATE NOCASE ASC`
    );
  },

  async create(db: SQLiteDatabase, input: IncomeSourceInput): Promise<number> {
    const result = await db.runAsync(
      `INSERT INTO income_sources (name, color, icon, recurrence, day_of_month, expected_cents, archived, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      input.name.trim(),
      input.color,
      input.icon,
      input.recurrence,
      input.day_of_month,
      input.expected_cents ?? 0,
      Date.now()
    );
    return result.lastInsertRowId;
  },

  async update(
    db: SQLiteDatabase,
    id: number,
    input: Partial<IncomeSourceInput> & { archived?: number }
  ): Promise<void> {
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.name !== undefined) { fields.push('name = ?'); params.push(input.name.trim()); }
    if (input.color !== undefined) { fields.push('color = ?'); params.push(input.color); }
    if (input.icon !== undefined) { fields.push('icon = ?'); params.push(input.icon); }
    if (input.recurrence !== undefined) { fields.push('recurrence = ?'); params.push(input.recurrence); }
    if (input.day_of_month !== undefined) { fields.push('day_of_month = ?'); params.push(input.day_of_month); }
    if (input.expected_cents !== undefined) { fields.push('expected_cents = ?'); params.push(input.expected_cents); }
    if (input.archived !== undefined) { fields.push('archived = ?'); params.push(input.archived); }
    if (!fields.length) return;

    params.push(id);
    await db.runAsync(`UPDATE income_sources SET ${fields.join(', ')} WHERE id = ?`, params);
  },

  async remove(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM income_sources WHERE id = ?', id);
  },
};

const incomesRepo = {
  async listByMonth(db: SQLiteDatabase, monthKey: string): Promise<IncomeWithSource[]> {
    return db.getAllAsync<IncomeWithSource>(
      `SELECT i.*, s.name AS source_name, s.color AS source_color, s.icon AS source_icon,
              s.day_of_month AS source_day
         FROM incomes i
         JOIN income_sources s ON s.id = i.source_id
        WHERE i.date >= ? AND i.date < ?
        ORDER BY i.date DESC, i.id DESC`,
      [monthStart(monthKey).getTime(), monthEndExclusive(monthKey).getTime()]
    );
  },

  async listRange(db: SQLiteDatabase, from: number, to: number): Promise<IncomeWithSource[]> {
    return db.getAllAsync<IncomeWithSource>(
      `SELECT i.*, s.name AS source_name, s.color AS source_color, s.icon AS source_icon,
              s.day_of_month AS source_day
         FROM incomes i
         JOIN income_sources s ON s.id = i.source_id
        WHERE i.date >= ? AND i.date < ?
        ORDER BY i.date ASC`,
      [from, to]
    );
  },

  async totalsBySource(db: SQLiteDatabase, monthKey: string): Promise<
    { source_id: number; total: number }[]
  > {
    return db.getAllAsync<{ source_id: number; total: number }>(
      `SELECT source_id, SUM(amount_cents) AS total
         FROM incomes
        WHERE date >= ? AND date < ?
        GROUP BY source_id
        ORDER BY total DESC`,
      [monthStart(monthKey).getTime(), monthEndExclusive(monthKey).getTime()]
    );
  },

  async totalByMonth(db: SQLiteDatabase, monthKey: string): Promise<number> {
    const row = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount_cents), 0) AS total FROM incomes WHERE date >= ? AND date < ?',
      [monthStart(monthKey).getTime(), monthEndExclusive(monthKey).getTime()]
    );
    return row?.total ?? 0;
  },

  /** Série mensal para o gráfico de evolução. */
  async monthlyTotals(db: SQLiteDatabase, fromMonth: string, toMonth: string): Promise<
    { month: string; total: number }[]
  > {
    return db.getAllAsync<{ month: string; total: number }>(
      `SELECT strftime('%Y-%m', date / 1000, 'unixepoch', 'localtime') AS month,
              SUM(amount_cents) AS total
         FROM incomes
        WHERE date >= ? AND date < ?
        GROUP BY month
        ORDER BY month ASC`,
      [monthStart(fromMonth).getTime(), monthEndExclusive(toMonth).getTime()]
    );
  },

  async create(db: SQLiteDatabase, input: IncomeInput): Promise<number> {
    const result = await db.runAsync(
      `INSERT INTO incomes (source_id, amount_cents, date, description, method, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      input.source_id,
      input.amount_cents,
      input.date,
      input.description ?? null,
      input.method ?? 'pix',
      Date.now()
    );
    return result.lastInsertRowId;
  },

  async byId(db: SQLiteDatabase, id: number): Promise<Income | null> {
    return db.getFirstAsync<Income>('SELECT * FROM incomes WHERE id = ?', id);
  },

  async update(db: SQLiteDatabase, id: number, input: Partial<IncomeInput>): Promise<void> {
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.source_id !== undefined) { fields.push('source_id = ?'); params.push(input.source_id); }
    if (input.amount_cents !== undefined) { fields.push('amount_cents = ?'); params.push(input.amount_cents); }
    if (input.date !== undefined) { fields.push('date = ?'); params.push(input.date); }
    if (input.description !== undefined) { fields.push('description = ?'); params.push(input.description); }
    if (input.method !== undefined) { fields.push('method = ?'); params.push(input.method); }
    if (!fields.length) return;

    params.push(id);
    await db.runAsync(`UPDATE incomes SET ${fields.join(', ')} WHERE id = ?`, params);
  },

  async remove(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM incomes WHERE id = ?', id);
  },
};

export { sourcesRepo, incomesRepo };
