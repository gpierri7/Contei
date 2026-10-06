import type { SQLiteDatabase } from 'expo-sqlite';

import { runDatabaseTransaction } from '@/database/transaction';

import type { Category, CategoryKind } from '../types';

export type CategoryInput = {
  name: string;
  color: string;
  icon: string;
  kind: CategoryKind;
};

export const categoriesRepo = {
  async list(db: SQLiteDatabase, kind?: CategoryKind, includeArchived = false): Promise<Category[]> {
    const where: string[] = [];
    const params: (string | number)[] = [];

    if (kind) {
      where.push('kind = ?');
      params.push(kind);
    }
    if (!includeArchived) where.push('archived = 0');

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return db.getAllAsync<Category>(
      `SELECT * FROM categories ${clause} ORDER BY archived ASC, name COLLATE NOCASE ASC`,
      params
    );
  },

  async byId(db: SQLiteDatabase, id: number): Promise<Category | null> {
    return db.getFirstAsync<Category>('SELECT * FROM categories WHERE id = ?', id);
  },

  async create(db: SQLiteDatabase, input: CategoryInput): Promise<number> {
    const result = await db.runAsync(
      'INSERT INTO categories (name, color, icon, kind, archived, created_at) VALUES (?, ?, ?, ?, 0, ?)',
      input.name.trim(),
      input.color,
      input.icon,
      input.kind,
      Date.now()
    );
    return result.lastInsertRowId;
  },

  async update(
    db: SQLiteDatabase,
    id: number,
    input: Partial<CategoryInput> & { archived?: number }
  ): Promise<void> {
    const fields: string[] = [];
    const params: (string | number)[] = [];

    if (input.name !== undefined) {
      fields.push('name = ?');
      params.push(input.name.trim());
    }
    if (input.color !== undefined) {
      fields.push('color = ?');
      params.push(input.color);
    }
    if (input.icon !== undefined) {
      fields.push('icon = ?');
      params.push(input.icon);
    }
    if (input.kind !== undefined) {
      fields.push('kind = ?');
      params.push(input.kind);
    }
    if (input.archived !== undefined) {
      fields.push('archived = ?');
      params.push(input.archived);
    }
    if (!fields.length) return;

    params.push(id);
    await db.runAsync(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, params);
  },

  /**
   * Remove de verdade. Só é seguro quando nada referencia a categoria; caso
   * contrário a restrição `ON DELETE RESTRICT` protege a integridade dos
   * lançamentos. A UI sempre oferece arquivar antes de chegar aqui.
   */
  async remove(db: SQLiteDatabase, id: number): Promise<boolean> {
    try {
      const result = await db.runAsync('DELETE FROM categories WHERE id = ?', id);
      return result.changes > 0;
    } catch {
      return false;
    }
  },

  /** Reatribui os lançamentos de uma categoria para outra e remove a original. */
  async mergeInto(db: SQLiteDatabase, fromId: number, toId: number): Promise<boolean> {
    try {
      await runDatabaseTransaction(db, async (transaction) => {
        await transaction.runAsync('UPDATE variable_expenses SET category_id = ? WHERE category_id = ?', toId, fromId);
        await transaction.runAsync('UPDATE fixed_expenses SET category_id = ? WHERE category_id = ?', toId, fromId);
        await transaction.runAsync('UPDATE installments SET category_id = ? WHERE category_id = ?', toId, fromId);
        await transaction.runAsync('DELETE FROM categories WHERE id = ?', fromId);
      });
      return true;
    } catch {
      return false;
    }
  },

  async usageCount(db: SQLiteDatabase, id: number): Promise<number> {
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT
         (SELECT COUNT(*) FROM variable_expenses WHERE category_id = ?) +
         (SELECT COUNT(*) FROM fixed_expenses   WHERE category_id = ?) +
         (SELECT COUNT(*) FROM installments     WHERE category_id = ?) AS total`,
      [id, id, id]
    );
    return row?.total ?? 0;
  },
};
