import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { Amount, Button, Input, Skeleton } from '@/components/ui';
import { DetailRow, DetailScreen, confirmDelete } from '@/components/DetailScreen';
import { AmountPad, DatePickerSheet, Sheet } from '@/components/dashboard';
import { useTheme } from '@/theme';
import { getDatabase, useDatabase } from '@/database/DatabaseProvider';
import { incomesRepo, sourcesRepo } from '@/database/repositories/incomes';
import { useAsync } from '@/hooks/useAsync';
import { useMoneyInput } from '@/hooks/useMoneyInput';
import { formatCurrency } from '@/utils/currency';
import { formatDateDayMonth } from '@/utils/date';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from '@/database/types';

export default function IncomeDetailScreen() {
  const { colors, typography, radii, spacing } = useTheme();
  const { invalidate } = useDatabase();
  const { id } = useLocalSearchParams<{ id: string }>();
  const incomeId = Number(id);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState<number | null>(null);
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);

  const income = useAsync((db) => incomesRepo.byId(db, incomeId), [incomeId], null);
  const amount = useMoneyInput(income.data?.amount_cents ?? 0);

  const sources = useAsync((db) => sourcesRepo.list(db), [], []);

  if (!incomeId || Number.isNaN(incomeId)) {
    return (
      <DetailScreen title="Ganho" backTo="/ganhos">
        <AppText style={[typography.body, { color: colors.textTertiary }]}>
          Referência inválida: este link não aponta para um ganho.
        </AppText>
      </DetailScreen>
    );
  }

  if (income.loading) {
    return (
      <DetailScreen title="Carregando" backTo="/ganhos">
        <Skeleton height={140} />
        <Skeleton height={56} />
      </DetailScreen>
    );
  }

  const row = income.data;
  if (!row) {
    return (
      <DetailScreen title="Não encontrado" backTo="/ganhos">
        <AppText style={[typography.body, { color: colors.textTertiary }]}>
          Este ganho foi removido ou nunca existiu.
        </AppText>
      </DetailScreen>
    );
  }

  const currentDate = date ?? row.date;
  const currentSourceId = sourceId ?? row.source_id;
  const currentNote = note ?? row.description ?? '';
  const currentMethod = method ?? row.method;
  const source = sources.data.find((s) => s.id === currentSourceId) ?? null;

  const startEditing = () => {
    amount.set(row.amount_cents);
    setDate(row.date);
    setSourceId(row.source_id);
    setNote(row.description ?? '');
    setMethod(row.method);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDate(null);
    setSourceId(null);
    setNote(null);
    setMethod(null);
  };

  const remove = () => {
    confirmDelete('Excluir ganho?', 'Esta ação não pode ser desfeita.', async () => {
      const db = await getDatabase();
      await incomesRepo.remove(db, incomeId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      invalidate();
      router.replace('/ganhos');
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const db = await getDatabase();
      await incomesRepo.update(db, incomeId, {
        amount_cents: amount.cents,
        date: currentDate,
        source_id: currentSourceId,
        description: note?.trim() || null,
        method: currentMethod,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      cancel();
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailScreen
      title="Ganho"
      subtitle={formatDateDayMonth(currentDate)}
      backTo="/ganhos"
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
            backgroundColor: colors.incomeDim,
            borderColor: colors.borderStrong,
            padding: spacing.xxl,
          },
        ]}
      >
        <Icon name="arrowUpRight" size={22} color={colors.income} strokeWidth={2.2} />
        <Amount cents={editing ? amount.cents : row.amount_cents} variant="xl" tone="income" />
        {editing && amount.dirty ? (
          <AppText style={[typography.caption, { color: colors.textTertiary }]}>
            {formatCurrency(amount.cents)}
          </AppText>
        ) : null}
      </Animated.View>

      {/* Ver o valor e poder mudá-lo exige o teclado numérico. */}
      {editing ? <AmountPad value={amount} label="Valor do ganho" accentColor={colors.income} /> : null}

      <DetailRow
        label="Data"
        value={formatDateDayMonth(currentDate)}
        icon="calendar"
        editable={editing}
        onPress={editing ? () => setDateOpen(true) : undefined}
      />
      <DetailRow
        label="Fonte"
        value={source?.name ?? 'Sem fonte'}
        icon={source?.icon ?? 'wallet'}
        editable={editing}
        onPress={editing ? () => setSourceOpen(true) : undefined}
      />
      <DetailRow
        label="Recebido em"
        value={PAYMENT_METHOD_LABELS[currentMethod]}
        icon="creditCard"
        editable={editing}
        onPress={editing ? () => setMethodOpen(true) : undefined}
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

      <DatePickerSheet
        visible={dateOpen}
        value={currentDate}
        onClose={() => setDateOpen(false)}
        onSelect={(timestamp) => {
          setDate(timestamp);
          setDateOpen(false);
        }}
      />

      <Sheet visible={sourceOpen} onClose={() => setSourceOpen(false)} title="Fonte do ganho">
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.lg }}>
          {sources.data.map((item) => (
            <DetailRow
              key={item.id}
              label={item.name}
              value={item.id === currentSourceId ? 'Atual' : ''}
              icon={item.icon}
              onPress={() => {
                setSourceId(item.id);
                setSourceOpen(false);
              }}
            />
          ))}
        </View>
      </Sheet>
      <Sheet visible={methodOpen} onClose={() => setMethodOpen(false)} title="Forma de recebimento">
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.lg }}>
          {PAYMENT_METHODS.map((value) => (
            <DetailRow
              key={value}
              label={PAYMENT_METHOD_LABELS[value]}
              value={value === currentMethod ? 'Atual' : ''}
              icon="creditCard"
              onPress={() => {
                setMethod(value);
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