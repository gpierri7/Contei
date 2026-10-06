import React from 'react';
import { ScrollView, StyleSheet, type ScrollViewProps, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SharedValue } from 'react-native-reanimated';
import { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import { useTheme } from '@/theme';

type ScreenProps = ViewProps &
  ScrollViewProps & {
    safeTop?: boolean;
    safeBottom?: boolean;
    horizontalGutter?: boolean;
    variant?: 'solid' | 'sunken';
    /** Espaço vertical padrão entre blocos filhos. */
    gap?: number;
    /** Recebe o offset do scroll para animar cabeçalhos e barras. */
    onScrollY?: (value: SharedValue<number>) => void;
  };

/**
 * Container de tela padrão.
 *
 * Centraliza áreas seguras e gutter, e cria o `scrollY` compartilhado que
 * cabeçalhos e barras usam para reagir ao scroll sem JS na thread de UI.
 */
export function Screen({
  children,
  safeTop = true,
  safeBottom = true,
  horizontalGutter = true,
  variant = 'solid',
  gap,
  onScrollY,
  style,
  contentContainerStyle,
  ...rest
}: ScreenProps) {
  const { colors, gutter, spacing } = useTheme();

  const scrollY = useSharedValue(0);

  // Entrega o valor para quem precisa; sem isso o `scrollY` ficaria criado e
  // nunca lido, e o efeito de sumir do cabeçalho não aconteceria.
  if (onScrollY) onScrollY(scrollY);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const backgroundColor =
    variant === 'solid' ? colors.background : colors.surfaceSunken;

  return (
    <SafeAreaView
      edges={[
        ...(safeTop ? (['top'] as const) : []),
        ...(safeBottom ? (['bottom'] as const) : []),
      ]}
      style={[styles.root, { backgroundColor }, style]}
    >
      <ScrollView
        contentContainerStyle={[
          {
            backgroundColor,
            paddingTop: safeTop ? spacing.lg : undefined,
            paddingBottom: safeBottom ? spacing.xxl + spacing.lg : undefined,
            paddingHorizontal: horizontalGutter ? gutter : undefined,
            gap: gap ?? spacing.lg,
          },
          contentContainerStyle,
        ]}
        style={[styles.flex, { backgroundColor }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={onScroll}
        {...rest}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Versão sem scroll, para telas com listas/paineis próprios que já cuidam do
 * próprio scroll (ex.: abas com RefreshControl).
 */
export function ScreenStatic({
  children,
  safeTop = true,
  safeBottom = true,
  horizontalGutter = true,
  gap = 0,
  style,
  ...rest
}: Omit<ScreenProps, 'contentContainerStyle'> & { gap?: number }) {
  const { colors, gutter, spacing } = useTheme();

  return (
    <SafeAreaView
      edges={[
        ...(safeTop ? (['top'] as const) : []),
        ...(safeBottom ? (['bottom'] as const) : []),
      ]}
      style={[
        styles.root,
        { backgroundColor: colors.background },
        {
          paddingTop: safeTop ? spacing.lg : undefined,
          paddingBottom: safeBottom ? spacing.xxl + spacing.lg : undefined,
          paddingHorizontal: horizontalGutter ? gutter : undefined,
          gap: gap ?? spacing.lg,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </SafeAreaView>
  );
}

export { ScreenStatic as ScreenContainer };

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
});