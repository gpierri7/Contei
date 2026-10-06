import type { SQLiteDatabase } from 'expo-sqlite';

import { monthEndExclusive, monthStart } from '@/utils/date';

import type {
  FixedExpense,
  FixedPayment,
  PaymentMethod,
  VariableExpense,
} from '../types';

export type FixedExpenseInput = {
  category_id: number;
  amount_cents: number;
  due_day: number;
  method?: PaymentMethod;
  income_source_id?: number | null;
  description?: string | null;
};

export type VariableExpenseInput = {
  category_id: number;
  amount_cents: number;
  date: number;
  method?: PaymentMethod;
  description?: string | null;
  is_paid?: boolean;
  receipt_uri?: string | null;
  receipt_ocr_text?: string | null;
};

export type VariableExpenseRow = VariableExpense & {
  category_name: string;
  category_color: string;
  category_icon: string;
};

/** Um gasto fixo no contexto do mês: o template somado ao seu estado de pagamento. */
export type FixedExpenseRow = FixedExpense & {
  category_name: string;
  category_color: string;
  category_icon: string;
  source_name: string | null;
  source_color: string | null;
  source_day: number | null;
  is_paid: number;
  paid_at: number | null;
};

const fixedRepo = {
  async list(db: SQLiteDatabase, includeArchived = false): Promise<FixedExpenseRow[]> {
    const clause = includeArchived ? '' : 'WHERE f.archived = 0';
    return db.getAllAsync<FixedExpenseRow>(
      `SELECT f.*,
              c.name AS category_name, c.color AS category_color, c.icon AS category_icon,
              s.name AS source_name, s.color AS source_color, s.day_of_month AS source_day
         FROM fixed_expenses f
         JOIN categories c ON c.id = f.category_id
         LEFT JOIN income_sources s ON s.id = f.income_source_id
         ${clause}
        ORDER BY f.archived ASC, f.due_day ASC, f.amount_cents DESC`
    );
  },

  async listForMonth(db: SQLiteDatabase, monthKey: string): Promise<FixedExpenseRow[]> {
    return db.getAllAsync<FixedExpenseRow>(
      `SELECT f.*,
              c.name AS category_name, c.color AS category_color, c.icon AS category_icon,
              s.name AS source_name, s.color AS source_color, s.day_of_month AS source_day,
              COALESCE(p.is_paid, 0) AS is_paid, p.paid_at AS paid_at
         FROM fixed_expenses f
         JOIN categories c ON c.id = f.category_id
         LEFT JOIN income_sources s ON s.id = f.income_source_id
         LEFT JOIN fixed_payments p ON p.fixed_id = f.id AND p.month_key = ?
        WHERE f.archived = 0
        ORDER BY f.due_day ASC`,
      [monthKey]
    );
  },

  async totalByMonth(db: SQLiteDatabase, monthKey: string): Promise<number> {
    const row = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount_cents), 0) AS total FROM fixed_expenses WHERE archived = 0'
    );
    return row?.total ?? 0;
  },

  async totalsBySourceForMonth(db: SQLiteDatabase, monthKey: string): Promise<
    { income_source_id: number; total: number; count: number }[]
  > {
    return db.getAllAsync<{ income_source_id: number; total: number; count: number }>(
      `SELECT income_source_id, SUM(amount_cents) AS total, COUNT(*) AS count
         FROM fixed_expenses
        WHERE archived = 0 AND income_source_id IS NOT NULL
        GROUP BY income_source_id`
    );
  },

  async create(db: SQLiteDatabase, input: FixedExpenseInput): Promise<number> {
    const result = await db.runAsync(
      `INSERT INTO fixed_expenses (category_id, amount_cents, due_day, method, income_source_id, description, archived, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      input.category_id,
      input.amount_cents,
      input.due_day,
      input.method ?? 'pix',
      input.income_source_id ?? null,
      input.description ?? null,
      Date.now()
    );
    return result.lastInsertRowId;
  },

  async update(
    db: SQLiteDatabase,
    id: number,
    input: Partial<FixedExpenseInput> & { archived?: number }
  ): Promise<void> {
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.category_id !== undefined) { fields.push('category_id = ?'); params.push(input.category_id); }
    if (input.amount_cents !== undefined) { fields.push('amount_cents = ?'); params.push(input.amount_cents); }
    if (input.due_day !== undefined) { fields.push('due_day = ?'); params.push(input.due_day); }
    if (input.method !== undefined) { fields.push('method = ?'); params.push(input.method); }
    if (input.income_source_id !== undefined) { fields.push('income_source_id = ?'); params.push(input.income_source_id); }
    if (input.description !== undefined) { fields.push('description = ?'); params.push(input.description); }
    if (input.archived !== undefined) { fields.push('archived = ?'); params.push(input.archived); }
    if (!fields.length) return;

    params.push(id);
    await db.runAsync(`UPDATE fixed_expenses SET ${fields.join(', ')} WHERE id = ?`, params);
  },

  async remove(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM fixed_expenses WHERE id = ?', id);
  },

  /** Liga/desliga o "pago" de um gasto fixo em um mês. Idempotente. */
  async setPaid(
    db: SQLiteDatabase,
    fixedId: number,
    monthKey: string,
    isPaid: boolean
  ): Promise<void> {
    if (isPaid) {
      await db.runAsync(
        `INSERT INTO fixed_payments (fixed_id, month_key, is_paid, paid_at)
         VALUES (?, ?, 1, ?)
         ON CONFLICT(fixed_id, month_key) DO UPDATE SET is_paid = 1, paid_at = excluded.paid_at`,
        fixedId,
        monthKey,
        Date.now()
      );
    } else {
      await db.runAsync(
        `INSERT INTO fixed_payments (fixed_id, month_key, is_paid, paid_at)
         VALUES (?, ?, 0, NULL)
         ON CONFLICT(fixed_id, month_key) DO UPDATE SET is_paid = 0, paid_at = NULL`,
        fixedId,
        monthKey
      );
    }
  },

  async paymentsForMonth(db: SQLiteDatabase, monthKey: string): Promise<FixedPayment[]> {
    return db.getAllAsync<FixedPayment>('SELECT * FROM fixed_payments WHERE month_key = ?', [monthKey]);
  },

  /** Quais gastos fixos já foram pagos — usado nas notificações de atraso. */
  async paidMonthKeys(db: SQLiteDatabase, fixedId: number): Promise<string[]> {
    const rows = await db.getAllAsync<{ month_key: string }>(
      'SELECT month_key FROM fixed_payments WHERE fixed_id = ? AND is_paid = 1',
      [fixedId]
    );
    return rows.map((r) => r.month_key);
  },
};

const variableRepo = {
  async listByMonth(db: SQLiteDatabase, monthKey: string): Promise<VariableExpenseRow[]> {
    return db.getAllAsync<VariableExpenseRow>(
      `SELECT v.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
         FROM variable_expenses v
         JOIN categories c ON c.id = v.category_id
        WHERE v.date >= ? AND v.date < ?
        ORDER BY v.date DESC, v.id DESC`,
      [monthStart(monthKey).getTime(), monthEndExclusive(monthKey).getTime()]
    );
  },

  async listRange(db: SQLiteDatabase, from: number, to: number): Promise<VariableExpenseRow[]> {
    return db.getAllAsync<VariableExpenseRow>(
      `SELECT v.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
         FROM variable_expenses v
         JOIN categories c ON c.id = v.category_id
        WHERE v.date >= ? AND v.date < ?
        ORDER BY v.date DESC`,
      [from, to]
    );
  },

  async totalByMonth(db: SQLiteDatabase, monthKey: string): Promise<number> {
    const row = await db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount_cents), 0) AS total FROM variable_expenses WHERE date >= ? AND date < ?',
      [monthStart(monthKey).getTime(), monthEndExclusive(monthKey).getTime()]
    );
    return row?.total ?? 0;
  },

  async monthlyTotals(db: SQLiteDatabase, fromMonth: string, toMonth: string): Promise<
    { month: string; total: number }[]
  > {
    return db.getAllAsync<{ month: string; total: number }>(
      `SELECT strftime('%Y-%m', date / 1000, 'unixepoch', 'localtime') AS month,
              SUM(amount_cents) AS total
         FROM variable_expenses
        WHERE date >= ? AND date < ?
        GROUP BY month
        ORDER BY month ASC`,
      [monthStart(fromMonth).getTime(), monthEndExclusive(toMonth).getTime()]
    );
  },

  /** Total por categoria no mês — base do donut e do comparativo. */
  async totalsByCategoryForMonth(db: SQLiteDatabase, monthKey: string): Promise<
    { category_id: number; name: string; color: string; icon: string; total: number; count: number }[]
  > {
    return db.getAllAsync<{
      category_id: number;
      name: string;
      color: string;
      icon: string;
      total: number;
      count: number;
    }>(
      `SELECT c.id AS category_id, c.name, c.color, c.icon,
              SUM(v.amount_cents) AS total, COUNT(*) AS count
         FROM variable_expenses v
         JOIN categories c ON c.id = v.category_id
        WHERE v.date >= ? AND v.date < ?
        GROUP BY c.id
        ORDER BY total DESC`,
      [monthStart(monthKey).getTime(), monthEndExclusive(monthKey).getTime()]
    );
  },

  async totalsByCategoryRange(
    db: SQLiteDatabase,
    from: number,
    to: number
  ): Promise<{ category_id: number; name: string; color: string; total: number }[]> {
    return db.getAllAsync<{ category_id: number; name: string; color: string; total: number }>(
      `SELECT c.id AS category_id, c.name, c.color, SUM(v.amount_cents) AS total
         FROM variable_expenses v
         JOIN categories c ON c.id = v.category_id
        WHERE v.date >= ? AND v.date < ?
        GROUP BY c.id
        ORDER BY total DESC`,
      [from, to]
    );
  },

  async create(db: SQLiteDatabase, input: VariableExpenseInput): Promise<number> {
    const result = await db.runAsync(
      `INSERT INTO variable_expenses
         (category_id, amount_cents, date, method, description, is_paid, paid_at, receipt_uri, receipt_ocr_text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.category_id,
      input.amount_cents,
      input.date,
      input.method ?? 'pix',
      input.description ?? null,
      input.is_paid === false ? 0 : 1,
      input.is_paid === false ? null : Date.now(),
      input.receipt_uri ?? null,
      input.receipt_ocr_text ?? null,
      Date.now()
    );
    return result.lastInsertRowId;
  },

  async update(db: SQLiteDatabase, id: number, input: Partial<VariableExpenseInput>): Promise<void> {
    const fields: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.category_id !== undefined) { fields.push('category_id = ?'); params.push(input.category_id); }
    if (input.amount_cents !== undefined) { fields.push('amount_cents = ?'); params.push(input.amount_cents); }
    if (input.date !== undefined) { fields.push('date = ?'); params.push(input.date); }
    if (input.method !== undefined) { fields.push('method = ?'); params.push(input.method); }
    if (input.description !== undefined) { fields.push('description = ?'); params.push(input.description); }
    if (input.receipt_uri !== undefined) { fields.push('receipt_uri = ?'); params.push(input.receipt_uri); }
    if (input.receipt_ocr_text !== undefined) { fields.push('receipt_ocr_text = ?'); params.push(input.receipt_ocr_text); }
    if (input.is_paid !== undefined) {
      fields.push('is_paid = ?');
      params.push(input.is_paid ? 1 : 0);
      fields.push('paid_at = ?');
      params.push(input.is_paid ? Date.now() : null);
    }
    if (!fields.length) return;

    params.push(id);
    await db.runAsync(`UPDATE variable_expenses SET ${fields.join(', ')} WHERE id = ?`, params);
  },

  async remove(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM variable_expenses WHERE id = ?', id);
  },

  async setPaid(db: SQLiteDatabase, id: number, isPaid: boolean): Promise<void> {
    await db.runAsync(
      'UPDATE variable_expenses SET is_paid = ?, paid_at = ? WHERE id = ?',
      isPaid ? 1 : 0,
      isPaid ? Date.now() : null,
      id
    );
  },

  async byId(db: SQLiteDatabase, id: number): Promise<VariableExpense | null> {
    return db.getFirstAsync<VariableExpense>('SELECT * FROM variable_expenses WHERE id = ?', id);
  },
};

export { fixedRepo, variableRepo };
export type { FixedPayment };
