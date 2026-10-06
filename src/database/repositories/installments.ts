import type { SQLiteDatabase } from 'expo-sqlite';

import { shortId } from '@/utils/id';

import type { Installment, PaymentMethod } from '../types';
import { runDatabaseTransaction } from '@/database/transaction';

export type InstallmentGroup = {
  group_id: string;
  total_count: number;
  amount_cents: number;
  total_cents: number;
  paid_count: number;
  pending_count: number;
  paid_cents: number;
  remaining_cents: number;
  next_due_date: number | null;
  first_due_date: number;
  category_name: string;
  category_color: string;
  category_icon: string;
  description: string | null;
  method: PaymentMethod;
};

export type InstallmentRow = Installment & {
  category_name: string;
  category_color: string;
  category_icon: string;
};

export type CreateInstallmentsInput = {
  count: number;
  amount_cents: number;
  first_due_date: number;
  category_id: number;
  method?: PaymentMethod;
  description?: string | null;
  income_source_id?: number | null;
  /** Datas já calculadas; se omitidas, geramos meses a partir da primeira. */
  due_dates?: number[];
};

const installmentsRepo = {
  /**
   * Cria a série de parcelas. Uma compra parcelada é um único evento
   * financeiro dividido em N débitos — por isso compartilham um `group_id` e
   * são gravadas na mesma transação: ou as N existem, ou nenhuma.
   */
  async createGroup(db: SQLiteDatabase, input: CreateInstallmentsInput): Promise<string> {
    const groupId = shortId('inst');
    const count = Math.max(1, Math.floor(input.count));
    const method = input.method ?? 'credito';

    const dueDates = input.due_dates?.length
      ? input.due_dates
      : Array.from({ length: count }, (_, i) => addMonthsToTimestamp(input.first_due_date, i));

    const now = Date.now();

    await runDatabaseTransaction(db, async (transaction) => {
      for (let i = 0; i < count; i += 1) {
        await transaction.runAsync(
          `INSERT INTO installments
             (group_id, total_count, current_number, amount_cents, due_date, category_id, method,
              description, income_source_id, is_paid, paid_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)`,
          groupId,
          count,
          i + 1,
          input.amount_cents,
          dueDates[i] ?? input.first_due_date,
          input.category_id,
          method,
          input.description ?? null,
          input.income_source_id ?? null,
          now
        );
      }
    });

    return groupId;
  },

  async listGroups(db: SQLiteDatabase, { onlyOpen = false } = {}): Promise<InstallmentGroup[]> {
    const having = onlyOpen ? 'HAVING pending_count > 0' : '';
    return db.getAllAsync<InstallmentGroup>(
      `SELECT i.group_id,
              MAX(i.total_count)   AS total_count,
              MAX(i.amount_cents)   AS amount_cents,
              MAX(i.total_count) * MAX(i.amount_cents) AS total_cents,
              SUM(CASE WHEN i.is_paid = 1 THEN 1 ELSE 0 END) AS paid_count,
              SUM(CASE WHEN i.is_paid = 1 THEN 0 ELSE 1 END) AS pending_count,
              SUM(CASE WHEN i.is_paid = 1 THEN i.amount_cents ELSE 0 END) AS paid_cents,
              SUM(CASE WHEN i.is_paid = 1 THEN 0 ELSE i.amount_cents END) AS remaining_cents,
              MIN(CASE WHEN i.is_paid = 0 THEN i.due_date END) AS next_due_date,
              MIN(i.due_date) AS first_due_date,
              MAX(c.name) AS category_name,
              MAX(c.color) AS category_color,
              MAX(c.icon) AS category_icon,
              MAX(i.description) AS description,
              MAX(i.method) AS method
         FROM installments i
         JOIN categories c ON c.id = i.category_id
        GROUP BY i.group_id
        ${having}
        ORDER BY next_due_date IS NULL, next_due_date ASC`
    );
  },

  async listByGroup(db: SQLiteDatabase, groupId: string): Promise<InstallmentRow[]> {
    return db.getAllAsync<InstallmentRow>(
      `SELECT i.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
         FROM installments i
         JOIN categories c ON c.id = i.category_id
        WHERE i.group_id = ?
        ORDER BY i.current_number ASC`,
      [groupId]
    );
  },

  /** Parcelas com vencimento em uma janela — alimenta "contas a vencer". */
  async listDueBetween(db: SQLiteDatabase, from: number, to: number): Promise<InstallmentRow[]> {
    return db.getAllAsync<InstallmentRow>(
      `SELECT i.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
         FROM installments i
         JOIN categories c ON c.id = i.category_id
        WHERE i.due_date >= ? AND i.due_date < ? AND i.is_paid = 0
        ORDER BY i.due_date ASC`,
      [from, to]
    );
  },

  async totalByMonth(db: SQLiteDatabase, from: number, to: number): Promise<number> {
    const row = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount_cents), 0) AS total FROM installments WHERE due_date >= ? AND due_date < ?',
      [from, to]
    );
    return row?.total ?? 0;
  },

  async monthlyTotals(db: SQLiteDatabase, from: number, to: number): Promise<
    { month: string; total: number }[]
  > {
    return db.getAllAsync<{ month: string; total: number }>(
      `SELECT strftime('%Y-%m', due_date / 1000, 'unixepoch', 'localtime') AS month,
              SUM(amount_cents) AS total
         FROM installments
        WHERE due_date >= ? AND due_date < ?
        GROUP BY month
        ORDER BY month ASC`,
      [from, to]
    );
  },

  async setPaid(db: SQLiteDatabase, id: number, isPaid: boolean): Promise<void> {
    await db.runAsync('UPDATE installments SET is_paid = ?, paid_at = ? WHERE id = ?', [
      isPaid ? 1 : 0,
      isPaid ? Date.now() : null,
      id,
    ]);
  },

  async updateGroup(
    db: SQLiteDatabase,
    groupId: string,
    input: {
      description?: string | null;
      category_id?: number;
      amount_cents?: number;
      first_due_date?: number;
      method?: PaymentMethod;
      income_source_id?: number | null;
    }
  ): Promise<void> {
    await runDatabaseTransaction(db, async (transaction) => {
      const rows = await transaction.getAllAsync<Pick<Installment, 'id' | 'current_number' | 'due_date'>>(
        'SELECT id, current_number, due_date FROM installments WHERE group_id = ? ORDER BY current_number',
        [groupId]
      );
      if (!rows.length) return;

      for (const row of rows) {
        const dueDate =
          input.first_due_date === undefined
            ? row.due_date
            : addMonthsToTimestamp(input.first_due_date, row.current_number - 1);
        await transaction.runAsync(
          `UPDATE installments
              SET description = CASE WHEN ? = 1 THEN ? ELSE description END,
                  category_id = CASE WHEN ? = 1 THEN ? ELSE category_id END,
                  amount_cents = CASE WHEN ? = 1 THEN ? ELSE amount_cents END,
                  due_date = ?,
                  method = CASE WHEN ? = 1 THEN ? ELSE method END,
                  income_source_id = CASE WHEN ? = 1 THEN ? ELSE income_source_id END
            WHERE id = ?`,
          input.description === undefined ? 0 : 1,
          input.description ?? null,
          input.category_id === undefined ? 0 : 1,
          input.category_id ?? null,
          input.amount_cents === undefined ? 0 : 1,
          input.amount_cents ?? null,
          dueDate,
          input.method === undefined ? 0 : 1,
          input.method ?? null,
          input.income_source_id === undefined ? 0 : 1,
          input.income_source_id ?? null,
          row.id
        );
      }
    });
  },

  /** Remove a compra inteira e todas as suas parcelas. */
  async removeGroup(db: SQLiteDatabase, groupId: string): Promise<void> {
    await db.runAsync('DELETE FROM installments WHERE group_id = ?', [groupId]);
  },
};

/** Soma meses preservando o dia; dia 31 em fevereiro vira o último dia. */
function addMonthsToTimestamp(timestamp: number, delta: number): number {
  const d = new Date(timestamp);
  const target = new Date(d.getFullYear(), d.getMonth() + delta, 1);
  const maxDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), maxDay));
  target.setHours(d.getHours(), d.getMinutes(), 0, 0);
  return target.getTime();
}

export { installmentsRepo };
