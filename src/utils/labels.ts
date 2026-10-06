import { useTheme } from '@/theme';

/** Meses em pt-BR, começando em janeiro, para os seletores manuais. */
export const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

/** Meses abreviados, para chips e eixos de gráfico. */
export const MONTHS_SHORT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

export function useMonthLabel() {
  const { typography } = useTheme();
  void typography;
  return {
    long: (monthIndex: number) => MONTHS_PT[monthIndex],
    short: (monthIndex: number) => MONTHS_SHORT[monthIndex],
  };
}