import { useCallback, useEffect, useState } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase, useDatabase } from '@/database/DatabaseProvider';
import type { PaymentMethod } from '@/database/types';
import type { MonthOverview, TransactionListItem } from '@/services/overview';
import { fetchMonthOverview, fetchMonthTransactions } from '@/services/transactions';

type AsyncState<T> = {
  data: T;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
};

const EMPTY_OVERVIEW: MonthOverview = {
  monthKey: '',
  incomeCents: 0,
  fixedCents: 0,
  variableCents: 0,
  installmentCents: 0,
  totalCents: 0,
  paidCents: 0,
  balanceCents: 0,
  monthProgress: 0,
  projectedCents: 0,
  fixedPaidCents: 0,
  fixedPendingCents: 0,
  savingsRate: 0,
};

/**
 * Hook genérico para consultas que passam por uma função de serviço em vez de
 * SQL direto (multi-consulta, agregação, normalização).
 *
 * Mantém o mesmo contrato de `useQuery` para que as telas não precisem saber
 * qual das duas formas cada dado usa. Descarta respostas de requisições
 * antigas — sem isso, trocar de mês rápido mostra a lista do mês anterior.
 */
export function useAsync<T>(
  loader: (db: SQLiteDatabase) => Promise<T>,
  deps: unknown[],
  fallback: T
): AsyncState<T> {
  const { version, ready } = useDatabase();
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(ready);
  const [error, setError] = useState<Error | null>(null);
  const [localVersion, setLocalVersion] = useState(0);

  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;
    // O SQLite é um sistema externo: este effect se inscreve nele e atualiza o
    // estado quando a consulta responde. Marcar o loading no início é parte
    // dessa sincronização, não um estado derivado que daria para ler durante o
    // render — sem isso a tela mostraria os dados do mês anterior enquanto o
    // novo carrega.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    (async () => {
      try {
        const db = await getDatabase();
        const result = await loader(db);
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, version, localVersion, ready]);

  const refresh = useCallback(() => setLocalVersion((v) => v + 1), []);

  return { data, loading, error, refresh };
}

/** Tudo que a tela inicial precisa de um mês, em uma só invalidação. */
export function useMonthData(monthKey: string) {
  const overview = useAsync<MonthOverview>(
    (db) => fetchMonthOverview(db, monthKey),
    [monthKey],
    { ...EMPTY_OVERVIEW, monthKey }
  );

  const transactions = useAsync<TransactionListItem[]>(
    (db) => fetchMonthTransactions(db, monthKey),
    [monthKey],
    []
  );

  const { refresh: refreshOverview } = overview;
  const { refresh: refreshTransactions } = transactions;

  const refresh = useCallback(() => {
    refreshOverview();
    refreshTransactions();
  }, [refreshOverview, refreshTransactions]);

  return {
    overview: overview.data,
    transactions: transactions.data,
    loading: overview.loading || transactions.loading,
    error: overview.error ?? transactions.error,
    refresh,
  };
}

/** Metas abertas com progresso calculado. */
export function useOpenGoals() {
  return useAsync(
    async (db) => {
      const rows = await db.getAllAsync<{
        id: number;
        name: string;
        target_cents: number;
        color: string;
        icon: string;
        deadline: number | null;
        saved_cents: number;
      }>(
        `SELECT g.id, g.name, g.target_cents, g.color, g.icon, g.deadline,
                COALESCE(SUM(d.amount_cents), 0) AS saved_cents
           FROM goals g
           LEFT JOIN goal_deposits d ON d.goal_id = g.id
          WHERE g.archived = 0
          GROUP BY g.id
          ORDER BY g.deadline IS NULL, g.deadline ASC`
      );

      return rows.map((row) => ({
        ...row,
        ratio: row.target_cents > 0 ? row.saved_cents / row.target_cents : 0,
        remainingCents: Math.max(0, row.target_cents - row.saved_cents),
      }));
    },
    [],
    [] as {
      id: number;
      name: string;
      target_cents: number;
      color: string;
      icon: string;
      deadline: number | null;
      saved_cents: number;
      ratio: number;
      remainingCents: number;
    }[]
  );
}

/** Contas fixas do mês com estado de pagamento. */
export function useFixedExpenses(monthKey: string) {
  return useAsync(
    async (db) => {
      return db.getAllAsync<{
        id: number;
        amount_cents: number;
        due_day: number;
method: PaymentMethod;
        description: string | null;
        category_name: string;
        category_color: string;
        category_icon: string;
        is_paid: number;
        source_name: string | null;
        source_day: number | null;
      }>(
        `SELECT f.id, f.amount_cents, f.due_day, f.method, f.description,
                f.income_source_id,
                c.name AS category_name, c.color AS category_color, c.icon AS category_icon,
                s.name AS source_name, s.day_of_month AS source_day,
                COALESCE(p.is_paid, 0) AS is_paid, p.paid_at
           FROM fixed_expenses f
           JOIN categories c ON c.id = f.category_id
           LEFT JOIN income_sources s ON s.id = f.income_source_id
           LEFT JOIN fixed_payments p ON p.fixed_id = f.id AND p.month_key = ?
          WHERE f.archived = 0
          ORDER BY f.due_day ASC`,
        [monthKey]
      );
    },
    [monthKey],
    [] as {
      id: number;
      amount_cents: number;
      due_day: number;
      method: PaymentMethod;
      description: string | null;
      category_name: string;
      category_color: string;
      category_icon: string;
      is_paid: number;
      source_name: string | null;
      source_day: number | null;
    }[]
  );
}