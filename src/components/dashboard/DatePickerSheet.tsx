import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet,  View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import * as Haptics from 'expo-haptics';

import { Button, IconButton } from '@/components/ui';
import { useTheme } from '@/theme';
import { formatDateShort, toDateKey } from '@/utils/date';
import { WEEKDAYS_SHORT } from '@/utils/labels';
import { buildMonthGrid, monthTitle } from '@/utils/calendar';
import { Sheet } from './Sheet';

/**
 * Seletor de data em grade mensal.
 *
 * Datas futuras aparecem, mas não são selecionáveis: registrar uma despesa de
 * amanhã é erro de toque com frequência, e esconder o dia deixaria a grade
 * desalinhada. Um clique fora de lugar não pode criar lançamento nenhum.
 */
export function DatePickerSheet({
  visible,
  value,
  onClose,
  onSelect,
  maxDate,
  minDate,
}: {
  visible: boolean;
  value: number;
  onClose: () => void;
  onSelect: (timestamp: number) => void;
  /** Limite superior. Padrão: hoje, resolvido uma vez por montagem. */
  maxDate?: number;
  minDate?: number;
}) {
  const { colors, typography, spacing } = useTheme();

  // Um default de parâmetro seria reavaliado a cada render, e o "hoje" do
  // calendário mudaria junto com qualquer re-render. Este snapshot é feito uma
  // única vez de propósito.
  // eslint-disable-next-line react-hooks/purity -- "hoje" é fixado na montagem, não relido a cada render.
  const today = useMemo(() => Date.now(), []);
  const upperBound = maxDate ?? today;

  const selected = new Date(value);
  const [draftDate, setDraftDate] = useState(value);
  const [year, setYear] = useState(selected.getFullYear());
  const [month, setMonth] = useState(selected.getMonth());

  // Reancora a grade quando o sheet abre em outra data.
  const [lastVisible, setLastVisible] = useState(visible);
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (visible) {
      setYear(selected.getFullYear());
      setMonth(selected.getMonth());
      setDraftDate(value);
    }
  }

  const weeks = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const todayKey = useMemo(() => toDateKey(new Date(today)), [today]);
  const maxKey = useMemo(() => toDateKey(new Date(upperBound)), [upperBound]);
  const minKey = minDate ? toDateKey(new Date(minDate)) : null;
  const maxYear = new Date(upperBound).getFullYear();
  const maxMonth = new Date(upperBound).getMonth();

  const shift = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    if (next.getFullYear() > maxYear) return;
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  const canGoNext = year < maxYear || (year === maxYear && month < maxMonth);

  const handlePick = (key: string) => {
    if (key > maxKey || (minKey && key < minKey)) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    void Haptics.selectionAsync();

    const [y, m, d] = key.split('-').map(Number);
    // Preserva a hora atual: quem registra às 14h não quer ver 00h na lista.
    const now = new Date();
    setDraftDate(new Date(y, m - 1, d, now.getHours(), now.getMinutes()).getTime());
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Escolher data" maxHeightRatio={0.85}>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
        <View style={[styles.row, { gap: spacing.md }]}>
          <IconButton
            name="chevronLeft"
            variant="subtle"
            size={18}
            onPress={() => shift(-1)}
            accessibilityLabel="Mês anterior"
          />
          <View style={styles.flex}>
            <CalendarTitle year={year} month={month} />
          </View>
          <IconButton
            name="chevronRight"
            variant="subtle"
            size={18}
            disabled={!canGoNext}
            onPress={() => shift(1)}
            accessibilityLabel="Próximo mês"
          />
        </View>

        <View style={styles.grid}>
          {WEEKDAYS_SHORT.map((weekday) => (
            <View key={weekday} style={styles.weekdayCell}>
              <AppText style={[typography.micro, { color: colors.textTertiary }]}>{weekday.slice(0, 1)}</AppText>
            </View>
          ))}

          {weeks.flat().map((key, index) => {
            if (!key) return <View key={`empty-${index}`} style={styles.dayCell} />;

            const isSelected = key === toDateKey(new Date(draftDate));
            const isToday = key === todayKey;
            const disabled = key > maxKey || (minKey !== null && key < minKey);

            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled }}
                accessibilityLabel={formatDateShort(parseKey(key))}
                disabled={disabled}
                onPress={() => handlePick(key)}
                style={styles.dayCell}
              >
                <DayCell
                  day={Number(key.split('-')[2])}
                  selected={isSelected}
                  isToday={isToday}
                  disabled={disabled}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.row, { gap: spacing.sm, justifyContent: 'center', paddingTop: spacing.sm }]}>
          <QuickDay label="Hoje" onPress={() => setDraftDate(Date.now())} />
          <QuickDay label="Ontem" onPress={() => setDraftDate(startOfYesterday())} />
        </View>

        <View style={[styles.row, { gap: spacing.sm, paddingBottom: spacing.md }]}>
          <Button label="Cancelar" variant="secondary" onPress={onClose} style={styles.flexButton} />
          <Button label="Confirmar" onPress={() => onSelect(draftDate)} style={styles.flexButton} />
        </View>
      </View>
    </Sheet>
  );
}

function parseKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

const startOfYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
};

function DayCell({
  day,
  selected,
  isToday,
  disabled,
}: {
  day: number;
  selected: boolean;
  isToday: boolean;
  disabled: boolean;
}) {
  const { colors, typography, radii } = useTheme();

  return (
    <View
      style={[
        styles.day,
        {
          borderRadius: radii.pill,
          backgroundColor: selected ? colors.primary : isToday ? colors.primaryDim : 'transparent',
          borderWidth: isToday && !selected ? 1 : 0,
          borderColor: colors.primaryBorder,
          opacity: disabled ? 0.28 : 1,
        },
      ]}
    >
      <AppText
        style={[
          typography.bodyStrong,
          { color: selected ? colors.textOnPrimary : disabled ? colors.textTertiary : colors.text },
        ]}
      >
        {day}
      </AppText>
    </View>
  );
}

function CalendarTitle({ year, month }: { year: number; month: number }) {
  const { colors, typography } = useTheme();
  return (
    <AppText style={[typography.h4, { color: colors.text, textAlign: 'center' }]}>
      {monthTitle(year, month)}
    </AppText>
  );
}

function QuickDay({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, typography, radii, spacing } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickDay,
        {
          borderRadius: radii.pill,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <AppText style={[typography.label, { color: colors.textSecondary }]}>{label}</AppText>
    </Pressable>
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
  weekdayCell: {
    width: `${100 / 7}%`,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  day: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexButton: {
    flex: 1,
  },
  quickDay: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});