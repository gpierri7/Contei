import type { SQLiteDatabase } from 'expo-sqlite';
import type { ScheduledExpense } from '../types';

export type ScheduledInput = Omit<
  ScheduledExpense,
  'id' | 'occurrences_created' | 'next_billing_date' | 'paused' | 'archived' | 'created_at' | 'updated_at'
> & {
  id?: string;
  next_billing_date?: number;
};

export async function createScheduledExpense(
  db: SQLiteDatabase,
  input: ScheduledInput
): Promise<ScheduledExpense> {
  const now = Date.now();
  const next = input.next_billing_date ?? input.billing_date;
  const result = await db.runAsync(
    `INSERT INTO scheduled_expenses (
      name, amount_cents, category_id, method, billing_date, recurrence,
      recurrence_interval, reminder_days, reminder_hour, reminder_minute, auto_launch,
      linked_salary_source_id, ends_at, total_occurrences, occurrences_created,
      next_billing_date, paused, archived, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      input.name,
      input.amount_cents,
      input.category_id,
      input.method,
      input.billing_date,
      input.recurrence,
      input.recurrence_interval,
      input.reminder_days,
      input.reminder_hour,
      input.reminder_minute,
      input.auto_launch,
      input.linked_salary_source_id ?? null,
      input.ends_at ?? null,
      input.total_occurrences ?? null,
      0,
      next,
      0,
      0,
      now,
      now,
    ]
  );
  const row = (await db.getFirstAsync<ScheduledExpense>(
    'SELECT * FROM scheduled_expenses WHERE id = ?',
    [result.lastInsertRowId]
  )) as ScheduledExpense;
  return row;
}

export async function getScheduledExpense(db: SQLiteDatabase, id: number): Promise<ScheduledExpense | null> {
  const row = await db.getFirstAsync<ScheduledExpense>('SELECT * FROM scheduled_expenses WHERE id = ?', [id]);
  return row ?? null;
}

export async function listScheduledExpenses(db: SQLiteDatabase, includeArchived = false) {
  const where = includeArchived ? '' : 'WHERE archived = 0';
  return (await db.getAllAsync<ScheduledExpense>(
    `SELECT * FROM scheduled_expenses ${where} ORDER BY next_billing_date ASC, name ASC`
  )) as ScheduledExpense[];
}

export async function listDueScheduled(db: SQLiteDatabase, upTo: number) {
  return (await db.getAllAsync<ScheduledExpense>(
    `SELECT * FROM scheduled_expenses WHERE archived = 0 AND paused = 0 AND next_billing_date <= ? ORDER BY next_billing_date ASC, name ASC`,
    [upTo]
  )) as ScheduledExpense[];
}

export async function listActiveScheduled(db: SQLiteDatabase) {
  return (await db.getAllAsync<ScheduledExpense>(
    `SELECT * FROM scheduled_expenses WHERE archived = 0 AND paused = 0 ORDER BY next_billing_date ASC, name ASC`
  )) as ScheduledExpense[];
}
