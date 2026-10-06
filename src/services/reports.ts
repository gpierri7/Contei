import type { SQLiteDatabase } from 'expo-sqlite';
import { colors } from '@/theme/colors';

import { monthEndExclusive, monthKeyOf, monthStart, recentMonths } from '@/utils/date';
import type { CategorySlice, MonthPoint } from './overview';

const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/**
 * Gastos por categoria no mês, já ordenados por valor.
 *
 * Trunca em 7 fatias e agrupa o resto em "Outras". O agrupamento fica sempre no
 * fim da lista: no topo ele roubaria a atenção das categorias que importam,
 * que é justamente o que a pessoa abriu a tela para ver.
 */
export async function fetchCategorySlices(
  db: SQLiteDatabase,
  monthKey: string,
  limit = 7
): Promise<CategorySlice[]> {
  const from = monthStart(monthKey).getTime();
  const to = monthEndExclusive(monthKey).getTime();

  const rows = await db.getAllAsync<{
    category_id: number;
    name: string;
    color: string;
    icon: string;
    total_cents: number;
    count: number;
  }>(
    `SELECT c.id AS category_id, c.name, c.color, c.icon,
            COALESCE(SUM(v.amount_cents), 0) AS total_cents,
            COUNT(v.id) AS count
       FROM categories c
       JOIN variable_expenses v
         ON v.category_id = c.id AND v.date >= ? AND v.date < ?
      WHERE c.archived = 0 AND c.kind = 'variable'
      GROUP BY c.id
      ORDER BY total_cents DESC`,
    [from, to]
  );

  const total = rows.reduce((sum, r) => sum + r.total_cents, 0);
  const head = rows.slice(0, limit);
  const tail = rows.slice(limit);

  const slices: CategorySlice[] = head.map((row) => ({
    categoryId: row.category_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    totalCents: row.total_cents,
    count: row.count,
    share: total > 0 ? row.total_cents / total : 0,
  }));

  if (tail.length > 0) {
    const sum = tail.reduce((acc, r) => acc + r.total_cents, 0);
    const count = tail.reduce((acc, r) => acc + r.count, 0);
    slices.push({
      categoryId: -1,
      name: `Outras (${tail.length})`,
      color: colors.textTertiary,
      icon: 'grid',
      totalCents: sum,
      count,
      share: total > 0 ? sum / total : 0,
    });
  }

  return slices;
}

interface Buckets {
  income: Map<string, number>;
  variable: Map<string, number>;
  installments: Map<string, number>;
}

/**
 * Série mensal de entradas e saídas.
 *
 * O agrupamento por mês acontece em JS, não em SQL. `strftime` com `localtime`
 * usa o fuso do processo (frequentemente UTC em containers e em aparelhos com
 * offset fracionário como India ou Nepal) e jogaria lançamentos para o mês
 * errado; `monthKeyOf` usa o fuso do aparelho, que é o mesmo que o usuário vê no
 * calendário. O custo é o mesmo: quatro varreduras por faixa de seis meses.
 */
export async function fetchMonthlySeries(
  db: SQLiteDatabase,
  endMonth: string,
  months = 6
): Promise<MonthPoint[]> {
  const keys = recentMonths(months, endMonth);
  const from = monthStart(keys[0]).getTime();
  const to = monthEndExclusive(endMonth).getTime();
  const window: [number, number] = [from, to];

  const [incomes, variableRows, installmentRows, fixedRow] = await Promise.all([
    db.getAllAsync<{ date: number; amount_cents: number }>(
      'SELECT date, amount_cents FROM incomes WHERE date >= ? AND date < ?',
      window
    ),
    db.getAllAsync<{ date: number; amount_cents: number }>(
      'SELECT date, amount_cents FROM variable_expenses WHERE date >= ? AND date < ?',
      window
    ),
    db.getAllAsync<{ due_date: number; amount_cents: number }>(
      'SELECT due_date, amount_cents FROM installments WHERE due_date >= ? AND due_date < ?',
      window
    ),
    db.getFirstAsync<{ total: number }>(
      'SELECT COALESCE(SUM(amount_cents), 0) AS total FROM fixed_expenses WHERE archived = 0'
    ),
  ]);

  const buckets: Buckets = {
    income: bucketByMonth(incomes, 'date'),
    variable: bucketByMonth(variableRows, 'date'),
    installments: bucketByMonth(installmentRows, 'due_date'),
  };

  // Fixos não têm data: o template vale para todo mês do período, então entra
  // como constante. Somar só os pagos inflaria a série conforme o dia do mês e
  // o gráfico mentiria justamente sobre o mês corrente.
  const fixed = fixedRow?.total ?? 0;

  return keys.map((key) => {
    const income = buckets.income.get(key) ?? 0;
    const expense = fixed + (buckets.variable.get(key) ?? 0) + (buckets.installments.get(key) ?? 0);

    return {
      monthKey: key,
      label: MONTH_ABBR[Number(key.split('-')[1]) - 1],
      incomeCents: income,
      expenseCents: expense,
      balanceCents: income - expense,
    };
  });
}

/**
 * Soma por mês no fuso local do aparelho, o mesmo do calendário visível.
 * `field` nomeia a coluna de data de cada tabela (`incomes`/`variable_expenses`
 * usam `date`, `installments` usa `due_date`).
 */
function bucketByMonth(
  rows: { amount_cents: number; date?: number; due_date?: number }[],
  field: 'date' | 'due_date'
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = monthKeyOf(row[field] as number);
    map.set(key, (map.get(key) ?? 0) + row.amount_cents);
  }
  return map;
}