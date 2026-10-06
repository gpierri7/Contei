import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

type PendingUndo = {
  message: string;
  action: () => Promise<void>;
};

const UNDO_DURATION_MS = 5000;

export function usePaymentUndo() {
  const [pending, setPending] = useState<PendingUndo | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
    setPending(null);
  }, []);

  const offerUndo = useCallback(
    (message: string, action: () => Promise<void>) => {
      if (timeout.current) clearTimeout(timeout.current);
      setPending({ message, action });
      timeout.current = setTimeout(() => {
        timeout.current = null;
        setPending(null);
      }, UNDO_DURATION_MS);
    },
    []
  );

  const undo = useCallback(async () => {
    if (!pending) return;
    try {
      await pending.action();
      dismiss();
    } catch (error) {
      dismiss();
      Alert.alert(
        'Não foi possível desfazer',
        error instanceof Error ? error.message : undefined
      );
    }
  }, [dismiss, pending]);

  useEffect(
    () => () => {
      if (timeout.current) clearTimeout(timeout.current);
    },
    []
  );

  return {
    message: pending?.message ?? null,
    offerUndo,
    undo,
    dismiss,
  };
}
