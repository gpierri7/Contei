import React, { useEffect } from 'react';
import { StyleSheet, View, type ColorValue, type TextProps, type ViewProps } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Icon } from './Icon';
import { Button } from './Primitives';
import { useTheme } from '@/theme';
import { duration } from '@/theme/motion';
import { formatCurrency } from '@/utils/currency';

const AnimatedView = Animated.createAnimatedComponent(View);

// ---------------------------------------------------------------- EmptyState

type EmptyStateProps = {
  icon: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionIcon?: string;
  onAction?: () => void;
  /** Reduz a decoração em listas curtas. */
  compact?: boolean;
  style?: ViewProps['style'];
};

/**
 * Estado vazio.
 *
 * A regra aqui é: nunca uma tela em branco. O ícone fica num disco com o
 * degradê da marca, e a mensagem convida a uma ação concreta em vez de apenas
 * informar que não há dados.
 */
export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  actionIcon = 'plus',
  onAction,
  compact = false,
  style,
}: EmptyStateProps) {
  const { colors, radii, spacing, typography, shadows } = useTheme();
  const enter = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    enter.value = withTiming(1, { duration: duration.slow });
    pulse.value = withDelay(
      120,
      withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        false
      )
    );
  }, [enter, pulse]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 14 }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const discSize = compact ? 64 : 84;

  return (
    <AnimatedView style={[styles.empty, { paddingVertical: compact ? spacing.xxl : spacing.huge }, enterStyle, style]}>
      <AnimatedView
        style={[
          { width: discSize, height: discSize, borderRadius: radii.pill },
          shadows.glow,
          pulseStyle,
        ]}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radii.pill }]}
        />
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Icon name={icon} size={compact ? 26 : 34} color={colors.textOnPrimary} strokeWidth={1.9} />
        </View>
      </AnimatedView>

      <AnimatedView style={{ alignItems: 'center', maxWidth: 300 }}>
        <Animated.Text
          style={[
            compact ? typography.h4 : typography.h3,
            { color: colors.text, textAlign: 'center' },
          ]}
        >
          {title}
        </Animated.Text>
        <Animated.Text
          style={[
            typography.body,
            { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
          ]}
        >
          {message}
        </Animated.Text>
      </AnimatedView>

      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          icon={actionIcon}
          onPress={onAction}
          size="md"
          style={{ marginTop: spacing.xs }}
        />
      ) : null}
    </AnimatedView>
  );
}

// ---------------------------------------------------------------- Skeleton

type SkeletonProps = ViewProps & {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  /** Número de linhas com largura decrescente, imitando um parágrafo. */
  lines?: number;
};

export function Skeleton({
  width,
  height = 14,
  radius,
  lines,
  style,
  ...rest
}: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <View style={[styles.skeletonLines, { width: width ?? '100%' }]}>
        {Array.from({ length: lines }).map((_, index) => (
          <SkeletonBlock
            key={index}
            height={height}
            width={`${100 - index * 18}%`}
            radius={radius}
          />
        ))}
      </View>
    );
  }

  return (
    <SkeletonBlock
      height={height}
      width={width}
      radius={radius}
      style={style}
      {...rest}
    />
  );
}

/** Bloco pulsante isolado, para que cada linha do skeleton anime sozinha. */
function SkeletonBlock({
  width = '100%',
  height = 14,
  radius,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewProps['style'];
}) {
  const { colors } = useTheme();
  const shimmer = useDerivedValue(() =>
    withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 800, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    ),
    []
  );

  const animatedStyle = useAnimatedStyle(() => ({ opacity: 0.32 + shimmer.value * 0.38 }));

  return (
    <AnimatedView
      style={[
        {
          width,
          height,
          borderRadius: radius ?? 6,
          backgroundColor: colors.fillStrong,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Esqueleto de uma linha de lançamento: ícone, duas linhas de texto, valor. */
export function SkeletonRow() {
  const { spacing, radii } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
      <Skeleton width={44} height={44} radius={radii.iconMd} />
      <View style={{ flex: 1, gap: 7 }}>
        <Skeleton width="55%" height={13} />
        <Skeleton width="35%" height={11} />
      </View>
      <Skeleton width={72} height={16} />
    </View>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonRow key={index} />
      ))}
    </View>
  );
}

