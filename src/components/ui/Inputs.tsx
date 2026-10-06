import React, { useCallback, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Icon } from './Icon';
import { useTheme } from '@/theme';
import { duration, easing } from '@/theme/motion';
import { limitColorFor } from '@/theme/colors';
import { formatCurrency, formatPercent } from '@/utils/currency';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---------------------------------------------------------------- Segmented

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Contador opcional exibido à direita do rótulo. */
  badge?: string;
};

type SegmentedProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  fullWidth?: boolean;
  style?: ViewProps['style'];
};

/**
 * Alternador em pílula. O indicador ativo é uma View que desliza sob os
 * rótulos, em vez de trocar a cor de fundo — o movimento é o que faz a troca
 * de aba parecer uma navegação e não um piscar.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  fullWidth = true,
  style,
}: SegmentedProps<T>) {
  const { colors, radii, typography, shadows } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const translate = useSharedValue(0);

  // A largura do segmento é consequência direta da largura medida — guardá-la
  // em estado criaria um segundo render a cada resize sem adicionar informação.
  const segmentWidth = options.length > 0 ? width / options.length : 0;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  React.useEffect(() => {
    if (!segmentWidth) return;
    // Deslocamento do indicador para a aba selecionada.
    translate.value = withSpring(index * segmentWidth, easing.spring);
  }, [index, segmentWidth, translate]);

  const indicatorStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: translate.value }],
  }));

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.segmentedTrack,
        { backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, padding: 3, borderColor: colors.border },
        fullWidth && { alignSelf: 'stretch' },
        style,
      ]}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          style={[
            styles.segmentedIndicator,
            indicatorStyle,
            { borderRadius: radii.pill, ...shadows.sm },
          ]}
        >
          <LinearGradient
            colors={[colors.primaryLight, colors.primaryTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, { borderRadius: radii.pill }]}
          />
        </Animated.View>
      ) : null}

      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={styles.segmentedItem}
          >
            <Animated.Text
              numberOfLines={1}
              style={[
                typography.bodyStrong,
                { color: active ? colors.textOnPrimary : colors.textSecondary },
              ]}
            >
              {option.label}
            </Animated.Text>
            {option.badge ? (
              <View
                style={[
                  styles.segmentedBadge,
                  {
                    backgroundColor: active ? colors.primaryHighlight : colors.fillStrong,
                  },
                ]}
              >
                <Animated.Text
                  style={[
                    typography.micro,
                    { color: active ? colors.textOnPrimary : colors.textTertiary },
                  ]}
                >
                  {option.badge}
                </Animated.Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export const PillToggle = Segmented;

// ---------------------------------------------------------------- Input

type InputProps = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  icon?: string;
  /** Prefixo visual, ex.: "R$" no campo de valor. */
  prefix?: string;
  suffix?: string;
  onClear?: () => void;
};

