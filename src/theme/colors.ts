/**
 * Paleta Contei.
 *
 * Paleta única do app. A interface permanece escura independentemente do
 * esquema escolhido no sistema operacional.
 */

const darkPalette = {
  // Superfícies
  background: '#0F0D1A',
  backgroundElevated: '#151223',
  surface: '#1A1727',
  surfaceAlt: '#221F33',
  surfaceSunken: '#0B0914',
  overlay: 'rgba(8, 6, 16, 0.72)',

  // Marca
  primary: '#6C3FD1',
  primaryTo: '#4F46E5',
  primaryLight: '#9B7BFF',
  primaryDim: 'rgba(108, 63, 209, 0.16)',
  primaryBorder: 'rgba(155, 123, 255, 0.32)',
  primarySheen: 'rgba(255, 255, 255, 0.16)',
  primarySheenSoft: 'rgba(255, 255, 255, 0.03)',
  primarySheenFaint: 'rgba(255, 255, 255, 0.04)',
  primaryHighlight: 'rgba(255, 255, 255, 0.22)',
  primaryDivider: 'rgba(255, 255, 255, 0.14)',

  // Texto
  text: '#FFFFFF',
  textSecondary: '#A09BB5',
  textTertiary: '#6E6982',
  textOnPrimary: '#FFFFFF',
  textOnPrimaryMuted: 'rgba(255, 255, 255, 0.78)',
  textOnPrimarySubtle: 'rgba(255, 255, 255, 0.72)',
  textOnPrimaryFaint: 'rgba(255, 255, 255, 0.62)',

  // Semântica financeira
  expense: '#FF4D5E',
  expenseDim: 'rgba(255, 77, 94, 0.14)',
  income: '#3DDC97',
  incomeDim: 'rgba(61, 220, 151, 0.14)',
  warning: '#FFC247',
  warningDim: 'rgba(255, 194, 71, 0.14)',
  warningStrong: '#F5A524',
  warningMid: '#E8A33D',
  info: '#54B8FF',
  infoDim: 'rgba(84, 184, 255, 0.14)',

  // Estrutura
  shadow: '#000000',
  border: 'rgba(255, 255, 255, 0.06)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
  borderSubtle: 'rgba(255, 255, 255, 0.04)',
  divider: 'rgba(255, 255, 255, 0.05)',

  // Preenchimento neutro (track de barras, skeletons, etc.)
  fill: 'rgba(255, 255, 255, 0.04)',
  fillStrong: 'rgba(255, 255, 255, 0.08)',

  // Navegação flutuante
  navBackground: 'rgba(26, 23, 39, 0.92)',
  navBorder: 'rgba(255, 255, 255, 0.08)',

  // Gradientes de resumo por tipo de conteúdo
  incomeGradient: ['#132B22', '#101C2E'],
  expenseGradient: ['#2A1420', '#1B1024'],
  reportGradient: ['#1B1330', '#0F1B2E'],
  summaryGradient: ['#241436', '#1B1030'],
} as const;

export type ColorSchemeName = 'dark';
export type Colors = typeof darkPalette;

export const palettes: Record<ColorSchemeName, Colors> = {
  dark: darkPalette,
};

export const colors = palettes.dark;

/**
 * Cores atribuíveis a categorias. Deliberadamente distintas entre si para que
 * um donut com 6 fatias continue legível — e nenhuma delas é o roxo da marca,
 * que fica reservado para superfícies e dados.
 */
export const categoryColors = [
  '#FF6B6B',
  '#FFA94D',
  '#FFD43B',
  '#63E6BE',
  '#4DABF7',
  '#9775FA',
  '#F783AC',
  '#20C997',
  '#748FFC',
  '#E599F7',
  '#94D82D',
  '#FF922B',
] as const;

/** Cores de fontes de renda — tom verde-menta para não competir com o roxo. */
export const incomeSourceColors = [
  '#3DDC97',
  '#4DABF7',
  '#63E6BE',
  '#94D82D',
  '#20C997',
  '#54B8FF',
] as const;

export const investmentColors = [
  '#3DDC97',
  '#4DABF7',
  '#63E6BE',
  '#FFA94D',
  '#FF6B6B',
  '#9775FA',
  '#F783AC',
] as const;

/**
 * Cor da barra de limite por percentual consumido. Interpolado no serviço de
 * progresso para que a virada de faixa seja contínua, não um degrau.
 */
export const limitColorFor = (ratio: number): string => {
  if (ratio >= 1) return darkPalette.expense;
  if (ratio >= 0.8) return darkPalette.warning;
  if (ratio >= 0.5) return darkPalette.warningMid;
  return darkPalette.primaryLight;
};
