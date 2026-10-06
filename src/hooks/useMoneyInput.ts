import { useCallback, useMemo, useState } from 'react';

import { formatCurrency, parseCurrencyToCents } from '@/utils/currency';

/**
 * Estado de um campo monetário.
 *
 * O campo guarda o texto digitado, não o número: `parseCurrencyToCents`
 * refaz a conversão no submit. Sem isso, apagar o último dígito de "1.500"
 * faria o input saltar de 15,00 para 0 — o motivo número um de input
 * monetário ficar chato.
 */
export function useMoneyInput(initialCents = 0) {
  const [text, setText] = useState(() =>
    initialCents === 0 ? '' : formatCurrency(initialCents, { showSymbol: false })
  );
  // Valor de origem, para a tela de detalhe saber se o usuário mexeu no campo.
  // Estado em vez de ref: ler durante o render é o que a regra `refs` proíbe.
  const [baselineCents, setBaselineCents] = useState(initialCents);

  const cents = useMemo(() => parseCurrencyToCents(text) ?? 0, [text]);
  const isEmpty = text.trim().length === 0;

  const append = useCallback((key: string) => {
    setText((current) => {
      const digits = key.replace(/\D/g, '');
      if (!digits) return current;

      const currentCents = parseCurrencyToCents(current) ?? 0;
      const currentDigits = current.trim() ? String(currentCents) : '';
      const nextCents = Number(`${currentDigits}${digits}`);
      if (!Number.isSafeInteger(nextCents)) return current;
      return formatCurrency(nextCents, { showSymbol: false });
    });
  }, []);

  const backspace = useCallback(() => {
    setText((current) => {
      const digits = String(parseCurrencyToCents(current) ?? 0).slice(0, -1);
      const nextCents = Number(digits || 0);
      return nextCents === 0 ? '' : formatCurrency(nextCents, { showSymbol: false });
    });
  }, []);

  const clear = useCallback(() => setText(''), []);

  const set = useCallback((value: number) => {
    setBaselineCents(value);
    setText(value === 0 ? '' : formatCurrency(value, { showSymbol: false }));
  }, []);

  /** `true` só depois que o usuário realmente digitar algo diferente do original. */
  const dirty = cents !== baselineCents;

  return { text, cents, isEmpty, dirty, append, backspace, clear, set, setText };
}

/** Máscara de CNPJ/CPF sem biblioteca: mantém só dígitos e pontuação válida. */
export function maskDocument(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  if (digits.length <= 10) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}