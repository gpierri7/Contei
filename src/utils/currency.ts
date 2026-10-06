/**
 * Dinheiro.
 *
 * Todo valor monetário é persistido e manipulado em CENTAVOS (inteiro).
 * Somar `0.1 + 0.2` em ponto flutuante e esperar `0.3` é a origem clássica de
 * erro em app de dinheiro; com inteiro isso não existe. A conversão para
 * real acontece só na fronteira de exibição e de entrada do usuário.
 */

/** Formata centavos como moeda brasileira: 123456 -> "R$ 1.234,56". */
export function formatCurrency(
  cents: number,
  options: { showSymbol?: boolean; showCents?: boolean; sign?: boolean } = {}
): string {
  const { showSymbol = true, showCents = true, sign = false } = options;
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));

  const reais = Math.floor(abs / 100);
  const centavos = abs % 100;

  const grouped = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const body = showCents ? `${grouped},${String(centavos).padStart(2, '0')}` : grouped;

  const symbol = showSymbol ? 'R$ ' : '';
  const signPrefix = negative ? '-' : sign ? '+' : '';
  return `${signPrefix}${symbol}${body}`;
}

/** Atalho para contexto de coluna, onde o símbolo já está no cabeçalho. */
export const formatAmount = (cents: number): string => formatCurrency(cents, { showSymbol: false });

/**
 * Formato compacto para cartões e eixos: R$ 1,2 mil / R$ 34,5 mil.
 * Mantém a escala legível quando o valor não cabe em poucas casas.
 */
export function formatCompactCurrency(cents: number): string {
  const abs = Math.abs(cents);
  const negative = cents < 0;
  if (abs >= 100_000_000) return `${negative ? '-' : ''}R$ ${(abs / 100_000_000).toFixed(1)} mi`;
  if (abs >= 100_000) return `${negative ? '-' : ''}R$ ${(abs / 100_000).toFixed(1)} mil`;
  return formatCurrency(cents);
}

/** "R$ 1.234,56" / "1234,56" / "1234.56" / "25" -> 123456 centavos. */
export function parseCurrencyToCents(input: string): number {
  let s = input.trim();
  if (!s) return 0;

  s = s.replace(/[^\d,.-]/g, '');

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    // O separador decimal é o que aparece por último.
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    s = s.replace(/\./g, '').replace(',', '.');
  }

  const value = Number.parseFloat(s);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

/**
 * Converte o que o teclado numérico digita para centavos, treating a vírgula
 * como separador decimal e ignorando qualquer coisa que não seja dígito.
 * "1.2,5" digitado rápido vira 125 centavos, não 1 centavo.
 */
export function digitsToCents(digits: string): number {
  const clean = digits.replace(/\D/g, '');
  if (!clean) return 0;
  return Number.parseInt(clean, 10);
}

/** 123456 centavos -> "123456", para alimentar o teclado. */
export const centsToDigits = (cents: number): string => String(Math.round(Math.abs(cents)));

/** Percentual formatado para exibição, sem ruído de casa decimal. */
export function formatPercent(ratio: number, withCents = false): string {
  const pct = ratio * 100;
  if (!Number.isFinite(pct)) return '0%';
  if (withCents) return `${pct.toFixed(1).replace('.', ',')}%`;
  return `${Math.round(pct)}%`;
}