export function SkeletonCard() {
  const { colors, spacing, radii } = useTheme();
  return (
    <View
      style={{
        backgroundColor: 'transparent',
        borderRadius: radii.xl,
        padding: spacing.xl,
        gap: spacing.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.borderSubtle,
      }}
    >
      <Skeleton width="40%" height={11} />
      <Skeleton width="65%" height={30} radius={radii.md} />
      <Skeleton height={10} radius={radii.pill} />
    </View>
  );
}

// ---------------------------------------------------------------- Badge

type BadgeProps = {
  label: string;
  tone?: 'neutral' | 'primary' | 'expense' | 'income' | 'warning' | 'info';
  icon?: string;
  size?: 'sm' | 'md';
  style?: ViewProps['style'];
};

export function Badge({ label, tone = 'neutral', icon, size = 'sm', style }: BadgeProps) {
  const { colors, radii, typography, spacing } = useTheme();

  const map = {
    neutral: { bg: colors.fill, fg: colors.textSecondary },
    primary: { bg: colors.primaryDim, fg: colors.primaryLight },
    expense: { bg: colors.expenseDim, fg: colors.expense },
    income: { bg: colors.incomeDim, fg: colors.income },
    warning: { bg: colors.warningDim, fg: colors.warning },
    info: { bg: colors.infoDim, fg: colors.info },
  } as const;

  const { bg, fg } = map[tone];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderRadius: radii.pill,
          paddingHorizontal: size === 'sm' ? spacing.sm : spacing.md,
          paddingVertical: size === 'sm' ? 3 : 6,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 11 : 13} color={fg} strokeWidth={2.4} /> : null}
      <Animated.Text
        numberOfLines={1}
        style={[size === 'sm' ? typography.micro : typography.caption, { color: fg }]}
      >
        {label}
      </Animated.Text>
    </View>
  );
}

// ---------------------------------------------------------------- Divider

export function Divider({ style }: { style?: ViewProps['style'] }) {
  const { colors } = useTheme();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider }, style]} />;
}

// ---------------------------------------------------------------- Amount

type AmountProps = {
  cents: number;
  variant?: 'xl' | 'lg' | 'md' | 'sm';
  tone?: 'default' | 'expense' | 'income' | 'muted' | 'inverse';
  /** Cor explícita, que vence a resolução por `tone`. */
  color?: ColorValue;
  /** Prefixo explícito, ex.: "-" ou "+". Sobrescreve o sinal automático. */
  sign?: 'auto' | 'none' | 'always';
  style?: TextProps['style'];
};

/**
 * Valor monetário.
 *
 * A cor padrão já é semântica: negativo sai em vermelho, positivo em verde.
 * Assim nenhuma tela precisa lembrar de pintar o número.
 */
export function Amount({
  cents,
  variant = 'md',
  tone = 'default',
  color: colorOverride,
  sign = 'auto',
  style,
}: AmountProps) {
  const { typography, colors } = useTheme();

  const resolvedTone =
    tone !== 'default'
      ? tone
      : cents < 0
        ? 'expense'
        : cents > 0
          ? 'income'
          : 'muted';

  const semanticColor = {
    expense: colors.expense,
    income: colors.income,
    muted: colors.textTertiary,
    default: colors.text,
    inverse: colors.textOnPrimary,
  }[resolvedTone];

  const prefix =
    sign === 'always' ? '+' : sign === 'auto' && cents > 0 ? '+' : cents < 0 ? '-' : '';

  const typeStyle = {
    xl: typography.amountXl,
    lg: typography.amountLg,
    md: typography.amountMd,
    sm: typography.amountSm,
  }[variant];

  return (
    <Animated.Text numberOfLines={1} style={[typeStyle, { color: colorOverride ?? semanticColor }, style]}>
      {`${prefix}${formatCurrency(Math.abs(cents))}`}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  skeletonLines: {
    gap: 8,
  },
  empty: {
    alignItems: 'center',
    gap: 20,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
});
