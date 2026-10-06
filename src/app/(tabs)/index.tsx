import React, { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { HomeHeader } from '@/components/Header';
import { ScreenContainer } from '@/components/Screen';
import { BalanceHero, QuickActions } from '@/components/BalanceHero';
import { TransactionList } from '@/components/TransactionList';
import { SectionTitle, GoalCard, MonthPickerSheet } from '@/components/dashboard';
import { EmptyState, SkeletonCard } from '@/components/ui';
import { useTheme } from '@/theme';
import { useMonthData, useOpenGoals } from '@/hooks/useAsync';
import { addMonths, currentMonthKey, formatMonthLabel } from '@/utils/date';
import { useDatabase, getDatabase } from '@/database/DatabaseProvider';
import { toggleTransactionPaid } from '@/services/transactions';
import { usePaymentUndo } from '@/hooks/usePaymentUndo';
import { PaymentUndoToast } from '@/components/PaymentUndoToast';

export default function HomeScreen() {
  const { colors, spacing } = useTheme();
  const { invalidate } = useDatabase();
  const paymentUndo = usePaymentUndo();
  const insets = useSafeAreaInsets();

  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { overview, transactions, loading, error, refresh } = useMonthData(monthKey);
  const goals = useOpenGoals();

  const isCurrentMonth = monthKey === currentMonthKey();
  const greeting = useGreeting();

  const goPrevious = useCallback(() => setMonthKey((m) => addMonths(m, -1)), []);
  const goNext = useCallback(() => setMonthKey((m) => addMonths(m, 1)), []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    // A consulta é local e síncrona no efecto; este timeout só mantém o
    // indicador visível o mínimo para não piscar.
    setTimeout(() => setRefreshing(false), 450);
  }, [refresh]);

  const hasContent =
    overview.incomeCents > 0 ||
    overview.fixedCents > 0 ||
    overview.variableCents > 0 ||
    transactions.length > 0;

  const openGoals = useMemo(() => goals.data.slice(0, 2), [goals.data]);

  return (
    <>
      <ScreenContainer
        safeTop={false}
        safeBottom={false}
        horizontalGutter={false}
        style={[styles.root, { backgroundColor: colors.background }]}
      >
        <HomeHeader
          greeting={greeting}
          monthLabel={formatMonthLabel(monthKey, { short: true })}
          onMonthPress={() => setPickerOpen(true)}
          hasPrevious
          onPrevious={goPrevious}
          onNext={goNext}
          showNext={!isCurrentMonth}
          onAvatarPress={() => router.push('/mais')}
        />

        <ScrollView
          style={[styles.flex, { backgroundColor: colors.background }]}
          contentContainerStyle={{
            backgroundColor: colors.background,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + 190,
            gap: spacing.xxl,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textTertiary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.surface}
            />
          }
        >
          {loading && !hasContent ? <SkeletonCard /> : null}

          {error ? (
            <EmptyState
              icon="circleAlert"
              title="Não consegui ler seus dados"
              message={error.message}
              actionLabel="Tentar de novo"
              onAction={refresh}
              compact
            />
          ) : null}

          {!loading && !hasContent && !error ? (
            <EmptyState
              icon="sparkles"
              title="Vamos começar"
              message="Registre um salário ou um gasto para o Contei montar o seu mês aqui."
              actionLabel="Adicionar primeiro lançamento"
              onAction={() => router.push('/add')}
            />
          ) : null}

          {hasContent ? (
            <>
              <Animated.View entering={FadeInDown.springify().damping(18)}>
                <BalanceHero
                  overview={overview}
                  monthLabel={formatMonthLabel(monthKey, { short: true })}
                  onIncomePress={() => router.push('/ganhos')}
                  onExpensePress={() => router.push('/gastos')}
                />
              </Animated.View>

              <QuickActions
                incomeCents={overview.incomeCents}
                expenseCents={overview.totalCents}
                installmentCents={overview.installmentCents}
                goalCount={goals.data.length}
                onIncome={() => router.push('/ganhos')}
                onExpense={() => router.push('/gastos')}
                onInstallments={() => router.push('/parcelas')}
                onGoals={() => router.push('/metas')}
              />

              {openGoals.length > 0 ? (
                <View style={{ gap: spacing.md }}>
                  <SectionTitle
                    title="Metas"
                    actionLabel="Ver todas"
                    onAction={() => router.push('/metas')}
                  />
                  {openGoals.map((goal, index) => (
                    <Animated.View
                      key={goal.id}
                      entering={FadeInDown.delay(80 + index * 60).springify().damping(18)}
                    >
                      <GoalCard
                        name={goal.name}
                        color={goal.color}
                        icon={goal.icon}
                        savedCents={goal.saved_cents}
                        targetCents={goal.target_cents}
                        ratio={goal.ratio}
                        deadline={goal.deadline}
                        onPress={() => router.push(`/metas/${goal.id}`)}
                      />
                    </Animated.View>
                  ))}
                </View>
              ) : null}

              <View style={{ gap: spacing.md }}>
                <SectionTitle
                  title="Lançamentos"
                  actionLabel="Ver todos"
                  onAction={() => router.push('/gastos')}
                />
                <TransactionList
                  items={transactions.slice(0, 12)}
                  loading={loading}
                  onPressItem={(item) => router.push(routeFor(item))}
                  onTogglePaid={(item) => {
                    void (async () => {
                      try {
                        await toggleTransactionPaid(await getDatabase(), item, monthKey);
                        await Haptics.notificationAsync(
                          item.isPaid
                            ? Haptics.NotificationFeedbackType.Warning
                            : Haptics.NotificationFeedbackType.Success
                        );
                        invalidate();
                        paymentUndo.offerUndo(
                          item.isPaid
                            ? `${item.title} marcado como pendente`
                            : `${item.title} marcado como pago`,
                          async () => {
                            await toggleTransactionPaid(
                              await getDatabase(),
                              { ...item, isPaid: !item.isPaid },
                              monthKey
                            );
                            invalidate();
                          }
                        );
                      } catch (error) {
                        Alert.alert(
                          'Não foi possível atualizar o pagamento',
                          error instanceof Error ? error.message : undefined
                        );
                      }
                    })();
                  }}
                  emptyAction={() => router.push('/add')}
                />
              </View>
            </>
          ) : null}
        </ScrollView>
      </ScreenContainer>

      <MonthPickerSheet
        visible={pickerOpen}
        value={monthKey}
        onClose={() => setPickerOpen(false)}
        onSelect={(key) => {
          setMonthKey(key);
          setPickerOpen(false);
        }}
      />
      <PaymentUndoToast
        message={paymentUndo.message}
        onUndo={() => void paymentUndo.undo()}
      />
    </>
  );
}

function routeFor(item: { kind: string; origin: string; id: number; groupId?: string }): Href {
  if (item.kind === 'income') return `/ganhos/${item.id}`;
  if (item.origin === 'fixed') return `/gastos/fixos/${item.id}`;
  if (item.origin === 'installment' && item.groupId) return `/parcelas/${item.groupId}` as Href;
  return `/gastos/${item.id}`;
}

function useGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Boa madrugada';
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
});