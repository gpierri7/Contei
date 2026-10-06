import * as SQLite from 'expo-sqlite';

import { runMigrations } from './migrations';

export const DATABASE_NAME = 'contei.db';

let instance: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Abre (ou reaproveita) o banco e garante o schema atualizado.
 * Chamadas concorrentes compartilham a mesma promessa de abertura, então
 * nenhum consumidor vê o banco no meio de uma migração.
 */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!instance) {
    instance = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await runMigrations(db);
      return db;
    })().catch((error) => {
      // Deixa a próxima tentativa refazer em vez de devolver sempre falha.
      instance = null;
      throw error;
    });
  }
  return instance;
}

/** Usado pelo fluxo de restauração, que precisa trocar o arquivo do banco. */
export function resetDatabaseHandle(): void {
  instance = null;
}
