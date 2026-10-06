import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/theme';
import { duration } from '@/theme/motion';
import { formatCurrency } from '@/utils/currency';
import { useMoneyInput } from '@/hooks/useMoneyInput';

const KEY_ROWS = [
  [{ id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }],
  [{ id: '4', label: '4' }, { id: '5', label: '5' }, { id: '6', label: '6' }],
  [{ id: '7', label: '7' }, { id: '8', label: '8' }, { id: '9', label: '9' }],
  [{ id: '00', label: '00' }, { id: '0', label: '0' }, { id: 'del', label: 'del' }],
] as const;

export type MoneyInput = ReturnType<typeof useMoneyInput>;

/**
 * Teclado numérico para valores.
 *
 * Os dígitos são inseridos como centavos: digitar "12345" resulta em R$ 123,45.
 * A vírgula aparece apenas na exibição e não precisa ser digitada.
 */
export function AmountPad({
  value,
  label,
  accentColor,
}: {
  value: MoneyInput;
  label: string;
  accentColor?: string;
}) {
  const { colors, typography, spacing } = useTheme();
  const accent = accentColor ?? colors.primaryLight;

  const press = (id: string) => {
    if (id === 'del') value.backspace();
    else value.append(id);
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <AmountDisplay amount={value} label={label} accent={accent} />
      <AppText style={[typography.caption, { color: colors.textTertiary, textAlign: 'center' }]}>
        Digite os números; os dois últimos representam centavos.
      </AppText>
      <AmountKeypad onPress={press} />
    </View>
  );
}

export function AmountDisplay({
  amount,
  label,
  accent,
}: {
  amount: MoneyInput;
  label: string;
  accent: string;
}) {
  const { colors, typography, radii, spacing } = useTheme();
  const pulse = useSharedValue(1);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const display = amount.isEmpty ? '0,00' : formatCurrency(amount.cents);

  return (
    <View
      style={[
        styles.display,
        {
          borderRadius: radii.lg,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          padding: spacing.xl,
          gap: spacing.xs,
        },
      ]}
    >
      <Animated.Text style={[typography.label, { color: colors.textTertiary }]}>{label}</Animated.Text>
      <Animated.View style={pulseStyle}>
        <Animated.Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.45}
          style={[
            typography.amountXl,
            { color: amount.isEmpty ? colors.textTertiary : accent },
          ]}
        >
          {display}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

export function AmountKeypad({
  onPress,
}: {
  onPress: (id: string) => void;
}) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      {KEY_ROWS.map((row) => (
        <View key={row[0].id} style={[styles.keyRow, { gap: spacing.sm }]}>
          {row.map((key) => (
            <PadKey
              key={key.id}
              id={key.id}
              label={key.label}
              onPress={() => {
                void Haptics.selectionAsync();
                onPress(key.id);
              }}
              tone={key.id === '00' ? 'muted' : 'default'}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function PadKey({
  id,
  label,
  onPress,
  tone = 'default',
}: {
  id: string;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'muted';
}) {
  const { colors, typography, radii } = useTheme();
  const scale = useSharedValue(1);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isDelete = id === 'del';

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={isDelete ? 'Apagar último dígito' : label}
      onPress={onPress}
      onPressIn={() => {
        // eslint-disable-next-line react-hooks/immutability -- SharedValue do Reanimated e mutavel por design
        scale.value = withTiming(0.9, { duration: duration.instant });
      }}
      onPressOut={() => {
        // eslint-disable-next-line react-hooks/immutability -- SharedValue do Reanimated e mutavel por design
        scale.value = withSequence(
          withTiming(1.06, { duration: duration.fast }),
          withTiming(1, { duration: duration.fast })
        );
      }}
      style={[
        styles.key,
        scaleStyle,
        {
          borderRadius: radii.lg,
          backgroundColor: isDelete ? colors.expenseDim : colors.surfaceAlt,
          borderColor: colors.border,
        },
      ]}
    >
      {isDelete ? (
        <Icon name="trash" size={20} color={colors.expense} strokeWidth={2.1} />
      ) : (
        <Animated.Text
          style={[
            typography.amountLg,
            { color: tone === 'muted' ? colors.textSecondary : colors.text },
          ]}
        >
          {label}
        </Animated.Text>
      )}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const styles = StyleSheet.create({
  keyRow: {
    flexDirection: 'row',
  },
  key: {
    flex: 1,
    aspectRatio: 1.7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  display: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
});