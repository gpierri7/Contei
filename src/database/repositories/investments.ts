import type { SQLiteDatabase } from 'expo-sqlite';

import { monthEndExclusive, monthStart } from '@/utils/date';

import type { Investment, InvestmentMovement, InvestmentType } from '../types';

export type InvestmentTypeInput = { name: string; color: string; icon: string };
export type InvestmentInput = { name: string; type_id: number; notes?: string | null };
export type MovementInput = {
  investment_id: number;
  kind: 'aporte' | 'resgate';
  amount_cents: number;
  date: number;
  note?: string | null;
};

export type InvestmentWithType = Investment & {
  type_name: string;
  type_color: string;
  type_icon: string;
  /** Saldo deste investimento, não o agregado do tipo. */
  saldo_cents: number;
};

const typesRepo = {
  async list(db: SQLiteDatabase, includeArchived = false): Promise<InvestmentType[]> {
    const clause = includeArchived ? '' : 'WHERE archived = 0';
    return db.getAllAsync<InvestmentType>(
      `SELECT * FROM investment_types ${clause} ORDER BY archived ASC, name COLLATE NOCASE ASC`
    );
  },
  async create(db: SQLiteDatabase, input: InvestmentTypeInput): Promise<number> {
    const result = await db.runAsync(
      'INSERT INTO investment_types (name, color, icon, archived, created_at) VALUES (?, ?, ?, 0, ?)',
      input.name.trim(),
      input.color,
      input.icon,
      Date.now()
    );
    return result.lastInsertRowId;
  },
  async update(
    db: SQLiteDatabase,
    id: number,
    input: Partial<InvestmentTypeInput> & { archived?: number }
  ): Promise<void> {
    const fields: string[] = [];
    const params: (string | number)[] = [];
    if (input.name !== undefined) { fields.push('name = ?'); params.push(input.name.trim()); }
    if (input.color !== undefined) { fields.push('color = ?'); params.push(input.color); }
    if (input.icon !== undefined) { fields.push('icon = ?'); params.push(input.icon); }
    if (input.archived !== undefined) { fields.push('archived = ?'); params.push(input.archived); }
    if (!fields.length) return;
    params.push(id);
    await db.runAsync(`UPDATE investment_types SET ${fields.join(', ')} WHERE id = ?`, params);
  },
  async remove(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM investment_types WHERE id = ?', id);
  },
};

