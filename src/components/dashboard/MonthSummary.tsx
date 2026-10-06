import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Badge } from '@/components/ui/Feedback';
import { ProgressBar } from '@/components/ui/Inputs';
import { useTheme } from '@/theme';
import { formatCurrency, formatPercent } from '@/utils/currency';
import { limitColorFor } from '@/theme/colors';

/**
 * Cartão de resumo mensal para Ganhos e Gastos.
 *
 * A barra compara o total do mês com a renda, não com um limite arbitrário: o
 * app não tem "orçamento" como conceito, tem "quanto entrou". Isso mantém a
 * leitura honesta — 60% da renda é um dado, não um julgamento.
 */
export function MonthSummary({
  title,
  totalCents,
  incomeCents,
  monthProgress,
  caption,
  loading = false,
  palette,
  style,
}: {
  title: string;
  totalCents: number;
  incomeCents: number;
  /** 0 a 1: fração do mês já decorrida. */
  monthProgress: number;
  caption?: string;
  loading?: boolean;
  /** Inverte a escala para gastos (vermelho ao estourar). */
  inverted?: boolean;
  palette?: readonly [string, string];
  children?: React.ReactNode;
} & Pick<ViewProps, 'style'>) {
  const { colors, typography, radii, spacing } = useTheme();

  const share = incomeCents > 0 ? totalCents / incomeCents : 0;
  const barColor = limitColorFor(share);

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: radii.xl,
          padding: spacing.xl,
          gap: spacing.md,
          borderColor: colors.navBorder,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={palette ?? colors.summaryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radii.xl }]}
      />
      <LinearGradient
        colors={[colors.primarySheenSoft, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radii.xl }]}
        pointerEvents="none"
      />

      <View style={styles.row}>
        <Animated.Text style={[typography.label, { color: colors.textOnPrimarySubtle }]}>
          {title}
        </Animated.Text>
        {incomeCents > 0 ? (
          <Badge
            label={formatPercent(share)}
            tone={share >= 1 ? 'expense' : share >= 0.8 ? 'warning' : 'neutral'}
          />
        ) : null}
      </View>

      <Animated.Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={[typography.amountXl, { color: colors.textOnPrimary }]}
      >
        {loading ? '—' : formatCurrency(totalCents)}
      </Animated.Text>

      {incomeCents > 0 ? (
        <>
          <ProgressBar ratio={share} color={barColor} height={8} trackColor={colors.fillStrong} />
          <Animated.Text style={[typography.caption, { color: colors.textOnPrimaryFaint }]}>
            {caption ?? `${formatPercent(share)} de ${formatCurrency(incomeCents)} que entraram`}
          </Animated.Text>
        </>
      ) : (
        <Animated.Text style={[typography.caption, { color: colors.textOnPrimaryFaint }]}>
          {caption ?? 'Registre sua renda para comparar'}
        </Animated.Text>
      )}
    </View>
  );
}

/** Faixa de aviso para contas fixas pendentes. */
export function PendingNotice({ amountCents, onPress }: { amountCents: number; onPress?: () => void }) {
  const { colors, radii, spacing, typography } = useTheme();

  if (amountCents <= 0) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[
        styles.row,
        {
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderRadius: radii.md,
          backgroundColor: colors.warningDim,
        },
      ]}
    >
      <PendingIcon />
      <Animated.Text numberOfLines={2} style={[typography.caption, styles.flex, { color: colors.warning }]}>
        {formatCurrency(amountCents)} em contas fixas ainda não pagas
      </Animated.Text>
    </Animated.View>
  );
}

function PendingIcon() {
  const { colors } = useTheme();
  return <Animated.View style={[styles.pendingDot, { backgroundColor: colors.warning }]} />;
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
});