export function Input({
  label,
  hint,
  error,
  icon,
  prefix,
  suffix,
  onClear,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
  style,
  value,
  multiline,
  ...rest
}: InputProps) {
  const { colors, radii, spacing, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);

  // A borda anima com o teclado, então a cor precisa vir do `useAnimatedStyle`
  // (a cor estática do `borderColor` nativo seria sobrescrita aqui de qualquer
  // forma).
  const animatedContainer = useAnimatedStyle(() => ({
    borderWidth: 1 + focus.value,
    borderColor: error ? colors.expense : colors.primary,
  }));

  return (
    <View style={{ gap: spacing.sm }}>
      {label ? (
        <Animated.Text style={[typography.label, { color: colors.textSecondary }]}>{label}</Animated.Text>
      ) : null}

      <Animated.View
        style={[
          styles.inputContainer,
          animatedContainer,
          {
            backgroundColor: colors.surfaceAlt,
            borderRadius: radii.md,
            minHeight: multiline ? 96 : 54,
            alignItems: multiline ? 'flex-start' : 'center',
            paddingVertical: multiline ? spacing.md : 0,
          },
        ]}
      >
        {icon ? <Icon name={icon} size={18} color={focused ? colors.primaryLight : colors.textTertiary} /> : null}
        {prefix ? (
          <Animated.Text
            style={[
              typography.bodyStrong,
              { color: colors.textSecondary, marginRight: 2 },
            ]}
          >
            {prefix}
          </Animated.Text>
        ) : null}

        <TextInput
          value={value}
          multiline={multiline}
          keyboardAppearance="dark"
          style={[styles.textInput, { color: colors.text }, style]}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.primaryLight}
          onFocus={(event) => {
            setFocused(true);
            focus.value = withTiming(1, { duration: duration.fast });
            onFocusProp?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            focus.value = withTiming(0, { duration: duration.fast });
            onBlurProp?.(event);
          }}
          {...rest}
        />

        {onClear && value && value.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Limpar"
            onPress={onClear}
            hitSlop={8}
            style={({ pressed }) => [styles.clear, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon name="close" size={15} color={colors.textTertiary} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </Animated.View>

      {hint || error ? (
        <Animated.Text
          style={[
            typography.caption,
            { color: error ? colors.expense : colors.textTertiary },
          ]}
        >
          {error ?? hint}
        </Animated.Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- ProgressBar

type ProgressBarProps = {
  /** 0 a 1. Valores acima de 1 sao aceitos e saturam. */
  ratio: number;
  height?: number;
  /** Cor fixa; se omitida, usa a cor contextual do limite. */
  color?: string;
  animate?: boolean;
  trackColor?: string;
  style?: ViewProps['style'];
  showOverflowIndicator?: boolean;
};

/**
 * Barra de progresso.
 *
 * A cor muda sozinha conforme o quanto foi preenchido: verde fechado, roxo no
 * meio, vermelho estourado. Quem olha para a barra precisa saber em um olhar se
 * está indo bem, sem ler o numero.
 */
export function ProgressBar({
  ratio,
  height = 10,
  color,
  animate = true,
  trackColor,
  style,
  showOverflowIndicator = true,
}: ProgressBarProps) {
  const { colors } = useTheme();
  const progress = useSharedValue(animate ? 0 : clampRatio(ratio));

  const clamped = clampRatio(ratio);
  const resolved = color ?? limitColorFor(clamped);

  React.useEffect(() => {
    progress.value = animate
      ? withTiming(clamped, { duration: duration.slow })
      : clamped;
  }, [clamped, animate, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, progress.value)) * 100}%`,
    backgroundColor: resolved,
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ now: Math.round(ratio * 100), min: 0, max: 100 }}
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: trackColor ?? colors.surfaceAlt },
        style,
      ]}
    >
      <Animated.View style={[styles.fill, trackStyle]} />

      {showOverflowIndicator && ratio > 1 ? (
        <View
          style={[
            styles.overflow,
            { backgroundColor: colors.expense, left: '100%', marginLeft: -3 },
          ]}
        />
      ) : null}
    </View>
  );
}

const clampRatio = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);

/** "R$ 800 de R$ 1.000" — o contexto que a barra sozinha não dá. */
export function ProgressLabel({
  savedCents,
  targetCents,
  caption,
}: {
  savedCents: number;
  targetCents: number;
  caption?: string;
}) {
  const { colors, typography } = useTheme();
  const ratio = targetCents > 0 ? savedCents / targetCents : 0;
  const remaining = Math.max(0, targetCents - savedCents);

  return (
    <View style={styles.progressLabel}>
      <Animated.Text style={[typography.caption, { color: colors.text }]}>
        {`${formatCurrency(savedCents)} de ${formatCurrency(targetCents)}`}
      </Animated.Text>
      <Animated.Text style={[typography.caption, { color: limitColorFor(ratio) }]}>
        {formatPercent(ratio)}
      </Animated.Text>
      {caption ? (
        <Animated.Text style={[typography.micro, { color: colors.textTertiary }]}>{caption}</Animated.Text>
      ) : remaining > 0 ? (
        <Animated.Text style={[typography.micro, { color: colors.textTertiary }]}>
          {`Faltam ${formatCurrency(remaining)}`}
        </Animated.Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- Chip

type ChipProps = {
  label: string;
  selected?: boolean;
  icon?: string;
  disabled?: boolean;
  onPress?: () => void;
  style?: ViewProps['style'];
};

/** Pílula selecionável, usada em filtros e no seletor de método de pagamento. */
export function Chip({ label, selected = false, icon, disabled, onPress, style }: ChipProps) {
  const { colors, typography, radii, spacing } = useTheme();
  const scale = useSharedValue(1);

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      accessibilityLabel={label}
      disabled={disabled || !onPress}
      onPress={onPress}
      onPressIn={() => {
        // eslint-disable-next-line react-hooks/immutability -- SharedValue do Reanimated e mutavel por design
        scale.value = withTiming(0.95, { duration: duration.instant });
      }}
      onPressOut={() => {
        // eslint-disable-next-line react-hooks/immutability -- SharedValue do Reanimated e mutavel por design
        scale.value = withSpring(1, easing.spring);
      }}
      style={[
        styles.chip,
        scaleStyle,
        {
          borderRadius: radii.pill,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.xs,
          backgroundColor: selected ? colors.primaryDim : colors.surface,
          borderColor: selected ? colors.primaryBorder : colors.border,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      {icon ? (
        <Icon
          name={icon}
          size={14}
          color={selected ? colors.primaryLight : colors.textTertiary}
          strokeWidth={2.2}
        />
      ) : null}
      <Animated.Text
        style={[
          typography.caption,
          { color: selected ? colors.text : colors.textTertiary },
        ]}
      >
        {label}
      </Animated.Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  segmentedTrack: {
    flexDirection: 'row',
    position: 'relative',
    borderWidth: StyleSheet.hairlineWidth,
  },
  segmentedItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    gap: 2,
  },
  segmentedIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    overflow: 'hidden',
  },
  segmentedBadge: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  textInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
  },
  clear: {
    padding: 3,
  },
  track: {
    width: '100%',
    overflow: 'visible',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  overflow: {
    position: 'absolute',
    top: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  progressLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});