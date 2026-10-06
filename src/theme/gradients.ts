import type { LinearGradientProps } from 'expo-linear-gradient';
import { colors } from './colors';

export type GradientStop = { colors: [string, string, ...string[]]; locations?: number[] };

/** Degradê de marca. Botões, FAB, cartão de saldo, toggle ativo. */
export const primaryGradient: GradientStop = {
  colors: [colors.primary, colors.primaryTo],
  locations: [0, 1],
};

/** Degradê do cartão de saldo, com um pouco mais de brilho. */
export const heroGradient: GradientStop = {
  colors: [colors.primaryLight, colors.primary, colors.primaryTo],
  locations: [0, 0.55, 1],
};

/** Brilho diagonal sutil aplicado sobre o cartão de saldo. */
export const heroSheen: LinearGradientProps['colors'] = [
  colors.primarySheen,
  colors.primarySheenSoft,
  'transparent',
];

/** Halo radial do ícone dentro de um badge de categoria. */
export const iconSheen: LinearGradientProps['colors'] = [
  colors.primaryHighlight,
  colors.primarySheenFaint,
];

export const gradientPresets = {
  primary: primaryGradient,
  hero: heroGradient,
} as const;
