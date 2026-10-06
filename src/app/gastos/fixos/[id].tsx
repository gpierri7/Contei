import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { AppText, Amount, Button, Input } from '@/components/ui';
import { AmountPad, CategoryPickerSheet, DatePickerSheet, Sheet } from '@/components/dashboard';
import { DetailRow, DetailScreen, confirmDelete } from '@/components/DetailScreen';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme';
import { getDatabase, useDatabase } from '@/database/DatabaseProvider';
import { fixedRepo } from '@/database/repositories/expenses';
import { categoriesRepo } from '@/database/repositories/categories';
import { useAsync } from '@/hooks/useAsync';
import { useMoneyInput } from '@/hooks/useMoneyInput';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type Category, type PaymentMethod } from '@/database/types';

export default function FixedExpenseDetailScreen() {
  const { colors, radii, spacing } = useTheme();
  const { invalidate } = useDatabase();
  const { id } = useLocalSearchParams<{ id: string }>();
  const fixedId = Number(id);
  const expense = useAsync(
    async (db) => (await fixedRepo.list(db, true)).find((row) => row.id === fixedId) ?? null,
    [fixedId],
    null
  );
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [dueDay, setDueDay] = useState<number | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const categories = useAsync<Category[]>((db) => categoriesRepo.list(db, 'fixed'), [editing], []);
  const amount = useMoneyInput(expense.data?.amount_cents ?? 0);

  const row = expense.data;
  const selectedCategoryId = categoryId ?? row?.category_id ?? null;
  const selectedCategory = categories.data.find((item) => item.id === selectedCategoryId);
  const selectedDay = dueDay ?? row?.due_day ?? 1;
  const selectedMethod = method ?? row?.method ?? 'pix';
  const note = description ?? row?.description ?? '';
  const dayTimestamp = new Date(new Date().getFullYear(), new Date().getMonth(), selectedDay).getTime();

  if (!fixedId || Number.isNaN(fixedId)) {
    return <DetailScreen title="Conta fixa" backTo="/gastos/fixos"><AppText>Referência inválida.</AppText></DetailScreen>;
  }
  if (expense.loading) {
    return <DetailScreen title="Carregando" backTo="/gastos/fixos"><AppText>Carregando conta fixa...</AppText></DetailScreen>;
  }
  if (!row) {
    return <DetailScreen title="Não encontrada" backTo="/gastos/fixos"><AppText>Esta conta fixa não foi encontrada.</AppText></DetailScreen>;
  }

  const beginEditing = () => {
    amount.set(row.amount_cents);
    setCategoryId(row.category_id);
    setDueDay(row.due_day);
    setMethod(row.method);
    setDescription(row.description ?? '');
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setCategoryId(null);
    setDueDay(null);
    setMethod(null);
    setDescription(null);
  };
  const save = async () => {
    if (amount.cents <= 0 || !selectedCategoryId || saving) return;
    setSaving(true);
    try {
      await fixedRepo.update(await getDatabase(), fixedId, {
        amount_cents: amount.cents,
        category_id: selectedCategoryId,
        due_day: selectedDay,
        method: selectedMethod,
        description: note.trim() || null,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      cancel();
    } catch (error) {
      Alert.alert('Não foi possível salvar a conta fixa', error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailScreen
      title="Conta fixa"
      subtitle={`Vence dia ${selectedDay}`}
      backTo="/gastos/fixos"
      footer={editing ? (
        <>
          <Button label="Cancelar" variant="ghost" onPress={cancel} style={styles.flex} />
          <Button label="Salvar" variant="primary" icon="check" loading={saving} onPress={() => void save()} style={styles.flex} />
        </>
      ) : (
        <>
          <Button label="Editar" variant="secondary" icon="edit" onPress={beginEditing} style={styles.flex} />
          <Button label="Excluir" variant="danger" icon="trash" onPress={() => confirmDelete('Excluir conta fixa?', 'Ela deixa de aparecer nos próximos meses.', async () => {
            await fixedRepo.remove(await getDatabase(), fixedId);
            invalidate();
            router.replace('/gastos/fixos');
          })} style={styles.flex} />
        </>
      )}
    >
      <View style={[styles.amountCard, { borderRadius: radii.xl, backgroundColor: colors.expenseDim, borderColor: colors.borderStrong, padding: spacing.xxl }]}>
        <Icon name="calendarClock" size={22} color={colors.expense} strokeWidth={2.2} />
        <Amount cents={editing ? amount.cents : row.amount_cents} variant="xl" tone="expense" />
      </View>
      {editing ? <AmountPad value={amount} label="Valor mensal" accentColor={colors.expense} /> : null}
      <DetailRow label="Vencimento" value={`Dia ${selectedDay}`} icon="calendar" editable={editing} onPress={editing ? () => setDateOpen(true) : undefined} />
      <DetailRow label="Categoria" value={selectedCategory?.name ?? row.category_name} icon={selectedCategory?.icon ?? row.category_icon} editable={editing} onPress={editing ? () => setCategoryOpen(true) : undefined} />
      <DetailRow label="Pagamento" value={PAYMENT_METHOD_LABELS[selectedMethod]} icon="creditCard" editable={editing} onPress={editing ? () => setMethodOpen(true) : undefined} />
      {editing ? (
        <Input label="Observação" icon="fileText" placeholder="Opcional" value={note} onChangeText={setDescription} onClear={() => setDescription('')} maxLength={80} />
      ) : note ? <DetailRow label="Observação" value={note} icon="fileText" /> : null}
      <CategoryPickerSheet visible={categoryOpen} categories={categories.data} value={selectedCategoryId} onClose={() => setCategoryOpen(false)} onSelect={(item) => { setCategoryId(item.id); setCategoryOpen(false); }} />
      <DatePickerSheet visible={dateOpen} value={dayTimestamp} onClose={() => setDateOpen(false)} onSelect={(value) => { setDueDay(new Date(value).getDate()); setDateOpen(false); }} />
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
});
