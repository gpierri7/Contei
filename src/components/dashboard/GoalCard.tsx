import React from 'react';
import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/Inputs';
import { useTheme } from '@/theme';
import { formatCurrency, formatPercent } from '@/utils/currency';
import { formatDateShort } from '@/utils/date';

/** Título de bloco com ação opcional à direita. */
export function SectionTitle({
  title,
  actionLabel,
  onAction,
  subtitle,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  subtitle?: string;
  style?: ViewProps['style'];
}) {
  const { colors, typography, spacing } = useTheme();

  return (
    <View
      style={[
        styles.row,
        { paddingHorizontal: spacing.xs, paddingBottom: spacing.xs },
        style,
      ]}
    >
      <View style={styles.flex}>
        <Animated.Text style={[typography.h4, { color: colors.text }]}>{title}</Animated.Text>
        {subtitle ? (
          <Animated.Text style={[typography.caption, { color: colors.textTertiary }]}>
            {subtitle}
          </Animated.Text>
        ) : null}
      </View>

      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Animated.Text style={[typography.label, { color: colors.primaryLight }]}>
            {actionLabel}
          </Animated.Text>
          <Icon name="chevronRight" size={14} color={colors.primaryLight} strokeWidth={2.6} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Cartão de meta.
 *
 * Mostra o progresso e o que falta, não só a porcentagem: "falta R$ 240" é
 * acionável, "68%" não é.
 */
export function GoalCard({
  name,
  color,
  icon,
  savedCents,
  targetCents,
  ratio,
  deadline,
  onPress,
  style,
}: {
  name: string;
  color: string;
  icon: string;
  savedCents: number;
  targetCents: number;
  ratio: number;
  deadline: number | null;
  onPress?: () => void;
  style?: ViewProps['style'];
}) {
  const { colors, typography, radii, spacing, shadows } = useTheme();

  const done = ratio >= 1;
  const remaining = Math.max(0, targetCents - savedCents);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${formatPercent(ratio)} concluído`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          borderRadius: radii.lg,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.md,
          opacity: pressed ? 0.85 : 1,
        },
        shadows.sm,
        style,
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.icon, { borderRadius: radii.sm, backgroundColor: `${color}1F` }]}>
          <Icon name={icon} size={17} color={color} strokeWidth={2.2} />
        </View>

        <View style={styles.flex}>
          <Animated.Text numberOfLines={1} style={[typography.bodyStrong, { color: colors.text }]}>
            {name}
          </Animated.Text>
          <Animated.Text numberOfLines={1} style={[typography.caption, { color: colors.textTertiary }]}>
            {deadline ? `até ${formatDateShort(deadline, { withYear: true })}` : 'sem prazo'}
          </Animated.Text>
        </View>

        <Animated.Text style={[typography.bodyStrong, { color }]}>{formatPercent(ratio)}</Animated.Text>
      </View>

      <ProgressBar ratio={ratio} color={done ? colors.income : color} height={8} />

      <View style={[styles.row, styles.spread]}>
        <Animated.Text style={[typography.caption, { color: colors.textSecondary }]}>
          {formatCurrency(savedCents)}
        </Animated.Text>
        <Animated.Text style={[typography.caption, { color: done ? colors.income : colors.textTertiary }]}>
          {done ? 'Meta batida!' : `faltam ${formatCurrency(remaining)}`}
        </Animated.Text>
      </View>
    </Pressable>
  );
}

/** Filtro de período, usado no topo de Ganhos, Gastos e Relatórios. */
export function PeriodFilter({
  value,
  onChange,
  options,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  style?: ViewProps['style'];
}) {
  const { colors, typography, radii, spacing } = useTheme();

  return (
    <View style={[styles.row, { gap: spacing.sm }, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[
              styles.pill,
              {
                borderRadius: radii.pill,
                paddingHorizontal: spacing.lg,
                paddingVertical: 8,
                backgroundColor: active ? colors.primary : colors.surfaceAlt,
                borderColor: active ? 'transparent' : colors.border,
              },
            ]}
          >
            <Animated.Text
              style={[
                typography.label,
                { color: active ? colors.textOnPrimary : colors.textSecondary },
              ]}
            >
              {option.label}
            </Animated.Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spread: {
    justifyContent: 'space-between',
  },
  flex: {
    flex: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});