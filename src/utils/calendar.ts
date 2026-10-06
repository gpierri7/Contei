import { MONTHS_SHORT } from './labels';

/**
 * Constrói uma matriz de semanas (domingo → sábado) para o mês informado.
 * Células vazias no começo/fim viram `null` para o calendário não dessem
 * alinhar as colunas.
 */
export function buildMonthGrid(year: number, monthIndex: number): (string | null)[][] {
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells: (string | null)[] = Array(firstWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${pad(monthIndex + 1)}-${pad(day)}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Rótulo do cabeçalho, ex.: "Março 2026". */
export function monthTitle(year: number, monthIndex: number): string {
  return `${MONTHS_SHORT[monthIndex]} ${year}`;
}

const pad = (n: number) => String(n).padStart(2, '0');