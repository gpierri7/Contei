import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { Amount, Button, EmptyState, Skeleton } from '@/components/ui';
import { DetailRow, DetailScreen, confirmDelete } from '@/components/DetailScreen';
import { MonthPickerSheet, Sheet } from '@/components/dashboard';
import { useTheme } from '@/theme';
import { getDatabase, useDatabase } from '@/database/DatabaseProvider';
import { fixedRepo, type FixedExpenseRow } from '@/database/repositories/expenses';
import { useAsync } from '@/hooks/useAsync';
import { useMonthSelection } from '@/hooks/useMonthSelection';
import { formatCurrency } from '@/utils/currency';
import { formatMonthLabel, formatDateDayMonth } from '@/utils/date';
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/database/types';
import { usePaymentUndo } from '@/hooks/usePaymentUndo';
import { PaymentUndoToast } from '@/components/PaymentUndoToast';

/**
 * Contas fixas do mês.
 *
 * É uma tela de confirmação, não de digitação: o valor já foi definido como
 * template. O que a pessoa quer aqui é bater o ponto e ver o que falta — por
 * isso o total pendente fica no topo e o resto é uma lista de tarefas.
 */
export default function FixedExpensesScreen() {
  const { colors, typography, radii, spacing } = useTheme();
  const { invalidate } = useDatabase();
  const paymentUndo = usePaymentUndo();

  const { monthKey, pickerOpen, openPicker, closePicker, goTo } = useMonthSelection();
  const rows = useAsync((db) => fixedRepo.listForMonth(db, monthKey), [monthKey], []);
  const [selected, setSelected] = useState<FixedExpenseRow | null>(null);

  const totals = rows.data.reduce(
    (acc, row) => {
      if (row.is_paid) acc.paid += row.amount_cents;
      else acc.pending += row.amount_cents;
      return acc;
    },
    { paid: 0, pending: 0 }
  );

  const togglePaid = async (row: FixedExpenseRow) => {
    try {
      const db = await getDatabase();
      await fixedRepo.setPaid(db, row.id, monthKey, !row.is_paid);
      await Haptics.notificationAsync(
        row.is_paid ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success
      );
      invalidate();
      paymentUndo.offerUndo(
        row.is_paid ? `${row.category_name} marcado como pendente` : `${row.category_name} marcado como pago`,
        async () => {
          await fixedRepo.setPaid(db, row.id, monthKey, Boolean(row.is_paid));
          invalidate();
        }
      );
    } catch (error) {
      Alert.alert('Não foi possível atualizar o pagamento', error instanceof Error ? error.message : undefined);
    }
  };

  return (
    <DetailScreen
      title="Contas fixas"
      subtitle={formatMonthLabel(monthKey)}
      backTo="/gastos"
      overlay={
        <PaymentUndoToast
          message={paymentUndo.message}
          onUndo={() => void paymentUndo.undo()}
          bottomOffset={80}
        />
      }
      footer={
        <Button
          label="Adicionar conta fixa"
          variant="secondary"
          icon="plus"
          fullWidth
          onPress={() => router.push('/add?kind=expense&mode=fixed')}
        />
      }
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Trocar mês"
        onPress={openPicker}
        style={[
          styles.monthRow,
          {
            borderRadius: radii.lg,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            padding: spacing.lg,
          },
        ]}
      >
        <Icon name="calendar" size={18} color={colors.primaryLight} strokeWidth={2.1} />
        <AppText style={[typography.bodyStrong, { color: colors.text }]}>
          {formatMonthLabel(monthKey)}
        </AppText>
        <View style={styles.flex} />
        <Icon name="chevronDown" size={18} color={colors.textTertiary} />
      </Pressable>

      <Animated.View
        entering={FadeInDown.duration(200)}
        style={[
          styles.totals,
          {
            borderRadius: radii.xl,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            padding: spacing.xl,
          },
        ]}
      >
        <View style={styles.flex}>
          <AppText style={[typography.caption, { color: colors.textTertiary }]}>Pago</AppText>
          <Amount cents={totals.paid} variant="lg" tone="income" />
        </View>
        <View style={[styles.flex, { alignItems: 'flex-end' }]}>
          <AppText style={[typography.caption, { color: colors.textTertiary }]}>Falta pagar</AppText>
          <Amount cents={totals.pending} variant="lg" tone="expense" />
        </View>
      </Animated.View>

      {rows.loading ? (
        <>
          <Skeleton height={64} />
          <Skeleton height={64} />
          <Skeleton height={64} />
        </>
      ) : rows.data.length === 0 ? (
        <EmptyState
          icon="calendarClock"
          title="Nenhuma conta fixa"
          message="Cadastre o que se repete todo mês — aluguel, streaming, assinatura — e o app lembra de cobrar."
          actionLabel="Cadastrar agora"
          onAction={() => router.push('/add?kind=expense&mode=fixed')}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {rows.data.map((row, index) => (
            <Animated.View key={row.id} entering={FadeInDown.delay(index * 40).duration(200)}>
              <FixedRow row={row} onToggle={() => void togglePaid(row)} onOpen={() => setSelected(row)} />
            </Animated.View>
          ))}
        </View>
      )}

      <MonthPickerSheet
        visible={pickerOpen}
        value={monthKey}
        onClose={closePicker}
        onSelect={(key) => {
          goTo(key);
          closePicker();
        }}
      />

      <FixedDetailSheet
        row={selected}
        onClose={() => setSelected(null)}
        onDelete={(row) =>
          confirmDelete('Excluir conta fixa?', 'Ela deixa de aparecer nos próximos meses.', async () => {
            const db = await getDatabase();
            await fixedRepo.remove(db, row.id);
            setSelected(null);
            invalidate();
            router.back();
          })
        }
      />
    </DetailScreen>
  );
}

