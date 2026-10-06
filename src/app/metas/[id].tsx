import React, { useState } from 'react';
import { StyleSheet,  View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { Amount, Button, Input, ProgressBar, Skeleton } from '@/components/ui';
import { DetailRow, DetailScreen, confirmDelete } from '@/components/DetailScreen';
import { AmountPad, Sheet } from '@/components/dashboard';
import { useTheme } from '@/theme';
import { getDatabase, useDatabase } from '@/database/DatabaseProvider';
import { goalsRepo } from '@/database/repositories/goals';
import { useAsync } from '@/hooks/useAsync';
import { useMoneyInput } from '@/hooks/useMoneyInput';
import { formatCurrency } from '@/utils/currency';
import { formatDateDayMonth } from '@/utils/date';

/**
 * Detalhe de uma meta.
 *
 * A ação principal é guardar dinheiro, então o teclado de valor fica sempre a
 * um toque de distância em vez de escondido atrás de um formulário. O resto da
 * tela explica em que pé a meta está e quanto falta por mês para chegar lá.
 */
export default function GoalDetailScreen() {
  const { colors, typography, radii, spacing } = useTheme();
  const { invalidate } = useDatabase();
  const { id } = useLocalSearchParams<{ id: string }>();
  const goalId = Number(id);

  const [depositOpen, setDepositOpen] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const goals = useAsync((db) => goalsRepo.list(db), [], []);
  const deposits = useAsync((db) => goalsRepo.deposits(db, goalId), [goalId], []);

  const depositAmount = useMoneyInput();

  if (!goalId || Number.isNaN(goalId)) {
    return (
      <DetailScreen title="Meta" backTo="/metas">
        <AppText style={[typography.body, { color: colors.textTertiary }]}>
          Referência inválida: este link não aponta para uma meta.
        </AppText>
      </DetailScreen>
    );
  }

  if (goals.loading) {
    return (
      <DetailScreen title="Carregando" backTo="/metas">
        <Skeleton height={160} />
        <Skeleton height={56} />
      </DetailScreen>
    );
  }

  const goal = goals.data.find((g) => g.id === goalId);
  if (!goal) {
    return (
      <DetailScreen title="Não encontrada" backTo="/metas">
        <AppText style={[typography.body, { color: colors.textTertiary }]}>
          Esta meta foi removida ou nunca existiu.
        </AppText>
      </DetailScreen>
    );
  }

  const remaining = Math.max(0, goal.target_cents - goal.saved_cents);
  const ratio = goal.target_cents > 0 ? goal.saved_cents / goal.target_cents : 0;
  const done = remaining === 0;

  // Quanto por mês até o prazo, arredondado para cima: um plano de R$ 10,33 por
  // mês é um plano que ninguém cumpre.
  const monthsLeft = monthsUntil(goal.deadline);
  const perMonth = monthsLeft > 0 ? Math.ceil(remaining / monthsLeft) : remaining;

  const addDeposit = async () => {
    if (depositAmount.cents <= 0 || saving) return;
    setSaving(true);
    try {
      const db = await getDatabase();
      await goalsRepo.addDeposit(db, goalId, depositAmount.cents, Date.now(), note.trim() || null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      depositAmount.clear();
      setNote('');
      setDepositOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const removeDeposit = (depositId: number) => {
    confirmDelete('Remover depósito?', 'O valor sai da meta.', async () => {
      const db = await getDatabase();
      await goalsRepo.removeDeposit(db, depositId);
      invalidate();
    });
  };

  const archive = () => {
    confirmDelete('Arquivar meta?', 'Ela sai da lista de metas em andamento.', async () => {
      const db = await getDatabase();
      await goalsRepo.update(db, goalId, { archived: 1 });
      invalidate();
      router.replace('/metas');
    });
  };

  return (
    <DetailScreen
      title={goal.name}
      subtitle={done ? 'Meta concluída' : `Faltam ${formatCurrency(remaining)}`}
      backTo="/metas"
      footer={
        <>
          <Button
            label="Guardar"
            variant="primary"
            icon="plus"
            style={styles.flex}
            onPress={() => setDepositOpen(true)}
          />
          <Button label="Arquivar" variant="ghost" icon="archive" onPress={archive} />
        </>
      }
    >
      <Animated.View
        entering={FadeInDown.duration(220)}
        style={[
          styles.hero,
          {
            borderRadius: radii.xl,
            backgroundColor: `${goal.color}14`,
            borderColor: `${goal.color}33`,
            padding: spacing.xxl,
          },
        ]}
      >
        <View
          style={[
            styles.disc,
            { backgroundColor: `${goal.color}26`, borderRadius: radii.pill },
          ]}
        >
          <Icon name={goal.icon} size={26} color={goal.color} strokeWidth={2.1} />
        </View>

        <Amount cents={goal.saved_cents} variant="xl" />
        <AppText style={[typography.caption, { color: colors.textTertiary }]}>
          de {formatCurrency(goal.target_cents)} · {Math.round(ratio * 100)}%
        </AppText>

        <View style={styles.progress}>
          <ProgressBar ratio={ratio} color={done ? colors.income : goal.color} height={10} />
        </View>
      </Animated.View>

      <DetailRow
        label="Falta guardar"
        value={done ? 'Nada' : formatCurrency(remaining)}
        icon="target"
        tone={done ? 'income' : 'default'}
      />
      {goal.deadline ? (
        <DetailRow
          label="Prazo"
          value={`${formatDateDayMonth(goal.deadline)} · ${monthsLeft} meses`}
          icon="calendar"
        />
      ) : null}
      {goal.deadline && !done ? (
        <DetailRow
          label="Por mês até lá"
          value={formatCurrency(perMonth)}
          icon="wallet"
          tone={perMonth > 0 ? 'default' : 'expense'}
        />
      ) : null}

      <View style={{ gap: spacing.md }}>
        <AppText style={[typography.h4, { color: colors.text }]}>Depósitos</AppText>

        {deposits.loading ? (
          <Skeleton height={60} />
        ) : deposits.data.length === 0 ? (
          <AppText style={[typography.caption, { color: colors.textTertiary }]}>
            Nenhum depósito ainda. Guarda o primeiro valor e a meta começa a andar.
          </AppText>
        ) : (
          deposits.data.map((deposit) => (
            <DetailRow
              key={deposit.id}
              label={formatDateDayMonth(deposit.date)}
              value={formatCurrency(deposit.amount_cents)}
              icon="plus"
              tone="income"
              onDelete={() => removeDeposit(deposit.id)}
            />
          ))
        )}
      </View>

      <Sheet
        visible={depositOpen}
        onClose={() => setDepositOpen(false)}
        title="Guardar na meta"
        maxHeightRatio={0.85}
      >
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
          <AmountPad
            value={depositAmount}
            label={`Guardando em ${goal.name}`}
            accentColor={goal.color}
          />

          <Input
            label="Observação"
            icon="fileText"
            placeholder="Opcional"
            value={note}
            onChangeText={setNote}
            onClear={() => setNote('')}
            maxLength={60}
          />

          <Button
            label={`Guardar ${formatCurrency(depositAmount.cents)}`}
            variant="primary"
            icon="check"
            fullWidth
            loading={saving}
            disabled={depositAmount.cents <= 0}
            onPress={() => void addDeposit()}
          />
        </View>
      </Sheet>
    </DetailScreen>
  );
}

function monthsUntil(deadline: number | null): number {
  if (!deadline) return 0;
  const now = new Date();
  const target = new Date(deadline);
  return Math.max(
    0,
    (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth())
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  hero: {
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  disc: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  progress: {
    width: '100%',
    marginTop: 14,
  },
});