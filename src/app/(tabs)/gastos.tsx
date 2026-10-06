import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { PillToggle } from '@/components/ui';
import { HomeHeader } from '@/components/Header';
import { ScreenContainer } from '@/components/Screen';
import { TransactionList } from '@/components/TransactionList';
import { MonthSummary, MonthPickerSheet, PendingNotice, SectionTitle } from '@/components/dashboard';
import { useTheme } from '@/theme';
import { useMonthData } from '@/hooks/useAsync';
import { useMonthSelection } from '@/hooks/useMonthSelection';
import { formatMonthLabel } from '@/utils/date';
import { formatCurrency } from '@/utils/currency';
import type { TransactionListItem } from '@/services/overview';
import { getDatabase, useDatabase } from '@/database/DatabaseProvider';
import { toggleTransactionPaid } from '@/services/transactions';
import { usePaymentUndo } from '@/hooks/usePaymentUndo';
import { PaymentUndoToast } from '@/components/PaymentUndoToast';

type Tab = 'tudo' | 'fixos' | 'variaveis' | 'parcelas';

const TABS: { value: Tab; label: string }[] = [
  { value: 'tudo', label: 'Tudo' },
  { value: 'fixos', label: 'Fixos' },
  { value: 'variaveis', label: 'Variáveis' },
  { value: 'parcelas', label: 'Parcelas' },
];

export default function ExpensesScreen() {
  const { colors, spacing, gutter } = useTheme();
  const { invalidate } = useDatabase();
  const paymentUndo = usePaymentUndo();
  const insets = useSafeAreaInsets();

  const {
    monthKey,
    goPrevious,
    goNext,
    isCurrentMonth,
    pickerOpen,
    openPicker,
    closePicker,
    goTo,
  } = useMonthSelection();
  const [tab, setTab] = useState<Tab>('tudo');

  const { overview, transactions, loading } = useMonthData(monthKey);

  const expenses = useMemo(
    () => transactions.filter((t) => t.kind === 'expense'),
    [transactions]
  );

  const filtered = useMemo(() => {
    switch (tab) {
      case 'fixos':
        return expenses.filter((t) => t.origin === 'fixed');
      case 'variaveis':
        return expenses.filter((t) => t.origin === 'variable');
      case 'parcelas':
        return expenses.filter((t) => t.origin === 'installment');
      default:
        return expenses;
    }
  }, [expenses, tab]);

  // O total acompanha a aba: comparar "apenas variáveis" contra a renda total
  // daria uma leitura otimista que não corresponde ao que a pessoa vê na lista.
  const totalForTab = useMemo(() => {
    if (tab === 'tudo') return overview.totalCents;
    return filtered.reduce((sum, item) => sum + item.amountCents, 0);
  }, [tab, filtered, overview.totalCents]);

  return (
    <>
    <ScreenContainer safeTop={false} safeBottom={false} horizontalGutter={false}>
      <HomeHeader
        greeting="Gastos"
        monthLabel={formatMonthLabel(monthKey, { short: true })}
        onMonthPress={openPicker}
        hasPrevious
        onPrevious={goPrevious}
        onNext={goNext}
        showNext={!isCurrentMonth}
        actionLabel="Criar categoria de gastos"
        actionIcon="plus"
        onAvatarPress={() =>
          router.push({ pathname: '/categorias', params: { create: 'expense', from: 'gastos' } })
        }
      />

      <Animated.ScrollView
        style={[styles.flex, { backgroundColor: colors.background }]}
        contentContainerStyle={{
          backgroundColor: colors.background,
          paddingHorizontal: gutter,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + 170,
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <MonthSummary
          title="Total do mês"
          totalCents={totalForTab}
          incomeCents={overview.incomeCents}
          monthProgress={overview.monthProgress}
          loading={loading && overview.totalCents === 0}
          palette={colors.expenseGradient}
        />

        <PillToggle options={TABS} value={tab} onChange={setTab} />

        <PendingNotice
          amountCents={tab === 'tudo' || tab === 'fixos' ? overview.fixedPendingCents : 0}
        />

        <View style={{ gap: spacing.md }}>
          <SectionTitle
            title="Lançamentos"
            subtitle={`${filtered.length} ${filtered.length === 1 ? 'item' : 'itens'} · ${formatCurrency(totalForTab)}`}
          />
          <TransactionList
            items={filtered}
            loading={loading}
            onPressItem={(item) => router.push(detailRoute(item))}
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
            emptyAction={() => router.push('/add?kind=expense')}
          />
        </View>
      </Animated.ScrollView>

      <MonthPickerSheet
        visible={pickerOpen}
        value={monthKey}
        onClose={closePicker}
        onSelect={goTo}
      />
    </ScreenContainer>
    <PaymentUndoToast
      message={paymentUndo.message}
      onUndo={() => void paymentUndo.undo()}
    />
    </>
  );
}

function detailRoute(item: TransactionListItem): Href {
  if (item.origin === 'fixed') return `/gastos/fixos/${item.id}`;
  if (item.origin === 'installment' && item.groupId) return `/parcelas/${item.groupId}` as Href;
  return `/gastos/${item.id}`;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});