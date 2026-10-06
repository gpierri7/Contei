import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button } from '@/components/ui';
import { useTheme } from '@/theme';

export function PaymentUndoToast({
  message,
  onUndo,
  bottomOffset = 112,
}: {
  message: string | null;
  onUndo: () => void;
  bottomOffset?: number;
}) {
  const { colors, radii, spacing, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  if (!message) return null;

  return (
    <View pointerEvents="box-none" style={[styles.position, { bottom: insets.bottom + bottomOffset }]}>
      <Animated.View
        entering={FadeInDown.duration(180)}
        exiting={FadeOutDown.duration(140)}
        style={[
          styles.toast,
          {
            borderRadius: radii.lg,
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.borderStrong,
            paddingVertical: spacing.sm,
            paddingLeft: spacing.lg,
            paddingRight: spacing.sm,
            ...shadows.lg,
          },
        ]}
      >
        <AppText numberOfLines={2} style={[styles.message, { color: colors.text }]}>
          {message}
        </AppText>
        <Button label="Desfazer" variant="secondary" icon="rotateCcw" size="sm" onPress={onUndo} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  position: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 100,
  },
  toast: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  message: {
    flex: 1,
  },
});
