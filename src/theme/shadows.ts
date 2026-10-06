import type { ViewStyle } from 'react-native';
import { Platform } from 'react-native';

/**
 * Sombraselevation. No Android, `elevation` faz mais diferença que
 * box-shadow, então cada nível define os dois.
 */
import { colors } from './colors';

export const shadows = {
  none: {},
  sm: Platform.select<ViewStyle>({
    android: { elevation: 2 },
    default: {
      shadowColor: colors.shadow,
      shadowOpacity: 0.24,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
  }),
  md: Platform.select<ViewStyle>({
    android: { elevation: 5 },
    default: {
      shadowColor: colors.shadow,
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
  }),
  lg: Platform.select<ViewStyle>({
    android: { elevation: 10 },
    default: {
      shadowColor: colors.shadow,
      shadowOpacity: 0.36,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
    },
  }),
  /** Halo roxo atrás de elementos flutuantes (FAB, barra de navegação). */
  glow: Platform.select<ViewStyle>({
    android: { elevation: 14 },
    default: {
      shadowColor: colors.primary,
      shadowOpacity: 0.5,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 6 },
    },
  }),
  glowStrong: Platform.select<ViewStyle>({
    android: { elevation: 18 },
    default: {
      shadowColor: colors.primary,
      shadowOpacity: 0.62,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 8 },
    },
  }),
} as const;

export type ShadowToken = keyof typeof shadows;
