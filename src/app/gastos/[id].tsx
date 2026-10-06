import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { Amount, Button, Input, Skeleton } from '@/components/ui';
import { DetailRow, DetailScreen, confirmDelete } from '@/components/DetailScreen';
import { AmountPad, CategoryPickerSheet, DatePickerSheet, Sheet } from '@/components/dashboard';
import { useTheme } from '@/theme';
import { getDatabase, useDatabase } from '@/database/DatabaseProvider';
import { variableRepo } from '@/database/repositories/expenses';
import { categoriesRepo } from '@/database/repositories/categories';
import { checkSpendingLimitNotifications } from '@/services/spendingLimits';
import { useAsync } from '@/hooks/useAsync';
import { useMoneyInput } from '@/hooks/useMoneyInput';
import { formatCurrency } from '@/utils/currency';
import { formatDateDayMonth } from '@/utils/date';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type Category, type PaymentMethod } from '@/database/types';
import { usePaymentUndo } from '@/hooks/usePaymentUndo';
import { PaymentUndoToast } from '@/components/PaymentUndoToast';

export default function ExpenseDetailScreen() {
  const { colors, typography, radii, spacing } = useTheme();
  const { invalidate } = useDatabase();
  const paymentUndo = usePaymentUndo();
  const { id } = useLocalSearchParams<{ id: string }>();
  const expenseId = Number(id);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [isPaid, setIsPaid] = useState<boolean | null>(null);

  const [dateOpen, setDateOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  const expense = useAsync((db) => variableRepo.byId(db, expenseId), [expenseId], null);
  const amount = useMoneyInput(expense.data?.amount_cents ?? 0);

  // As categorias só interessam no modo de edição; buscar antes abriria uma
  // consulta que a maioria das visitas não usa.
  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    void (async () => {
      const rows = await categoriesRepo.list(await getDatabase(), 'variable');
      if (!cancelled) setCategories(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [editing]);

  if (!expenseId || Number.isNaN(expenseId)) {
    return (
      <DetailScreen title="Lançamento" backTo="/gastos">
        <AppText style={[typography.body, { color: colors.textTertiary }]}>
          Referência inválida: este link não aponta para um gasto.
        </AppText>
      </DetailScreen>
    );
  }

  if (expense.loading) {
    return (
      <DetailScreen title="Carregando" backTo="/gastos">
        <Skeleton height={140} />
        <Skeleton height={56} />
        <Skeleton height={56} />
      </DetailScreen>
    );
  }

  const row = expense.data;
  if (!row) {
    return (
      <DetailScreen title="Não encontrado" backTo="/gastos">
        <AppText style={[typography.body, { color: colors.textTertiary }]}>
          Este gasto foi removido ou nunca existiu.
        </AppText>
      </DetailScreen>
    );
  }

  const currentDate = date ?? row.date;
  const currentCategoryId = categoryId ?? row.category_id;
  const currentNote = note ?? row.description ?? '';
  const currentMethod = method ?? row.method;
  const currentIsPaid = isPaid ?? row.is_paid === 1;
  const category = categories.find((c) => c.id === currentCategoryId) ?? null;

  const startEditing = () => {
    amount.set(row.amount_cents);
    setDate(row.date);
    setCategoryId(row.category_id);
    setNote(row.description ?? '');
    setMethod(row.method);
    setIsPaid(row.is_paid === 1);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDate(null);
    setCategoryId(null);
    setNote(null);
    setMethod(null);
    setIsPaid(null);
  };

  const remove = () => {
    confirmDelete('Excluir gasto?', 'Esta ação não pode ser desfeita.', async () => {
      const db = await getDatabase();
      await variableRepo.remove(db, expenseId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      invalidate();
      router.replace('/gastos');
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const db = await getDatabase();
      await variableRepo.update(db, expenseId, {
        amount_cents: amount.cents,
        date: currentDate,
        category_id: currentCategoryId,
        description: note?.trim() || null,
        method: currentMethod,
        is_paid: currentIsPaid,
      });
      void checkSpendingLimitNotifications(db).catch((error: unknown) => {
        console.error('Não foi possível verificar os alertas de limite após editar o gasto.', error);
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      cancel();
    } finally {
      setSaving(false);
    }
  };

  const togglePaid = async () => {
    try {
      const db = await getDatabase();
      await variableRepo.setPaid(db, expenseId, row.is_paid !== 1);
      await Haptics.notificationAsync(
        row.is_paid ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success
      );
      invalidate();
      paymentUndo.offerUndo(
        row.is_paid ? 'Gasto marcado como pendente' : 'Gasto marcado como pago',
        async () => {
          await variableRepo.setPaid(db, expenseId, row.is_paid === 1);
          invalidate();
        }
      );
    } catch (error) {
      Alert.alert('Não foi possível atualizar o pagamento', error instanceof Error ? error.message : undefined);
    }
  };

  return (
    <DetailScreen
      title="Gasto"
      subtitle={formatDateDayMonth(currentDate)}
      backTo="/gastos"
      overlay={
        <PaymentUndoToast
          message={paymentUndo.message}
          onUndo={() => void paymentUndo.undo()}
          bottomOffset={80}
        />
      }
      footer={
        editing ? (
          <>
            <Button label="Cancelar" variant="ghost" onPress={cancel} style={styles.flex} />
            <Button
              label="Salvar"
              variant="primary"
              icon="check"
              loading={saving}
              onPress={() => void save()}
              style={styles.flex}
            />
          </>
        ) : (
          <>
            <Button
              label="Editar"
              variant="secondary"
              icon="edit"
              onPress={startEditing}
              style={styles.flex}
            />
            <Button
              label="Excluir"
              variant="danger"
              icon="trash"
              onPress={remove}
              style={styles.flex}
            />
          </>
        )
      }
    >
      <Animated.View
        entering={FadeInDown.duration(220)}
        style={[
          styles.amountCard,
          {
            borderRadius: radii.xl,
            backgroundColor: colors.expenseDim,
            borderColor: colors.borderStrong,
            padding: spacing.xxl,
          },
        ]}
      >
        <Icon name="arrowDownLeft" size={22} color={colors.expense} strokeWidth={2.2} />
        <Amount cents={editing ? amount.cents : row.amount_cents} variant="xl" tone="expense" />
        {editing && amount.dirty ? (
          <AppText style={[typography.caption, { color: colors.textTertiary }]}>
            {formatCurrency(amount.cents)}
          </AppText>
        ) : null}
      </Animated.View>

      {/* O valor só é editável com o teclado numérico; sem ele, o campo de
          edição ficaria preso no número original. */}
      {editing ? <AmountPad value={amount} label="Valor do gasto" accentColor={colors.expense} /> : null}

      <DetailRow
        label="Data"
        value={formatDateDayMonth(currentDate)}
        icon="calendar"
        editable={editing}
        onPress={editing ? () => setDateOpen(true) : undefined}
      />
      <DetailRow
        label="Pagamento"
        value={PAYMENT_METHOD_LABELS[currentMethod]}
        icon="creditCard"
        editable={editing}
        onPress={editing ? () => setMethodOpen(true) : undefined}
      />
      <DetailRow
        label={currentMethod === 'credito' ? 'Fatura do cartão' : 'Status'}
        value={currentIsPaid ? (currentMethod === 'credito' ? 'Paga' : 'Pago') : 'Pendente'}
        icon={currentIsPaid ? 'check' : 'calendarClock'}
        editable={!editing}
        onPress={!editing ? () => void togglePaid() : undefined}
      />
      {currentMethod === 'credito' ? (
        <AppText style={[typography.caption, { color: colors.textTertiary }]}>
          A compra conta em Gastos na data da compra. O saldo do mês só muda quando você marca a fatura como paga.
        </AppText>
      ) : null}
      <DetailRow
        label="Categoria"
        value={category?.name ?? 'Sem categoria'}
        icon={category?.icon ?? 'palette'}
        editable={editing}
        onPress={editing ? () => setCategoryOpen(true) : undefined}
      />

      {editing ? (
        <Input
          label="Observação"
          icon="fileText"
          placeholder="Opcional"
          value={currentNote}
          onChangeText={setNote}
          onClear={() => setNote('')}
          maxLength={80}
        />
      ) : currentNote ? (
        <DetailRow label="Observação" value={currentNote} icon="fileText" />
      ) : null}

      <CategoryPickerSheet
        visible={categoryOpen}
        categories={categories}
        value={currentCategoryId}
        onClose={() => setCategoryOpen(false)}
        onSelect={(selected) => {
          setCategoryId(selected.id);
          setCategoryOpen(false);
        }}
      />

      <DatePickerSheet
        visible={dateOpen}
        value={currentDate}
        onClose={() => setDateOpen(false)}
        onSelect={(timestamp) => {
          setDate(timestamp);
          setDateOpen(false);
        }}
      />
      <Sheet visible={methodOpen} onClose={() => setMethodOpen(false)} title="Forma de pagamento">
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.lg }}>
          {PAYMENT_METHODS.map((value) => (
            <DetailRow
              key={value}
              label={PAYMENT_METHOD_LABELS[value]}
              value={value === currentMethod ? 'Atual' : ''}
              icon="creditCard"
              onPress={() => {
                setMethod(value);
                if (value === 'credito' && currentMethod !== 'credito') setIsPaid(false);
                setMethodOpen(false);
              }}
            />
          ))}
        </View>
      </Sheet>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  amountCard: {
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
});