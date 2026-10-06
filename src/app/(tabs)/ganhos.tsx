import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui';
import { HomeHeader } from '@/components/Header';
import { ScreenContainer } from '@/components/Screen';
import { MonthSummary, MonthPickerSheet, SectionTitle } from '@/components/dashboard';
import { useTheme } from '@/theme';
import { useQuery } from '@/hooks/useQuery';
import { useMonthSelection } from '@/hooks/useMonthSelection';
import { formatMonthLabel, formatDateShort, monthEndExclusive, monthStart } from '@/utils/date';
import { formatCurrency } from '@/utils/currency';

type IncomeRow = {
  id: number;
  amount_cents: number;
  date: number;
  description: string | null;
  method: string;
  source_id: number;
  source_name: string;
  source_color: string;
  source_icon: string;
};

export default function GainsScreen() {
  const { colors, spacing, typography, radii, gutter } = useTheme();
  const insets = useSafeAreaInsets();

  const { monthKey, goPrevious, goNext, isCurrentMonth, pickerOpen, openPicker, closePicker, goTo } =
    useMonthSelection();

  const from = monthStart(monthKey).getTime();
  const to = monthEndExclusive(monthKey).getTime();

  const { data: rows, loading } = useQuery<IncomeRow>(
    `SELECT i.id, i.amount_cents, i.date, i.description, i.method, i.source_id,
            s.name AS source_name, s.color AS source_color, s.icon AS source_icon
       FROM incomes i
       JOIN income_sources s ON s.id = i.source_id
      WHERE i.date >= ? AND i.date < ?
      ORDER BY i.date DESC, i.amount_cents DESC`,
    [from, to],
    { deps: [monthKey] }
  );

  const total = useMemo(() => rows.reduce((sum, r) => sum + r.amount_cents, 0), [rows]);

  const bySource = useMemo(() => {
    const map = new Map<
      string,
      { name: string; color: string; icon: string; total: number; count: number }
    >();

    for (const row of rows) {
      const entry = map.get(row.source_name) ?? {
        name: row.source_name,
        color: row.source_color,
        icon: row.source_icon,
        total: 0,
        count: 0,
      };
      entry.total += row.amount_cents;
      entry.count += 1;
      map.set(row.source_name, entry);
    }

    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [rows]);

  return (
    <ScreenContainer safeTop={false} safeBottom={false} horizontalGutter={false}>
      <HomeHeader
        greeting="Ganhos"
        monthLabel={formatMonthLabel(monthKey, { short: true })}
        onMonthPress={openPicker}
        hasPrevious
        onPrevious={goPrevious}
        onNext={goNext}
        showNext={!isCurrentMonth}
      />

      <Animated.ScrollView
        style={[styles.flex, { backgroundColor: colors.background }]}
        contentContainerStyle={{
          backgroundColor: colors.background,
          paddingHorizontal: gutter,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + 170,
          gap: spacing.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <MonthSummary
          title="Total do mês"
          totalCents={total}
          incomeCents={0}
          monthProgress={0}
          loading={loading && rows.length === 0}
          palette={colors.incomeGradient}
          caption={`${rows.length} ${rows.length === 1 ? 'lançamento' : 'lançamentos'} em ${formatMonthLabel(monthKey, { short: true })}`}
        />

        {bySource.length > 0 ? (
          <View style={{ gap: spacing.md }}>
            <SectionTitle title="Por fonte" subtitle="Onde o dinheiro entrou" />
            {bySource.map((source, index) => (
              <Animated.View
                key={source.name}
                entering={FadeInDown.delay(index * 50).springify().damping(18)}
                style={[
                  styles.row,
                  {
                    borderRadius: radii.lg,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    padding: spacing.lg,
                    gap: spacing.md,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconDisc,
                    { borderRadius: radii.sm, backgroundColor: `${source.color}1F` },
                  ]}
                >
                  <Icon name={source.icon} size={17} color={source.color} strokeWidth={2.2} />
                </View>

                <View style={styles.flex}>
                  <Animated.Text numberOfLines={1} style={[typography.bodyStrong, { color: colors.text }]}>
                    {source.name}
                  </Animated.Text>
                  <Animated.Text style={[typography.caption, { color: colors.textTertiary }]}>
                    {source.count === 1 ? '1 lançamento' : `${source.count} lançamentos`}
                  </Animated.Text>
                </View>

                <Animated.Text style={[typography.amountSm, { color: colors.income }]}>
                  {formatCurrency(source.total)}
                </Animated.Text>
              </Animated.View>
            ))}
          </View>
        ) : null}

        <View style={{ gap: spacing.md }}>
          <SectionTitle title="Lançamentos" subtitle={formatMonthLabel(monthKey)} />
          {!loading && rows.length === 0 ? (
            <EmptyState
              icon="trendingUp"
              title="Nenhum ganho neste mês"
              message="Registre salário, freela, pensione — o que entrou."
              actionLabel="Registrar ganho"
              onAction={() => router.push('/add?kind=income')}
              compact
            />
          ) : null}

          {rows.map((row, index) => (
            <Animated.View
              key={row.id}
              entering={FadeInDown.delay(index * 40).duration(200)}
            >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Editar ganho ${row.description?.trim() || row.source_name}`}
              onPress={() => router.push(`/ganhos/${row.id}`)}
              style={[
                styles.row,
                {
                  borderRadius: radii.lg,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  padding: spacing.lg,
                  gap: spacing.md,
                },
              ]}
            >
              <View
                style={[
                  styles.iconDisc,
                  { borderRadius: radii.sm, backgroundColor: `${row.source_color}1F` },
                ]}
              >
                <Icon name={row.source_icon} size={17} color={row.source_color} strokeWidth={2.2} />
              </View>

              <View style={styles.flex}>
                <Animated.Text numberOfLines={1} style={[typography.bodyStrong, { color: colors.text }]}>
                  {row.description?.trim() || row.source_name}
                </Animated.Text>
                <Animated.Text style={[typography.caption, { color: colors.textTertiary }]}>
                  {row.source_name} · {formatDateShort(row.date)}
                </Animated.Text>
              </View>

              <Animated.Text style={[typography.amountSm, { color: colors.income }]}>
                {formatCurrency(row.amount_cents)}
              </Animated.Text>
            </Pressable>
            </Animated.View>
          ))}
        </View>
      </Animated.ScrollView>

      <MonthPickerSheet
        visible={pickerOpen}
        value={monthKey}
        onClose={closePicker}
        onSelect={goTo}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconDisc: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});