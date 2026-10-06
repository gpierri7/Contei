import type { SQLiteDatabase } from 'expo-sqlite';

import type { Goal, GoalDeposit } from '../types';

export type GoalInput = {
  name: string;
  target_cents: number;
  deadline?: number | null;
  color: string;
  icon: string;
};

export type GoalWithProgress = Goal & {
  saved_cents: number;
  remaining_cents: number;
  ratio: number;
  /** Quanto guardar por mês para bater o prazo. `null` se não há prazo. */
  monthly_needed_cents: number | null;
  months_left: number | null;
};

export type GoalRow = GoalWithProgress & { last_deposit_at: number | null };

const goalsRepo = {
  async list(db: SQLiteDatabase, { onlyOpen = false } = {}): Promise<GoalRow[]> {
    const having = onlyOpen ? 'HAVING saved_cents < target_cents' : '';
    return db.getAllAsync<GoalRow>(
      `SELECT g.*,
              COALESCE(SUM(d.amount_cents), 0) AS saved_cents,
              (g.target_cents - COALESCE(SUM(d.amount_cents), 0)) AS remaining_cents,
              (COALESCE(SUM(d.amount_cents), 0) * 1.0 / g.target_cents) AS ratio,
              MAX(d.date) AS last_deposit_at
         FROM goals g
         LEFT JOIN goal_deposits d ON d.goal_id = g.id
        WHERE g.archived = 0
        GROUP BY g.id
        ${having}
        ORDER BY g.deadline IS NULL, g.deadline ASC, g.created_at DESC`
    );
  },

  async create(db: SQLiteDatabase, input: GoalInput): Promise<number> {
    const result = await db.runAsync(
      'INSERT INTO goals (name, target_cents, deadline, color, icon, archived, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
      input.name.trim(),
      input.target_cents,
      input.deadline ?? null,
      input.color,
      input.icon,
      Date.now()
    );
    return result.lastInsertRowId;
  },

  async update(db: SQLiteDatabase, id: number, input: Partial<GoalInput> & { archived?: number }): Promise<void> {
    const fields: string[] = [];
    const params: (string | number | null)[] = [];
    if (input.name !== undefined) { fields.push('name = ?'); params.push(input.name.trim()); }
    if (input.target_cents !== undefined) { fields.push('target_cents = ?'); params.push(input.target_cents); }
    if (input.deadline !== undefined) { fields.push('deadline = ?'); params.push(input.deadline); }
    if (input.color !== undefined) { fields.push('color = ?'); params.push(input.color); }
    if (input.icon !== undefined) { fields.push('icon = ?'); params.push(input.icon); }
    if (input.archived !== undefined) { fields.push('archived = ?'); params.push(input.archived); }
    if (!fields.length) return;
    params.push(id);
    await db.runAsync(`UPDATE goals SET ${fields.join(', ')} WHERE id = ?`, params);
  },

  async remove(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM goals WHERE id = ?', id);
  },

  async deposits(db: SQLiteDatabase, goalId: number): Promise<GoalDeposit[]> {
    return db.getAllAsync<GoalDeposit>(
      'SELECT * FROM goal_deposits WHERE goal_id = ? ORDER BY date DESC, id DESC',
      [goalId]
    );
  },

  async addDeposit(
    db: SQLiteDatabase,
    goalId: number,
    amount_cents: number,
    date: number,
    note?: string | null
  ): Promise<number> {
    const result = await db.runAsync(
      'INSERT INTO goal_deposits (goal_id, amount_cents, date, note, created_at) VALUES (?, ?, ?, ?, ?)',
      goalId,
      amount_cents,
      date,
      note ?? null,
      Date.now()
    );
    return result.lastInsertRowId;
  },

  async removeDeposit(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM goal_deposits WHERE id = ?', id);
  },
};

export { goalsRepo };
