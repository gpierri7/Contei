import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Icon } from './Icon';
import { useTheme } from '@/theme';
import { duration, easing } from '@/theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

// ---------------------------------------------------------------- Card

type CardProps = ViewProps & {
  /** Preenche com o degradê de marca (cartão de saldo). */
  variant?: 'surface' | 'primary' | 'ghost';
  padding?: number;
  radius?: number;
  glow?: boolean;
  /** Linha de brilho diagonal no topo — dá profundidade ao degradê. */
  sheen?: boolean;
};

export function Card({
  variant = 'surface',
  padding,
  radius,
  glow = false,
  sheen = false,
  style,
  children,
  ...rest
}: CardProps) {
  const { colors, radii, shadows, spacing, gradients, sheen: themeSheen } = useTheme();
  const r = radius ?? radii.xl;
  const p = padding ?? spacing.xl;

  const base = [
    styles.card,
    { borderRadius: r, padding: p, borderWidth: StyleSheet.hairlineWidth },
    variant === 'surface' && {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      ...shadows.sm,
    },
    variant === 'ghost' && { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
    variant === 'primary' && { backgroundColor: colors.primary, borderColor: colors.primaryBorder },
    glow && shadows.glow,
    style,
  ];

  if (variant !== 'primary') {
    return (
      <View style={base} {...rest}>
        {children}
      </View>
    );
  }

  return (
    <AnimatedGradient
      colors={gradients.hero.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, { borderRadius: r, padding: p, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.primaryBorder }, glow && shadows.glowStrong, style]}
      {...(rest as Record<string, unknown>)}
    >
      {sheen ? (
        <LinearGradient
          colors={themeSheen.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: r }]}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </AnimatedGradient>
  );
}

// ---------------------------------------------------------------- Button

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  iconRight?: string;
  loading?: boolean;
  fullWidth?: boolean;
  /** Estilo do rótulo, para variações de peso pontuais. */
  emphasis?: 'regular' | 'bold';
  style?: StyleProp<ViewStyle>;
};

const BUTTON_HEIGHT: Record<ButtonSize, number> = { sm: 40, md: 50, lg: 58 };

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  fullWidth = false,
  disabled,
  emphasis = 'regular',
  onPress,
  style,
  ...rest
}: ButtonProps) {
  const { colors, radii, spacing, typography } = useTheme();
  const scale = useSharedValue(1);
  const isDisabled = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const variantTextColor =
    variant === 'primary' || variant === 'danger' || variant === 'success'
      ? colors.textOnPrimary
      : variant === 'ghost'
        ? colors.textSecondary
        : colors.text;

  const content = (
    <View style={styles.buttonContent}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} color={variantTextColor} /> : null}
      <Animated.Text
        numberOfLines={1}
        style={[
          size === 'sm' ? typography.bodyStrong : typography.bodyStrong,
          size === 'lg' && { fontSize: 16 },
          { color: variantTextColor },
          emphasis === 'bold' && { fontFamily: typography.bodyStrong.fontFamily },
        ]}
      >
        {label}
      </Animated.Text>
      {iconRight ? <Icon name={iconRight} size={size === 'sm' ? 16 : 18} color={variantTextColor} /> : null}
    </View>
  );

  const containerStyle: StyleProp<ViewStyle> = [
    styles.button,
    {
      height: BUTTON_HEIGHT[size],
      borderRadius: radii.pill,
      paddingHorizontal: size === 'sm' ? spacing.lg : spacing.xl,
      opacity: isDisabled ? 0.45 : 1,
    },
    fullWidth && { alignSelf: 'stretch' },
    variant === 'secondary' && { backgroundColor: colors.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    variant === 'ghost' && { backgroundColor: 'transparent' },
    style,
  ];

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={() => {
        // eslint-disable-next-line react-hooks/immutability -- SharedValue do Reanimated e mutavel por design
        scale.value = withTiming(0.96, { duration: duration.instant });
      }}
      onPressOut={() => {
        // eslint-disable-next-line react-hooks/immutability -- SharedValue do Reanimated e mutavel por design
        scale.value = withSpring(1, easing.springSoft);
      }}
      style={[animatedStyle, containerStyle]}
      {...rest}
    >
      {loading ? (
        <View style={styles.buttonContent}>
          <ActivityIndicator size="small" color={variantTextColor} />
          {label ? (
            <Animated.Text style={[typography.bodyStrong, { color: variantTextColor }]}>
              {label}
            </Animated.Text>
          ) : null}
        </View>
      ) : (
        content
      )}
    </AnimatedPressable>
  );
}

export function PrimaryButton({ style, ...props }: ButtonProps) {
  return (
    <Button
      {...props}
      variant="primary"
      size="md"
      fullWidth
      style={[{ height: 52, alignSelf: 'stretch' }, style]}
    />
  );
}

// ---------------------------------------------------------------- IconButton

type IconButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  name: string;
  size?: number;
  /** `subtle` é transparente; `solid` tem fundo para ações destrutivas. */
  variant?: 'subtle' | 'solid' | 'ghost';
  color?: string;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Botão só de ícone.
 *
 * `accessibilityLabel` é obrigatório de propósito: sem ele o leitor de tela
 * anuncia um botão sem nome, que é o mesmo que não existir para quem usa.
 */
export function IconButton({
  name,
  size = 20,
  variant = 'subtle',
  color,
  backgroundColor,
  disabled,
  style,
  accessibilityLabel,
  ...rest
}: IconButtonProps) {
  const { colors, radii } = useTheme();
  const scale = useSharedValue(1);

  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const tint =
    color ?? (variant === 'ghost' ? colors.textSecondary : colors.text);

  const background =
    backgroundColor ??
    (variant === 'solid' ? colors.surfaceAlt : variant === 'ghost' ? 'transparent' : colors.surface);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? name}
      disabled={disabled}
      onPressIn={() => {
        // eslint-disable-next-line react-hooks/immutability -- SharedValue do Reanimated e mutavel por design
        scale.value = withTiming(0.9, { duration: duration.instant });
      }}
      onPressOut={() => {
        // eslint-disable-next-line react-hooks/immutability -- SharedValue do Reanimated e mutavel por design
        scale.value = withSpring(1, easing.spring);
      }}
      style={[
        styles.iconButton,
        scaleStyle,
        {
          width: size * 2,
          height: size * 2,
          borderRadius: radii.pill,
          backgroundColor: background,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
      {...rest}
    >
      <Icon name={name} size={size} color={tint} strokeWidth={2.1} />
    </AnimatedPressable>
  );
}

// ---------------------------------------------------------------- Divider

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  cardBody: {
    padding: 20,
    gap: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
});