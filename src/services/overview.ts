import type { PaymentMethod } from '@/database/types';

export interface TransactionListItem {
  id: number;
  kind: 'income' | 'expense';
  title: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  amountCents: number;
  date: number;
  method: PaymentMethod | null;
  /** Preenchido quando o lançamento veio de um template fixo ou de uma parcela. */
  origin: 'variable' | 'fixed' | 'installment';
  isPaid: boolean;
  groupId?: string;
}

export interface MonthOverview {
  monthKey: string;
  incomeCents: number;
  fixedCents: number;
  variableCents: number;
  installmentCents: number;
  totalCents: number;
  /** Pagamentos efetivados no mês, sem compras no crédito ainda pendentes. */
  paidCents: number;
  balanceCents: number;
  /** Fração do mês já decorrida, base para a projeção e o "ritmo". */
  monthProgress: number;
  /** Saldo projetado para o fim do mês no ritmo atual. */
  projectedCents: number;
  fixedPaidCents: number;
  fixedPendingCents: number;
  savingsRate: number;
}

export interface CategorySlice {
  categoryId: number;
  name: string;
  color: string;
  icon: string;
  totalCents: number;
  share: number;
  count: number;
}

export interface MonthPoint {
  monthKey: string;
  label: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
}

/**
 * Ritmo de gasto contra a renda.
 *
 * 1 = gastando exatamente na proporção do mês que já passou. Acima de 1 a
 * pessoa está queimando mais rápido do que ganha. O `safe` evita divisão por
 * mês sem renda, que retornaria infinito e pintaria a barra inteira de vermelho.
 */
export function burnRatio(overview: MonthOverview): number {
  const committed = overview.incomeCents * overview.monthProgress;
  if (committed <= 0) return 0;
  return overview.totalCents / committed;
}