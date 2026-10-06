/**
 * Datas.
 *
 * Internamente tudo é epoch em milissegundos. As chaves de mês são strings
 * "AAAA-MM" porque são o índice natural de quase toda consulta mensal.
 */

export type MonthKey = string; // "2026-10"

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** "2026-10-15" (local, sem tropeçar em fuso) -> epoch ms. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function monthKeyOf(date: Date | number): MonthKey {
  const d = typeof date === 'number' ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const currentMonthKey = (): MonthKey => monthKeyOf(new Date());

/** Início (00:00 local) do mês da chave. */
export function monthStart(month: MonthKey): Date {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

/** Fim exclusivo do mês (00:00 do mês seguinte) — ideal para `date < limite`. */
export function monthEndExclusive(month: MonthKey): Date {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 1);
}

/** Soma meses a uma chave, preservando o dia 1. */
export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyOf(d);
}

export function shiftMonthKey(delta: number): MonthKey {
  return addMonths(currentMonthKey(), delta);
}

/** "outubro de 2026" */
export function formatMonthLabel(month: MonthKey, { short = false } = {}): string {
  const [y, m] = month.split('-').map(Number);
  const name = MONTH_NAMES[m - 1] ?? '';
  if (short) return `${name.slice(0, 3)}. ${y}`;
  return `${name} de ${y}`;
}

/** "15/10" ou "15/10/2026" */
export function formatDateShort(timestamp: number, { withYear = false } = {}): string {
  const d = new Date(timestamp);
  const base = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return withYear ? `${base}/${d.getFullYear()}` : base;
}

/** "15 de out" */
export function formatDateDayMonth(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getDate()} de ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
}

/** "hoje", "amanhã", "há 3 dias", "em 5 dias", "12/10". */
export function formatRelativeDay(timestamp: number): string {
  const target = startOfDay(timestamp);
  const today = startOfDay(Date.now());
  const diff = Math.round((target - today) / 86_400_000);

  if (diff === 0) return 'hoje';
  if (diff === 1) return 'amanhã';
  if (diff === -1) return 'ontem';
  if (diff === 2) return 'depois de amanhã';
  if (diff > 0 && diff <= 7) return `em ${diff} dias`;
  if (diff < 0 && diff >= -7) return `há ${Math.abs(diff)} dias`;
  if (diff < 0) return `atrasado há ${Math.abs(diff)} dias`;
  return formatDateShort(timestamp);
}

export function startOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const isToday = (timestamp: number): boolean => startOfDay(timestamp) === startOfDay(Date.now());

export const daysInMonth = (month: MonthKey): number => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

export const monthLabelShort = (month: MonthKey): string => {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)}. ${String(y).slice(2)}`;
};

export const weekdayName = (index: number): string => WEEKDAYS[index] ?? '';

export const monthName = (index: number): string => MONTH_NAMES[index] ?? '';

/** Constroi uma data no dia X de um mês, sem transbordar para o mês seguinte. */
export function dateInMonth(month: MonthKey, day: number): Date {
  const [y, m] = month.split('-').map(Number);
  const max = new Date(y, m, 0).getDate();
  return new Date(y, m - 1, Math.min(Math.max(1, day), max));
}

/** Lista de N meses terminando no mês informado, do mais antigo ao mais novo. */
export function recentMonths(count: number, endMonth: MonthKey = currentMonthKey()): MonthKey[] {
  return Array.from({ length: count }, (_, i) => addMonths(endMonth, i - (count - 1)));
}

/** Início do dia (epoch) a partir de ano/mês/dia. */
export const atDay = (year: number, month: number, day: number): number =>
  new Date(year, month, day, 0, 0, 0, 0).getTime();
