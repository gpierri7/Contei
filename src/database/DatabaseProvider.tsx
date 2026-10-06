import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type DatabaseContextValue = {
  ready: boolean;
  error: Error | null;
  /** Incrementa a cada escrita; é o sinal de que as telas devem recarregar. */
  version: number;
  /** Marca os dados como alterados. Chamar depois de qualquer escrita. */
  invalidate: () => void;
};

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [version, setVersion] = useState(0);
  const started = useRef(false);

  const invalidate = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const { getDatabase } = await import('@/database');
        const { seedDefaults, seedDefaultIncomeSources } = await import('@/database/seed');
        const db = await getDatabase();
        await seedDefaults(db);
        await seedDefaultIncomeSources(db);
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    })();
  }, []);

  const value = useMemo<DatabaseContextValue>(
    () => ({ ready, error, version, invalidate }),
    [ready, error, version, invalidate]
  );

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDatabase(): DatabaseContextValue {
  const ctx = useContext(DatabaseContext);
  if (!ctx) throw new Error('useDatabase precisa estar dentro de <DatabaseProvider>');
  return ctx;
}

export { getDatabase } from '@/database';
