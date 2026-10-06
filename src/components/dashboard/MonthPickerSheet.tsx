import React, { useState } from 'react';
import { Pressable, StyleSheet,  View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import * as Haptics from 'expo-haptics';

import { IconButton } from '@/components/ui/Primitives';
import { useTheme } from '@/theme';
import { MONTHS_PT } from '@/utils/labels';
import { currentMonthKey, formatMonthLabel, type MonthKey } from '@/utils/date';
import { Sheet } from './Sheet';

/**
 * Seletor de mês em grade.
 *
 * Meses futuros ficam visíveis mas desabilitados, em vez de sumirem: a grade
 * precisa continuar retangular e a pessoa precisa enxergar que o mês existe
 * para entender por que não pode tocar nele.
 */
export function MonthPickerSheet({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: MonthKey;
  onClose: () => void;
  onSelect: (month: MonthKey) => void;
}) {
  const { colors, typography, radii, spacing, shadows } = useTheme();
  const current = currentMonthKey();
  const currentYear = Number(current.split('-')[0]);

  const valueYear = Number(value.split('-')[0]);

  // Reancora o ano no mês exibido sempre que o sheet abre. Fazer isso durante
  // o render é o padrão do React para "ajustar estado ao mudar de props" e
  // evita um effect que só roda para propagar um valor que já é conhecido.
  const [year, setYear] = useState(valueYear);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setYear(valueYear);
  }

  const handleSelect = (key: MonthKey) => {
    if (key > current) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    void Haptics.selectionAsync();
    onSelect(key);
  };

  const shiftYear = (delta: number) => {
    setYear((y) => Math.max(y - 10, Math.min(currentYear, y + delta)));
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Escolher mês" maxHeightRatio={0.72}>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
        <View style={[styles.row, { gap: spacing.md }]}>
          <IconButton
            name="chevronLeft"
            variant="subtle"
            size={18}
            onPress={() => shiftYear(-1)}
            accessibilityLabel="Ano anterior"
          />
          <AnimatedYear year={year} />
          <IconButton
            name="chevronRight"
            variant="subtle"
            size={18}
            disabled={year >= currentYear}
            onPress={() => shiftYear(1)}
            accessibilityLabel="Próximo ano"
          />
        </View>

        <View style={[styles.grid, { gap: spacing.sm }]}>
          {MONTHS_PT.map((name, index) => {
            const key: MonthKey = `${year}-${String(index + 1).padStart(2, '0')}`;
            const active = key === value;
            const disabled = key > current;

            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled }}
                accessibilityLabel={formatMonthLabel(key)}
                disabled={disabled}
                onPress={() => handleSelect(key)}
                style={({ pressed }) => [
                  styles.monthCell,
                  {
                    borderRadius: radii.md,
                    backgroundColor: active ? colors.primary : colors.surfaceAlt,
                    borderColor: active ? 'transparent' : colors.border,
                    opacity: disabled ? 0.3 : pressed ? 0.8 : 1,
                  },
                  active ? shadows.sm : null,
                ]}
              >
                <AppText style={[typography.bodyStrong, { color: active ? colors.textOnPrimary : colors.textSecondary }]} numberOfLines={1}>
                  {name}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Sheet>
  );
}

/** Isolado para manter o `Text` animado simples e evitar re-render em cascata. */
function AnimatedYear({ year }: { year: number }) {
  const { colors, typography } = useTheme();
  return (
    <AppText style={[typography.h4, styles.flex, { color: colors.text, textAlign: 'center' }]}>
      {year}
    </AppText>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthCell: {
    width: '31%',
    aspectRatio: 1.45,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});