const investmentsRepo = {
  async list(db: SQLiteDatabase, includeArchived = false): Promise<InvestmentWithType[]> {
    const clause = includeArchived ? '' : 'WHERE i.archived = 0';
    // `saldo_cents` vem por investimento: somar por tipo repetiria o mesmo
    // total em cada linha do mesmo tipo, e a lista ficaria enganosa.
    return db.getAllAsync<InvestmentWithType>(
      `SELECT i.*, t.name AS type_name, t.color AS type_color, t.icon AS type_icon,
              COALESCE(SUM(CASE WHEN m.kind = 'aporte' THEN m.amount_cents ELSE 0 END), 0)
                - COALESCE(SUM(CASE WHEN m.kind = 'resgate' THEN m.amount_cents ELSE 0 END), 0)
                AS saldo_cents
         FROM investments i
         JOIN investment_types t ON t.id = i.type_id
         LEFT JOIN investment_movements m ON m.investment_id = i.id
         ${clause}
        GROUP BY i.id
        ORDER BY i.name COLLATE NOCASE ASC`
    );
  },
  async create(db: SQLiteDatabase, input: InvestmentInput): Promise<number> {
    const result = await db.runAsync(
      'INSERT INTO investments (name, type_id, notes, archived, created_at) VALUES (?, ?, ?, 0, ?)',
      input.name.trim(),
      input.type_id,
      input.notes ?? null,
      Date.now()
    );
    return result.lastInsertRowId;
  },
  async update(db: SQLiteDatabase, id: number, input: Partial<InvestmentInput> & { archived?: number }): Promise<void> {
    const fields: string[] = [];
    const params: (string | number | null)[] = [];
    if (input.name !== undefined) { fields.push('name = ?'); params.push(input.name.trim()); }
    if (input.type_id !== undefined) { fields.push('type_id = ?'); params.push(input.type_id); }
    if (input.notes !== undefined) { fields.push('notes = ?'); params.push(input.notes); }
    if (input.archived !== undefined) { fields.push('archived = ?'); params.push(input.archived); }
    if (!fields.length) return;
    params.push(id);
    await db.runAsync(`UPDATE investments SET ${fields.join(', ')} WHERE id = ?`, params);
  },
  async remove(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM investments WHERE id = ?', id);
  },
  async totalByType(db: SQLiteDatabase): Promise<{ type_id: number; type_name: string; type_color: string; total_aportes: number; total_resgates: number; saldo: number }[]> {
    return db.getAllAsync<{
      type_id: number;
      type_name: string;
      type_color: string;
      total_aportes: number;
      total_resgates: number;
      saldo: number;
    }>(
      `SELECT t.id AS type_id, t.name AS type_name, t.color AS type_color,
              COALESCE(SUM(CASE WHEN m.kind = 'aporte' THEN m.amount_cents ELSE 0 END), 0) AS total_aportes,
              COALESCE(SUM(CASE WHEN m.kind = 'resgate' THEN m.amount_cents ELSE 0 END), 0) AS total_resgates,
              (COALESCE(SUM(CASE WHEN m.kind = 'aporte' THEN m.amount_cents ELSE 0 END), 0) -
               COALESCE(SUM(CASE WHEN m.kind = 'resgate' THEN m.amount_cents ELSE 0 END), 0)) AS saldo
         FROM investments i
         JOIN investment_types t ON t.id = i.type_id
         LEFT JOIN investment_movements m ON m.investment_id = i.id
        WHERE i.archived = 0
        GROUP BY t.id
        ORDER BY saldo DESC`
    );
  },
  async totalAll(db: SQLiteDatabase): Promise<number> {
    const row = await db.getFirstAsync<{ saldo: number }>(
      `SELECT
         (COALESCE(SUM(CASE WHEN m.kind = 'aporte' THEN m.amount_cents ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN m.kind = 'resgate' THEN m.amount_cents ELSE 0 END), 0)) AS saldo
         FROM investments i
         LEFT JOIN investment_movements m ON m.investment_id = i.id
        WHERE i.archived = 0`
    );
    return row?.saldo ?? 0;
  },
};

const movementsRepo = {
  async listByInvestment(db: SQLiteDatabase, investmentId: number): Promise<InvestmentMovement[]> {
    return db.getAllAsync<InvestmentMovement>(
      'SELECT * FROM investment_movements WHERE investment_id = ? ORDER BY date DESC, id DESC',
      [investmentId]
    );
  },
  async listByMonth(db: SQLiteDatabase, monthKey: string): Promise<(InvestmentMovement & { investment_name: string })[]> {
    return db.getAllAsync<InvestmentMovement & { investment_name: string }>(
      `SELECT m.*, i.name AS investment_name
         FROM investment_movements m
         JOIN investments i ON i.id = m.investment_id
        WHERE m.date >= ? AND m.date < ?
        ORDER BY m.date DESC`,
      [monthStart(monthKey).getTime(), monthEndExclusive(monthKey).getTime()]
    );
  },
  async add(db: SQLiteDatabase, input: MovementInput): Promise<number> {
    const result = await db.runAsync(
      `INSERT INTO investment_movements (investment_id, kind, amount_cents, date, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      input.investment_id,
      input.kind,
      input.amount_cents,
      input.date,
      input.note ?? null,
      Date.now()
    );
    return result.lastInsertRowId;
  },
  async remove(db: SQLiteDatabase, id: number): Promise<void> {
    await db.runAsync('DELETE FROM investment_movements WHERE id = ?', id);
  },
};

export { typesRepo, investmentsRepo, movementsRepo };
