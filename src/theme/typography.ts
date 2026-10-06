/**
 * Escala tipográfica — Plus Jakarta Sans.
 *
 * `amount*` usa algarismos tabulares para que colunas de valores alinhem
 * perfeitamente no dígito, requisito básico de tela financeira.
 */

export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const fontSize = {
  display: 34,
  h1: 28,
  h2: 22,
  h3: 18,
  h4: 16,
  body: 15,
  small: 13,
  caption: 12,
  micro: 11,
} as const;

export const lineHeight = {
  display: 40,
  h1: 34,
  h2: 28,
  h3: 24,
  h4: 22,
  body: 22,
  small: 18,
  caption: 16,
  micro: 14,
} as const;

export const letterSpacing = {
  tight: -0.8,
  snug: -0.4,
  normal: 0,
  wide: 0.4,
  caps: 0.9,
} as const;

const tabular = { fontVariant: ['tabular-nums' as const] };

export const typography = {
  /** Saldo em destaque — o primeiro elemento que se vê. */
  display: {
    fontFamily: fontFamily.extraBold,
    fontSize: fontSize.display,
    lineHeight: lineHeight.display,
    letterSpacing: letterSpacing.tight,
  },
  h1: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.h1,
    lineHeight: lineHeight.h1,
    letterSpacing: letterSpacing.snug,
  },
  h2: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.h2,
    lineHeight: lineHeight.h2,
    letterSpacing: letterSpacing.snug,
  },
  h3: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.h3,
    lineHeight: lineHeight.h3,
  },
  h4: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.h4,
    lineHeight: lineHeight.h4,
  },
  body: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
  },
  bodyMedium: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
  },
  bodyStrong: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
  },
  /** Rótulo pequeno em cinza suave. */
  label: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.small,
    lineHeight: lineHeight.small,
  },
  /** Seção de lista: caixa alta espaçada. */
  sectionLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.caption,
    lineHeight: lineHeight.caption,
    letterSpacing: letterSpacing.caps,
    textTransform: 'uppercase' as const,
  },
  caption: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.caption,
    lineHeight: lineHeight.caption,
  },
  micro: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.micro,
    lineHeight: lineHeight.micro,
  },
  amountXl: {
    fontFamily: fontFamily.extraBold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: letterSpacing.tight,
    ...tabular,
  },
  amountLg: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.h1,
    lineHeight: lineHeight.h1,
    letterSpacing: letterSpacing.snug,
    ...tabular,
  },
  amountMd: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.h4,
    lineHeight: lineHeight.h4,
    ...tabular,
  },
  amountSm: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    ...tabular,
  },
} as const;

export type TypographyVariant = keyof typeof typography;
