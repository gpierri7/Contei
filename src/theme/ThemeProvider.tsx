import React, { createContext, useContext, useMemo } from 'react';
import {
  palettes,
  type ColorSchemeName,
  type Colors,
} from './colors';
import { typography } from './typography';
import { spacing, gutter } from './spacing';
import { radii } from './radii';
import { shadows } from './shadows';
import { duration, easing } from './motion';
import { gradientPresets, heroGradient, heroSheen, iconSheen, primaryGradient } from './gradients';

export type Theme = {
  scheme: ColorSchemeName;
  isDark: boolean;
  colors: Colors;
  spacing: typeof spacing;
  gutter: number;
  radii: typeof radii;
  shadows: typeof shadows;
  typography: typeof typography;
  motion: {
    duration: typeof duration;
    easing: typeof easing;
  };
  gradients: {
    primary: typeof primaryGradient;
    hero: typeof heroGradient;
  };
  sheen: {
    hero: typeof heroSheen;
    icon: typeof iconSheen;
  };
};

const buildTheme = (scheme: ColorSchemeName): Theme => ({
  scheme,
  isDark: scheme === 'dark',
  colors: palettes[scheme],
  spacing,
  gutter,
  radii,
  shadows,
  typography,
  motion: { duration, easing },
  gradients: { primary: gradientPresets.primary, hero: gradientPresets.hero },
  sheen: { hero: heroSheen, icon: iconSheen },
});

type ThemeContextValue = {
  theme: Theme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<ThemeContextValue>(() => ({ theme: buildTheme('dark') }), []);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme precisa estar dentro de <ThemeProvider>');
  return ctx.theme;
}
