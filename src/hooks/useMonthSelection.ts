import { useState } from 'react';
import { router } from 'expo-router';

import { addMonths, currentMonthKey, type MonthKey } from '@/utils/date';

/**
 * Estado de seleção de mês compartilhado pelas telas com filtro mensal.
 *
 * Existe para que o seletor, os botões de navegação e o título leiam sempre a
 * mesma chave. Cada tela guarda a sua — trocar de mês em Ganhos não deve
 * arrastar a tela de Gastos junto.
 */
export function useMonthSelection(initial: MonthKey = currentMonthKey()) {
  const [monthKey, setMonthKey] = useState<MonthKey>(initial);
  const [pickerOpen, setPickerOpen] = useState(false);

  return {
    monthKey,
    setMonthKey,
    goPrevious: () => setMonthKey((m) => addMonths(m, -1)),
    goNext: () => setMonthKey((m) => addMonths(m, 1)),
    isCurrentMonth: monthKey === currentMonthKey(),
    pickerOpen,
    openPicker: () => setPickerOpen(true),
    closePicker: () => setPickerOpen(false),
    goTo: (key: MonthKey) => {
      setMonthKey(key);
      setPickerOpen(false);
    },
  };
}

/** Navega para a criação de um lançamento, preservando o contexto da tela. */
export function openAddFlow(params: { kind: 'income' | 'expense'; categoryId?: number }) {
  router.push({
    pathname: '/add',
    params: {
      kind: params.kind,
      ...(params.categoryId ? { categoryId: String(params.categoryId) } : null),
    },
  });
}