function FixedRow({
  row,
  onToggle,
  onOpen,
}: {
  row: FixedExpenseRow;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { colors, typography, radii, spacing } = useTheme();

  return (
    <View
      style={[
        styles.fixedRow,
        {
          borderRadius: radii.lg,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.md,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ checked: row.is_paid === 1 }}
        accessibilityLabel={`${row.category_name}, ${formatCurrency(row.amount_cents)}`}
        onPress={onToggle}
        hitSlop={8}
        style={[
          styles.checkbox,
          {
            borderRadius: radii.sm,
            backgroundColor: row.is_paid ? colors.income : 'transparent',
            borderColor: row.is_paid ? colors.income : colors.borderStrong,
          },
        ]}
      >
        {row.is_paid ? <Icon name="check" size={14} color={colors.textOnPrimary} strokeWidth={3} /> : null}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Detalhes de ${row.category_name}`}
        onPress={onOpen}
        style={styles.flex}
      >
        <AppText
          numberOfLines={1}
          style={[
            typography.bodyStrong,
            { color: row.is_paid ? colors.textTertiary : colors.text },
          ]}
        >
          {row.category_name}
        </AppText>
        <AppText style={[typography.caption, { color: colors.textTertiary }]}>
          Dia {row.due_day} · {PAYMENT_METHOD_LABELS[row.method as PaymentMethod]}
        </AppText>
      </Pressable>

      <Amount
        cents={row.amount_cents}
        variant="md"
        tone={row.is_paid ? 'muted' : 'default'}
      />
    </View>
  );
}

function FixedDetailSheet({
  row,
  onClose,
  onDelete,
}: {
  row: FixedExpenseRow | null;
  onClose: () => void;
  onDelete: (row: FixedExpenseRow) => void;
}) {
  const { spacing } = useTheme();
  if (!row) return null;

  return (
    <Sheet visible={Boolean(row)} onClose={onClose} title={row.category_name}>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.lg }}>
        <DetailRow
          label="Valor"
          value={formatCurrency(row.amount_cents)}
          icon="wallet"
          onDelete={() => onDelete(row)}
        />
        <DetailRow label="Vence no dia" value={String(row.due_day)} icon="calendar" />
        <DetailRow
          label="Pagamento"
          value={PAYMENT_METHOD_LABELS[row.method as PaymentMethod]}
          icon="creditCard"
        />
        <DetailRow label="Recebe de" value={row.source_name ?? 'Não vinculado'} icon="wallet" />
        {row.is_paid && row.paid_at ? (
          <DetailRow
            label="Pago em"
            value={formatDateDayMonth(row.paid_at)}
            icon="check"
          />
        ) : null}
        <Button
          label="Editar conta fixa"
          variant="secondary"
          icon="edit"
          onPress={() => {
            onClose();
            router.push(`/gastos/fixos/${row.id}`);
          }}
          fullWidth
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  totals: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
  },
  fixedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});