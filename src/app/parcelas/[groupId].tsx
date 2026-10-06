import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText, Amount, Button, Input } from '@/components/ui';
import { AmountPad, CategoryPickerSheet, DatePickerSheet, Sheet } from '@/components/dashboard';
import { DetailRow, DetailScreen, confirmDelete } from '@/components/DetailScreen';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme';
import { getDatabase, useDatabase } from '@/database/DatabaseProvider';
import { installmentsRepo } from '@/database/repositories/installments';
import { categoriesRepo } from '@/database/repositories/categories';
import { useAsync } from '@/hooks/useAsync';
import { useMoneyInput } from '@/hooks/useMoneyInput';
import { formatCurrency } from '@/utils/currency';
import { formatDateDayMonth } from '@/utils/date';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type Category, type PaymentMethod } from '@/database/types';
import { usePaymentUndo } from '@/hooks/usePaymentUndo';
import { PaymentUndoToast } from '@/components/PaymentUndoToast';

export default function InstallmentDetailScreen() {
  const { colors, typography, radii, spacing } = useTheme();
  const { invalidate } = useDatabase();
  const paymentUndo = usePaymentUndo();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const group = useAsync(
    (db) => installmentsRepo.listByGroup(db, groupId),
    [groupId],
    []
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const amount = useMoneyInput(group.data[0]?.amount_cents ?? 0);
  const categories = useAsync<Category[]>(
    (db) => categoriesRepo.list(db, 'variable'),
    [editing],
    []
  );

  const rows = group.data;
  const first = rows[0];
  const selectedCategoryId = categoryId ?? first?.category_id ?? null;
  const selectedCategory = useMemo(
    () => categories.data.find((item) => item.id === selectedCategoryId),
    [categories.data, selectedCategoryId]
  );
  const firstDueDate = date ?? first?.due_date ?? 0;
  const selectedMethod = method ?? first?.method ?? 'credito';
  const note = description ?? first?.description ?? '';

  const beginEditing = () => {
    if (!first) return;
    amount.set(first.amount_cents);
    setDate(first.due_date);
    setCategoryId(first.category_id);
    setMethod(first.method);
    setDescription(first.description ?? '');
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setDate(null);
    setCategoryId(null);
    setMethod(null);
    setDescription(null);
  };

  const save = async () => {
    if (!first || amount.cents <= 0 || !selectedCategoryId || saving) return;
    setSaving(true);
    try {
      await installmentsRepo.updateGroup(await getDatabase(), groupId, {
        description: note.trim() || null,
        category_id: selectedCategoryId,
        amount_cents: amount.cents,
        first_due_date: firstDueDate,
        method: selectedMethod,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      cancelEditing();
    } catch (error) {
      Alert.alert('Não foi possível salvar a compra', error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const togglePaid = async (id: number, isPaid: number) => {
    try {
      const db = await getDatabase();
      await installmentsRepo.setPaid(db, id, isPaid !== 1);
      await Haptics.notificationAsync(
        isPaid ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success
      );
      invalidate();
      paymentUndo.offerUndo(
        isPaid ? 'Parcela marcada como pendente' : 'Parcela marcada como paga',
        async () => {
          await installmentsRepo.setPaid(db, id, isPaid === 1);
          invalidate();
        }
      );
    } catch (error) {
      Alert.alert('Não foi possível atualizar o pagamento', error instanceof Error ? error.message : undefined);
    }
  };

  if (!groupId) {
    return <DetailScreen title="Compra parcelada" backTo="/parcelas"><AppText>Referência inválida.</AppText></DetailScreen>;
  }
  if (group.loading) {
    return <DetailScreen title="Carregando" backTo="/parcelas"><AppText>Carregando parcelas...</AppText></DetailScreen>;
  }
  if (!first) {
    return <DetailScreen title="Não encontrada" backTo="/parcelas"><AppText>Esta compra não foi encontrada.</AppText></DetailScreen>;
  }

  return (
    <DetailScreen
      title="Compra parcelada"
      subtitle={`${rows.length} parcelas`}
      backTo="/parcelas"
      overlay={
        <PaymentUndoToast
          message={paymentUndo.message}
          onUndo={() => void paymentUndo.undo()}
          bottomOffset={80}
        />
      }
      footer={editing ? (
        <>
          <Button label="Cancelar" variant="ghost" onPress={cancelEditing} style={styles.flex} />
          <Button label="Salvar" variant="primary" icon="check" loading={saving} onPress={() => void save()} style={styles.flex} />
        </>
      ) : (
        <>
          <Button label="Editar compra" variant="secondary" icon="edit" onPress={beginEditing} style={styles.flex} />
          <Button
            label="Excluir"
            variant="danger"
            icon="trash"
            onPress={() => confirmDelete('Excluir compra parcelada?', 'Todas as parcelas serão removidas.', async () => {
              await installmentsRepo.removeGroup(await getDatabase(), groupId);
              invalidate();
              router.replace('/parcelas');
            })}
            style={styles.flex}
          />
        </>
      )}
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
        <Icon name="creditCard" size={22} color={colors.expense} strokeWidth={2.2} />
        <Amount cents={editing ? amount.cents * rows.length : rows.reduce((sum, row) => sum + row.amount_cents, 0)} variant="xl" tone="expense" />
        <AppText style={[typography.caption, { color: colors.textTertiary }]}>
          {rows.length}x de {formatCurrency(editing ? amount.cents : first.amount_cents)}
        </AppText>
      </Animated.View>

      {editing ? <AmountPad value={amount} label="Valor de cada parcela" accentColor={colors.expense} /> : null}
      <DetailRow
        label="1º vencimento"
        value={formatDateDayMonth(firstDueDate)}
        icon="calendar"
        editable={editing}
        onPress={editing ? () => setDateOpen(true) : undefined}
      />
      <DetailRow
        label="Categoria"
        value={selectedCategory?.name ?? first.category_name}
        icon={selectedCategory?.icon ?? first.category_icon}
        editable={editing}
        onPress={editing ? () => setCategoryOpen(true) : undefined}
      />
      <DetailRow
        label="Pagamento"
        value={PAYMENT_METHOD_LABELS[selectedMethod]}
        icon="creditCard"
        editable={editing}
        onPress={editing ? () => setMethodOpen(true) : undefined}
      />
      {editing ? (
        <Input label="Observação" icon="fileText" placeholder="Opcional" value={note} onChangeText={setDescription} onClear={() => setDescription('')} maxLength={80} />
      ) : note ? <DetailRow label="Observação" value={note} icon="fileText" /> : null}

      <View style={{ gap: spacing.sm }}>
        <AppText style={[typography.label, { color: colors.textSecondary }]}>Parcelas</AppText>
        {rows.map((row) => {
          const paid = row.is_paid === 1;
          return (
            <View
              key={row.id}
              style={[
                styles.installmentRow,
                { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, padding: spacing.md },
              ]}
            >
              <View style={styles.flex}>
                <AppText style={[typography.bodyStrong, { color: paid ? colors.textTertiary : colors.text }]}>
                  Parcela {row.current_number} de {row.total_count}
                </AppText>
                <AppText style={[typography.caption, { color: colors.textTertiary }]}>
                  Vence {formatDateDayMonth(row.due_date)}{paid && row.paid_at ? ` · paga ${formatDateDayMonth(row.paid_at)}` : ''}
                </AppText>
              </View>
              <Amount cents={row.amount_cents} variant="sm" tone={paid ? 'muted' : 'default'} />
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ checked: paid }}
                accessibilityLabel={paid ? `Reabrir parcela ${row.current_number}` : `Confirmar pagamento da parcela ${row.current_number}`}
                onPress={() => void togglePaid(row.id, row.is_paid)}
                style={[styles.check, { borderColor: paid ? colors.income : colors.borderStrong, backgroundColor: paid ? colors.income : 'transparent' }]}
              >
                <Icon name="check" size={14} color={paid ? colors.textOnPrimary : colors.textTertiary} strokeWidth={2.8} />
              </Pressable>
            </View>
          );
        })}
      </View>

      <DatePickerSheet visible={dateOpen} value={firstDueDate} onClose={() => setDateOpen(false)} onSelect={(value) => { setDate(value); setDateOpen(false); }} />
      <CategoryPickerSheet visible={categoryOpen} categories={categories.data} value={selectedCategoryId} onClose={() => setCategoryOpen(false)} onSelect={(category) => { setCategoryId(category.id); setCategoryOpen(false); }} />
      <Sheet visible={methodOpen} onClose={() => setMethodOpen(false)} title="Forma de pagamento">
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.lg }}>
          {PAYMENT_METHODS.map((value) => (
            <DetailRow key={value} label={PAYMENT_METHOD_LABELS[value]} value={value === selectedMethod ? 'Atual' : ''} icon="creditCard" onPress={() => { setMethod(value); setMethodOpen(false); }} />
          ))}
        </View>
      </Sheet>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  amountCard: { alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth },
  installmentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth },
  check: { width: 26, height: 26, borderWidth: 2, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
