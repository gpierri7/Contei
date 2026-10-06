import type { SQLiteDatabase } from 'expo-sqlite';

import { dateInMonth, monthEndExclusive, monthStart } from '@/utils/date';
import type { PaymentMethod } from '@/database/types';
import type { MonthOverview, TransactionListItem } from './overview';
import { fixedRepo, variableRepo } from '@/database/repositories/expenses';
import { installmentsRepo } from '@/database/repositories/installments';

/**
 * UNION ALL das quatro origens de lançamento.
 *
 * Uma consulta só em vez de três hooks paralelos: a lista aparece de uma vez e
 * não há risco de a tela mostrar ganhos de março ao lado de gastos de abril
 * enquanto ainda carrega.
 *
 * Gastos fixos entram com `date = 0` porque um template não tem data — ele tem
 * um dia do mês. O timestamp real é montado em `normalizeRow`, junto com a
 * ordenação final, que também acontece em JS (ordenar em SQL colocaria todo
 * fixo no fim, já que a data viria zerada).
 */
const MONTH_TRANSACTIONS_SQL = `
  SELECT
    'income'        AS kind,
    i.id            AS id,
    i.date          AS date,
    NULL            AS due_day,
    i.amount_cents  AS amount_cents,
    i.method        AS method,
    COALESCE(NULLIF(i.description, ''), s.name) AS title,
    s.name          AS category_name,
    s.color         AS category_color,
    s.icon          AS category_icon,
    'income'        AS origin,
    1               AS is_paid,
    NULL            AS group_id
  FROM incomes i
  JOIN income_sources s ON s.id = i.source_id
  WHERE i.date >= ? AND i.date < ?

  UNION ALL

  SELECT
    'expense', v.id, v.date, NULL, v.amount_cents, v.method,
    COALESCE(NULLIF(v.description, ''), c.name),
    c.name, c.color, c.icon, 'variable', v.is_paid, NULL
  FROM variable_expenses v
  JOIN categories c ON c.id = v.category_id
  WHERE v.date >= ? AND v.date < ?

  UNION ALL

  SELECT
    'expense', f.id, 0, f.due_day, f.amount_cents, f.method,
    COALESCE(NULLIF(f.description, ''), c.name),
    c.name, c.color, c.icon, 'fixed', COALESCE(p.is_paid, 0), NULL
  FROM fixed_expenses f
  JOIN categories c ON c.id = f.category_id
  LEFT JOIN fixed_payments p ON p.fixed_id = f.id AND p.month_key = ?
  WHERE f.archived = 0

  UNION ALL

  SELECT
    'expense', n.id, n.due_date, NULL, n.amount_cents, n.method,
    COALESCE(NULLIF(n.description, ''), c.name),
    c.name, c.color, c.icon, 'installment', n.is_paid, n.group_id
  FROM installments n
  JOIN categories c ON c.id = n.category_id
  WHERE n.due_date >= ? AND n.due_date < ?
`;

interface RawRow {
  kind: 'income' | 'expense';
  id: number;
  date: number;
  due_day: number | null;
  amount_cents: number;
  method: PaymentMethod | null;
  title: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  origin: TransactionListItem['origin'];
  is_paid: number;
  group_id: string | null;
}

/** Lançamentos do mês prontos para renderização, do mais recente ao mais antigo. */
export async function fetchMonthTransactions(
  db: SQLiteDatabase,
  monthKey: string
): Promise<TransactionListItem[]> {
  const from = monthStart(monthKey).getTime();
  const to = monthEndExclusive(monthKey).getTime();

  const rows = await db.getAllAsync<RawRow>(MONTH_TRANSACTIONS_SQL, [
    from,
    to,
    from,
    to,
    monthKey,
    from,
    to,
  ]);

  return rows
    .map((row) => normalizeRow(row, monthKey))
    .sort(
      (a, b) =>
        b.date - a.date ||
        a.kind.localeCompare(b.kind) ||
        b.amountCents - a.amountCents
    );
}

export async function toggleTransactionPaid(
  db: SQLiteDatabase,
  item: TransactionListItem,
  monthKey: string
): Promise<void> {
  const isPaid = !item.isPaid;
  if (item.origin === 'fixed') {
    await fixedRepo.setPaid(db, item.id, monthKey, isPaid);
  } else if (item.origin === 'installment') {
    await installmentsRepo.setPaid(db, item.id, isPaid);
  } else {
    await variableRepo.setPaid(db, item.id, isPaid);
  }
}

