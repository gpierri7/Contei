import React from 'react';
import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Feedback';
import { GradientCard } from '@/components/Header';
import { useTheme } from '@/theme';
import { formatCurrency, formatPercent } from '@/utils/currency';
import type { MonthOverview } from '@/services/overview';

/**
 * Cartão herói do mês.
 *
 * Mostra o caixa do mês (o que entrou menos o que saiu) e, logo abaixo, quanto
 * entrou e quanto saiu. Decisão deliberada: o número grande é o caixa, não o
 * "saldo restante do orçamento" — este último empurra a pessoa a controlar a
 * coisa errada e a PUCAR quando estoura.
 */
export function BalanceHero({
  overview,
  monthLabel,
  onIncomePress,
  onExpensePress,
  style,
}: {
  overview: MonthOverview;
  monthLabel: string;
  onIncomePress?: () => void;
  onExpensePress?: () => void;
  style?: ViewProps['style'];
}) {
  const { colors, spacing, typography } = useTheme();

  return (
    <GradientCard style={[{ padding: spacing.xl, gap: spacing.lg }, style]}>
      <View style={styles.row}>
        <Animated.Text style={[typography.label, { color: colors.textOnPrimaryMuted }]}>
          Saldo do mês
        </Animated.Text>
        <Badge
          label={monthLabel}
          icon="calendar"
          style={[styles.badge, { backgroundColor: colors.primaryHighlight }]}
        />
      </View>

      <View style={{ gap: spacing.xs }}>
        <Animated.Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={[typography.amountXl, { color: colors.textOnPrimary }]}
        >
          {signed(overview.balanceCents)}
        </Animated.Text>
        <Animated.Text style={[typography.caption, { color: colors.textOnPrimarySubtle }]}>
          {overview.incomeCents === 0
            ? 'Registre seu primeiro ganho para começar'
            : `${overview.savingsRate >= 0 ? 'Guardando' : 'No vermelho'} ${formatPercent(Math.abs(overview.savingsRate))} da renda`}
        </Animated.Text>
        <Animated.Text style={[typography.micro, { color: colors.textOnPrimarySubtle }]}>
          Saldo = ganhos menos pagamentos feitos no mês. Compras no crédito pendentes ficam fora até pagar a fatura.
        </Animated.Text>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.primaryDivider }]} />

      <View style={styles.rowStats}>
        <StatBlock icon="trendingUp" label="Entrou" cents={overview.incomeCents} onPress={onIncomePress} />
        <View style={[styles.verticalDivider, { backgroundColor: colors.primaryDivider }]} />
        <StatBlock icon="trendingDown" label="Pago" cents={overview.paidCents} onPress={onExpensePress} />
      </View>
    </GradientCard>
  );
}

function StatBlock({
  icon,
  label,
  cents,
  onPress,
}: {
  icon: string;
  label: string;
  cents: number;
  onPress?: () => void;
}) {
  const { colors, typography } = useTheme();

  const content = (
    <View style={styles.statBlock}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={13} color={colors.textOnPrimaryMuted} strokeWidth={2.4} />
        <Animated.Text style={[typography.caption, { color: colors.textOnPrimaryMuted }]}>
          {label}
        </Animated.Text>
      </View>
      <Animated.Text numberOfLines={1} style={[typography.amountMd, { color: colors.textOnPrimary }]}>
        {formatCurrency(Math.abs(cents))}
      </Animated.Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ver detalhes`}
      onPress={onPress}
      style={styles.statPressable}
    >
      {content}
    </Pressable>
  );
}

/** Sinal explícito no saldo: aqui o sinal é a informação principal. */
function signed(cents: number): string {
  const prefix = cents > 0 ? '+' : cents < 0 ? '−' : '';
  return `${prefix}${formatCurrency(Math.abs(cents))}`;
}

/** Faixa de atalhos abaixo do herói. */
export function QuickActions({
  incomeCents,
  expenseCents,
  installmentCents,
  goalCount,
  onIncome,
  onExpense,
  onInstallments,
  onGoals,
}: {
  incomeCents: number;
  expenseCents: number;
  installmentCents: number;
  goalCount: number;
  onIncome: () => void;
  onExpense: () => void;
  onInstallments: () => void;
  onGoals: () => void;
}) {
  const { spacing } = useTheme();

  const items = [
    { label: 'Ganhos', icon: 'wallet', kind: 'money' as const, value: incomeCents, onPress: onIncome, tone: 'income' as const },
    { label: 'Gastos', icon: 'receipt', kind: 'money' as const, value: expenseCents, onPress: onExpense, tone: 'expense' as const },
    { label: 'Parcelas', icon: 'calendarClock', kind: 'money' as const, value: installmentCents, onPress: onInstallments, tone: 'default' as const },
    { label: 'Metas', icon: 'target', kind: 'count' as const, value: goalCount, onPress: onGoals, tone: 'default' as const },
  ];

  return (
    <View style={[styles.tileGrid, { gap: spacing.md }]}>
      {items.map((item, index) => (
        <Animated.View
          key={item.label}
          entering={FadeInDown.delay(index * 55).springify().damping(18)}
          style={styles.quickCell}
        >
          <QuickTile {...item} />
        </Animated.View>
      ))}
    </View>
  );
}

function QuickTile({
  label,
  icon,
  kind,
  value,
  onPress,
  tone,
}: {
  label: string;
  icon: string;
  kind: 'money' | 'count';
  value: number;
  onPress: () => void;
  tone: 'income' | 'expense' | 'default';
}) {
  const { colors, typography, radii, spacing, shadows } = useTheme();

  const accent = {
    income: colors.income,
    expense: colors.expense,
    default: colors.primaryLight,
  }[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          borderRadius: radii.lg,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.82 : 1,
          padding: spacing.md,
          gap: spacing.sm,
        },
        shadows.sm,
      ]}
    >
      <View style={[styles.tileIcon, { borderRadius: radii.sm, backgroundColor: `${accent}1F` }]}>
        <Icon name={icon} size={16} color={accent} strokeWidth={2.2} />
      </View>
      <View style={styles.tileTextWrap}>
        <Animated.Text numberOfLines={1} style={[typography.micro, styles.tileLabel, { color: colors.textTertiary }]}>
          {label}
        </Animated.Text>
        <Animated.Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[typography.amountSm, styles.tileValue, { color: colors.text }]}
        >
          {kind === 'count'
            ? value === 1
              ? '1 ativa'
              : `${value} ativas`
            : formatCurrency(Math.abs(value))}
        </Animated.Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
  },
  rowStats: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  rowIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  verticalDivider: {
    width: StyleSheet.hairlineWidth,
    marginHorizontal: 4,
  },
  statBlock: {
    gap: 4,
    flex: 1,
  },
  statPressable: {
    flex: 1,
  },
  quickCell: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 0,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
  },
  tile: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-start',
    width: '100%',
    overflow: 'hidden',
  },
  tileTextWrap: {
    gap: 1,
    width: '100%',
    minWidth: 0,
    flexShrink: 1,
  },
  tileLabel: {
    flexShrink: 1,
  },
  tileValue: {
    flexShrink: 1,
  },
  tileIcon: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});