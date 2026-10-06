/** Escala de espaçamento em múltiplos de 4. Todo padding do app sai daqui. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
} as const;

/** Espaçamento horizontal padrão do conteúdo das telas. */
export const gutter = spacing.xl;

export type SpacingToken = keyof typeof spacing;
