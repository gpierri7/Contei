import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { Amount, EmptyState } from '@/components/ui';
import { HomeHeader } from '@/components/Header';
import { ScreenContainer } from '@/components/Screen';
import { MonthSummary, MonthPickerSheet, SectionTitle } from '@/components/dashboard';
import { DonutChart, IncomeExpenseChart } from '@/components/charts';
import { useTheme } from '@/theme';
import { useAsync } from '@/hooks/useAsync';
import { useMonthSelection } from '@/hooks/useMonthSelection';
import { formatMonthLabel } from '@/utils/date';
import { formatCurrency, formatPercent } from '@/utils/currency';
import { fetchCategorySlices, fetchMonthlySeries } from '@/services/reports';

export default function ReportsScreen() {
  const { colors, spacing, typography, radii, gutter } = useTheme();
  const insets = useSafeAreaInsets();

  const { monthKey, goPrevious, goNext, isCurrentMonth, pickerOpen, openPicker, closePicker, goTo } =
    useMonthSelection();

  const slices = useAsync(
    (db) => fetchCategorySlices(db, monthKey),
    [monthKey],
    []
  );

  const series = useAsync(
    (db) => fetchMonthlySeries(db, monthKey, 6),
    [monthKey],
    []
  );

  const variableTotal = useMemo(
    () => slices.data.reduce((sum, slice) => sum + slice.totalCents, 0),
    [slices.data]
  );

  const balanceOfMonth = useMemo(() => {
    const point = series.data.find((p) => p.monthKey === monthKey);
    return point?.balanceCents ?? 0;
  }, [series.data, monthKey]);

  return (
    <ScreenContainer safeTop={false} safeBottom={false} horizontalGutter={false}>
      <HomeHeader
        greeting="Relatórios"
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
          title="Resultado do mês"
          totalCents={variableTotal}
          incomeCents={0}
          monthProgress={0}
          loading={slices.loading}
          palette={colors.reportGradient}
          caption={`${formatCurrency(variableTotal)} em gastos variáveis`}
        />

        <View style={[styles.card, { borderRadius: radii.xl, borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={[styles.row, { padding: spacing.xl, paddingBottom: spacing.md }]}>
            <Icon name="sparkles" size={16} color={colors.primaryLight} />
            <Animated.Text style={[typography.h4, { color: colors.text }]}>Saldo do período</Animated.Text>
          </View>
          <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}>
            <Amount
              cents={balanceOfMonth}
              variant="lg"
              tone={balanceOfMonth >= 0 ? 'income' : 'expense'}
            />
            <Animated.Text
              style={[typography.caption, { color: colors.textTertiary, marginTop: spacing.xs }]}
            >
              Inclui gastos fixos, variáveis e parcelas do mês
            </Animated.Text>
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <SectionTitle title="Gastos por categoria" subtitle="Apenas gastos variáveis" />
          <View style={[styles.card, { borderRadius: radii.xl, borderColor: colors.border, padding: spacing.xl, backgroundColor: colors.surface }]}>
            {slices.loading ? null : slices.data.length === 0 ? (
              <EmptyState
                icon="chartPie"
                title="Sem dados de categoria"
                message="Assim que você registrar gastos variáveis, a rosca mostra onde o dinheiro foi."
                actionLabel="Registrar gasto"
                onAction={() => router.push('/add?kind=expense')}
                compact
              />
            ) : (
              <View style={{ gap: spacing.xl }}>
                <View style={styles.donutRow}>
                  <DonutChart
                    slices={slices.data.map((slice) => ({
                      id: slice.categoryId,
                      label: slice.name,
                      value: slice.totalCents,
                      color: slice.color,
                    }))}
                    size={200}
                    thickness={24}
                    centerLabel={formatCurrency(variableTotal)}
                    centerCaption="variáveis"
                  />
                </View>

                <View style={{ gap: spacing.md }}>
                  {slices.data.map((slice, index) => (
                    <Animated.View
                      key={slice.categoryId}
                      entering={FadeInDown.delay(index * 40).duration(200)}
                      style={[styles.row, { gap: spacing.md }]}
                    >
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: slice.color, borderRadius: 3 },
                        ]}
                      />
                      <Animated.Text
                        numberOfLines={1}
                        style={[typography.body, styles.flex, { color: colors.textSecondary }]}
                      >
                        {slice.name}
                      </Animated.Text>
                      <Animated.Text style={[typography.caption, { color: colors.textTertiary }]}>
                        {formatPercent(slice.share)}
                      </Animated.Text>
                      <Animated.Text
                        style={[typography.bodyStrong, { color: colors.text, minWidth: 88, textAlign: 'right' }]}
                      >
                        {formatCurrency(slice.totalCents)}
                      </Animated.Text>
                    </Animated.View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <SectionTitle title="Últimos 6 meses" subtitle="Entradas e saídas" />
          <View style={[styles.card, { borderRadius: radii.xl, borderColor: colors.border, padding: spacing.xl, backgroundColor: colors.surface }]}>
            <IncomeExpenseChart
              points={series.data.map((point) => ({
                label: point.label,
                income: point.incomeCents,
                expense: point.expenseCents,
              }))}
            />
          </View>
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
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  donutRow: {
    alignItems: 'center',
  },
  legendDot: {
    width: 10,
    height: 10,
  },
});