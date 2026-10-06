import type { SQLiteDatabase } from 'expo-sqlite';
import { runDatabaseTransaction } from './transaction';

/**
 * Migrações por `PRAGMA user_version`.
 *
 * Cada entrada é imutável: uma vez publicada, nunca altere as `statements` de
 * uma `version` já existente. Para mudar o esquema, crie uma nova `version`.
 */
type Migration = { version: number; statements: string[] };

export const migrations: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('fixed','variable')),
        archived INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS income_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        recurrence TEXT NOT NULL CHECK (recurrence IN ('monthly_day','oneoff')),
        day_of_month INTEGER,
        expected_cents INTEGER NOT NULL DEFAULT 0,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS incomes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        amount_cents INTEGER NOT NULL,
        date INTEGER NOT NULL,
        description TEXT,
        method TEXT NOT NULL DEFAULT 'pix',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (source_id) REFERENCES income_sources(id) ON DELETE CASCADE
      );`,
      `CREATE TABLE IF NOT EXISTS fixed_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        amount_cents INTEGER NOT NULL,
        due_day INTEGER NOT NULL,
        method TEXT NOT NULL DEFAULT 'pix',
        income_source_id INTEGER,
        description TEXT,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
        FOREIGN KEY (income_source_id) REFERENCES income_sources(id) ON DELETE SET NULL
      );`,
      `CREATE TABLE IF NOT EXISTS fixed_payments (
        fixed_id INTEGER NOT NULL,
        month_key TEXT NOT NULL,
        is_paid INTEGER NOT NULL DEFAULT 0,
        paid_at INTEGER,
        PRIMARY KEY (fixed_id, month_key),
        FOREIGN KEY (fixed_id) REFERENCES fixed_expenses(id) ON DELETE CASCADE
      );`,
      `CREATE TABLE IF NOT EXISTS variable_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        amount_cents INTEGER NOT NULL,
        date INTEGER NOT NULL,
        method TEXT NOT NULL DEFAULT 'pix',
        description TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
      );`,
      `CREATE TABLE IF NOT EXISTS installments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id TEXT NOT NULL,
        total_count INTEGER NOT NULL,
        current_number INTEGER NOT NULL,
        amount_cents INTEGER NOT NULL,
        due_date INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        method TEXT NOT NULL DEFAULT 'pix',
        description TEXT,
        income_source_id INTEGER,
        is_paid INTEGER NOT NULL DEFAULT 0,
        paid_at INTEGER,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
      );`,
      `CREATE TABLE IF NOT EXISTS investment_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS investments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type_id INTEGER NOT NULL,
        notes TEXT,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (type_id) REFERENCES investment_types(id) ON DELETE RESTRICT
      );`,
      `CREATE TABLE IF NOT EXISTS investment_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        investment_id INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('aporte','resgate')),
        amount_cents INTEGER NOT NULL,
        date INTEGER NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (investment_id) REFERENCES investments(id) ON DELETE CASCADE
      );`,
      `CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        target_cents INTEGER NOT NULL,
        deadline INTEGER,
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS goal_deposits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id INTEGER NOT NULL,
        amount_cents INTEGER NOT NULL,
        date INTEGER NOT NULL,
        note TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
      );`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );`,
      `CREATE INDEX IF NOT EXISTS idx_variable_date ON variable_expenses(date);`,
      `CREATE INDEX IF NOT EXISTS idx_variable_category ON variable_expenses(category_id);`,
      `CREATE INDEX IF NOT EXISTS idx_variable_month ON variable_expenses(date / 1000);`,
      `CREATE INDEX IF NOT EXISTS idx_income_date ON incomes(date);`,
      `CREATE INDEX IF NOT EXISTS idx_income_source ON incomes(source_id);`,
      `CREATE INDEX IF NOT EXISTS idx_installments_due ON installments(due_date);`,
      `CREATE INDEX IF NOT EXISTS idx_installments_group ON installments(group_id);`,
      `CREATE INDEX IF NOT EXISTS idx_fixed_payments_month ON fixed_payments(month_key);`,
      `CREATE INDEX IF NOT EXISTS idx_movements_investment ON investment_movements(investment_id);`,
      `CREATE INDEX IF NOT EXISTS idx_deposits_goal ON goal_deposits(goal_id);`,
      `CREATE INDEX IF NOT EXISTS idx_fixed_expenses_archived ON fixed_expenses(archived);`,
    ],
  },
  {
    version: 2,
    statements: [
      `ALTER TABLE variable_expenses
       ADD COLUMN is_paid INTEGER NOT NULL DEFAULT 1;`,
      `ALTER TABLE variable_expenses
       ADD COLUMN paid_at INTEGER;`,
      `UPDATE variable_expenses SET paid_at = date WHERE is_paid = 1;`,
    ],
  },
  {
    version: 3,
    statements: [
      `ALTER TABLE variable_expenses ADD COLUMN receipt_uri TEXT;`,
      `ALTER TABLE variable_expenses ADD COLUMN receipt_ocr_text TEXT;`,
    ],
  },
];

export const LATEST_VERSION = migrations[migrations.length - 1].version;

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  if (current >= LATEST_VERSION) return;

  for (const migration of migrations) {
    if (migration.version <= current) continue;

    await runDatabaseTransaction(db, async (connection) => {
      for (const statement of migration.statements) {
        await connection.execAsync(statement);
      }
      await connection.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}