/** Ancora o vencimento do fixo na data real do mês que está sendo exibido. */
function normalizeRow(row: RawRow, monthKey: string): TransactionListItem {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    categoryName: row.category_name,
    categoryColor: row.category_color,
    categoryIcon: row.category_icon,
    amountCents: row.amount_cents,
    date: row.date || dateInMonth(monthKey, row.due_day ?? 1).getTime(),
    method: row.method,
    origin: row.origin,
    isPaid: row.is_paid === 1,
    groupId: row.group_id ?? undefined,
  };
}

interface OverviewRow {
  income_cents: number;
  fixed_cents: number;
  variable_cents: number;
  installment_cents: number;
  fixed_paid_cents: number;
  variable_paid_cents: number;
  installment_paid_cents: number;
}

/**
 * Consolidado do mês em SQL.
 *
 * Os totais de gasto representam compromissos do mês. O saldo e "Pago" usam
 * apenas pagamentos efetivados, para uma compra no crédito não parecer saída
 * imediata de dinheiro.
 */
export async function fetchMonthOverview(
  db: SQLiteDatabase,
  monthKey: string,
  now: Date = new Date()
): Promise<MonthOverview> {
  const from = monthStart(monthKey).getTime();
  const to = monthEndExclusive(monthKey).getTime();

  const row = await db.getFirstAsync<OverviewRow>(
    `SELECT
       (SELECT COALESCE(SUM(amount_cents), 0) FROM incomes
         WHERE date >= ? AND date < ?) AS income_cents,
       (SELECT COALESCE(SUM(amount_cents), 0) FROM fixed_expenses
         WHERE archived = 0) AS fixed_cents,
       (SELECT COALESCE(SUM(amount_cents), 0) FROM variable_expenses
         WHERE date >= ? AND date < ?) AS variable_cents,
       (SELECT COALESCE(SUM(amount_cents), 0) FROM installments
         WHERE due_date >= ? AND due_date < ?) AS installment_cents,
       (SELECT COALESCE(SUM(f.amount_cents), 0) FROM fixed_payments p
          JOIN fixed_expenses f ON f.id = p.fixed_id
         WHERE p.month_key = ? AND p.is_paid = 1) AS fixed_paid_cents,
       (SELECT COALESCE(SUM(amount_cents), 0) FROM variable_expenses
         WHERE paid_at >= ? AND paid_at < ? AND is_paid = 1) AS variable_paid_cents,
       (SELECT COALESCE(SUM(amount_cents), 0) FROM installments
         WHERE paid_at >= ? AND paid_at < ? AND is_paid = 1) AS installment_paid_cents`,
    [from, to, from, to, from, to, monthKey, from, to, from, to]
  );

  const income = row?.income_cents ?? 0;
  const fixed = row?.fixed_cents ?? 0;
  const variable = row?.variable_cents ?? 0;
  const installment = row?.installment_cents ?? 0;
  const fixedPaid = row?.fixed_paid_cents ?? 0;
  const variablePaid = row?.variable_paid_cents ?? 0;
  const installmentPaid = row?.installment_paid_cents ?? 0;

  const total = fixed + variable + installment;
  const paid = fixedPaid + variablePaid + installmentPaid;
  const balance = income - paid;

  const progress = monthProgressOf(now);
  // Projeção assume renda e gasto do mês distribuídos por dia corrido: é o que
  // responde "no ritmo em que estou, termino o mês positive?"
  const projected = progress > 0 ? Math.round(income - total / progress) : balance;

  return {
    monthKey,
    incomeCents: income,
    fixedCents: fixed,
    variableCents: variable,
    installmentCents: installment,
    totalCents: total,
    paidCents: paid,
    balanceCents: balance,
    monthProgress: progress,
    projectedCents: projected,
    fixedPaidCents: fixedPaid,
    fixedPendingCents: Math.max(0, fixed - fixedPaid),
    savingsRate: income > 0 ? balance / income : 0,
  };
}

/** Fração de dias do mês já decorrida. */
export function monthProgressOf(date: Date): number {
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Math.min(1, date.getDate() / days);
}