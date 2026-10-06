import { useCallback, useEffect, useRef, useState } from 'react';

import { getDatabase, useDatabase } from '@/database/DatabaseProvider';

type QueryState<T> = {
  data: T;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
};

/**
 * Consulta reativa ao SQLite local.
 *
 * Não existe cache: a fonte é um arquivo local, ler é barato, e uma versão
 * desatualizada em tela financeira é pior do que uma releitura. A dependência
 * `version` do provider invalida todas as telas após qualquer escrita.
 *
 * `T` é o tipo da LINHA; `data` é sempre `T[]`, porque `getAllAsync` retorna
 * lista. Consultas de agregado devem usar `useFirst`.
 */
export function useQuery<T>(
  sql: string,
  params: (string | number | null)[] = [],
  options: { fallback?: T[]; enabled?: boolean; deps?: unknown[] } = {}
): QueryState<T[]> {
  const { version, ready } = useDatabase();
  const enabled = options.enabled !== false && ready;

  const [data, setData] = useState<T[]>(options.fallback ?? []);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [localVersion, setLocalVersion] = useState(0);

  // Serializa as dependências em string: evita re-execução quando o chamador
  // passa um array literal novo a cada render.
  const depsKey = JSON.stringify(options.deps ?? []);
  const paramsKey = JSON.stringify(params);
  const latest = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const ticket = ++latest.current;
    let cancelled = false;

    (async () => {
      try {
        const db = await getDatabase();
        const rows = await db.getAllAsync<T>(sql, params);
        if (!cancelled && ticket === latest.current) {
          setData(rows);
          setError(null);
        }
      } catch (e) {
        if (!cancelled && ticket === latest.current) {
          setError(e instanceof Error ? e : new Error(String(e)));
        }
      } finally {
        if (!cancelled && ticket === latest.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sql, paramsKey, depsKey, version, localVersion, enabled]);

  const refresh = useCallback(() => setLocalVersion((v) => v + 1), []);

  return { data, loading, error, refresh };
}

/**
 * Primeira linha de um agregado (SUM, COUNT, MAX…).
 *
 * Envolve o SQL em `SELECT * FROM (...) LIMIT 1` para que a mesma função de
 * consulta sirva tanto para agregados quanto para listas.
 */
export function useFirst<T>(
  sql: string,
  params: (string | number | null)[] = [],
  options: { fallback: T; enabled?: boolean; deps?: unknown[] }
): QueryState<T> {
  const wrapped = useQuery<{ __row: T }>(
    `SELECT * FROM (${sql}) LIMIT 1`,
    params,
    {
      enabled: options.enabled,
      deps: options.deps,
      fallback: [{ __row: options.fallback }],
    }
  );

  return {
    data: wrapped.data[0]?.__row ?? options.fallback,
    loading: wrapped.loading,
    error: wrapped.error,
    refresh: wrapped.refresh,
  };
}