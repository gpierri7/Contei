export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 28,
  pill: 999,
  /** Cantos do badge de ícone de categoria (quadrado arredondado). */
  iconSm: 12,
  iconMd: 14,
  iconLg: 18,
} as const;

export type RadiusToken = keyof typeof radii;
