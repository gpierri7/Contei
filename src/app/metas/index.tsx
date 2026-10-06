import React, { useState } from 'react';
import { StyleSheet,  View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';


import { Amount, Button, EmptyState, Input, Skeleton } from '@/components/ui';
import { GoalCard, Sheet } from '@/components/dashboard';
import { DetailScreen } from '@/components/DetailScreen';
import { useTheme } from '@/theme';
import { getDatabase, useDatabase } from '@/database/DatabaseProvider';
import { goalsRepo } from '@/database/repositories/goals';
import { useAsync } from '@/hooks/useAsync';
import { useMoneyInput } from '@/hooks/useMoneyInput';
import { categoryColors } from '@/theme/colors';
import { formatCurrency } from '@/utils/currency';

const GOAL_ICONS = ['target', 'plane', 'gift', 'car', 'home', 'smartphone'];

export default function GoalsScreen() {
  const { colors, typography, radii, spacing, gutter } = useTheme();
  const { invalidate } = useDatabase();
  const [formOpen, setFormOpen] = useState(false);

  const goals = useAsync((db) => goalsRepo.list(db, { onlyOpen: true }), [], []);
  const archived = useAsync((db) => goalsRepo.list(db), [], []);

  const amount = useMoneyInput();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const closedCount = archived.data.length - goals.data.length;
  const totalTarget = goals.data.reduce((sum, g) => sum + g.target_cents, 0);
  const totalSaved = goals.data.reduce((sum, g) => sum + g.saved_cents, 0);

  const create = async () => {
    if (!name.trim() || amount.cents <= 0 || saving) return;
    setSaving(true);
    try {
      const db = await getDatabase();
      const color = categoryColors[goals.data.length % categoryColors.length];
      await goalsRepo.create(db, {
        name: name.trim(),
        target_cents: amount.cents,
        color,
        icon: GOAL_ICONS[goals.data.length % GOAL_ICONS.length],
      });

      // Sem depósito automático: o valor digitado é a meta, não o que já foi
      // guardado. Depositar aqui criaria a meta já concluída. O primeiro aporte
      // é feito na tela da meta.
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      setName('');
      amount.clear();
      setFormOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailScreen
      title="Metas"
      subtitle={`${goals.data.length} em andamento`}
      backTo="/"
      footer={
        <Button
          label="Nova meta"
          variant="secondary"
          icon="plus"
          fullWidth
          onPress={() => setFormOpen(true)}
        />
      }
    >
      {goals.data.length > 0 ? (
        <Animated.View
          entering={FadeInDown.duration(200)}
          style={[
            styles.summary,
            {
              borderRadius: radii.xl,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              padding: spacing.xl,
            },
          ]}
        >
          <View style={styles.flex}>
            <AppText style={[typography.caption, { color: colors.textTertiary }]}>Guardado</AppText>
            <Amount cents={totalSaved} variant="lg" tone="income" />
          </View>
          <View style={[styles.flex, { alignItems: 'flex-end' }]}>
            <AppText style={[typography.caption, { color: colors.textTertiary }]}>Objetivo total</AppText>
            <Amount cents={totalTarget} variant="lg" tone="muted" />
          </View>
        </Animated.View>
      ) : null}

      {goals.loading ? (
        <>
          <Skeleton height={110} />
          <Skeleton height={110} />
        </>
      ) : goals.data.length === 0 ? (
        <EmptyState
          icon="target"
          title="Nenhuma meta ainda"
          message="Uma meta é só um valor com nome e data. “Viagem em December”, “notebook novo” — o resto o app calcula."
          actionLabel="Criar primeira meta"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {goals.data.map((goal, index) => (
            <Animated.View key={goal.id} entering={FadeInDown.delay(index * 50).duration(220)}>
              <GoalCard
                name={goal.name}
                color={goal.color}
                icon={goal.icon}
                savedCents={goal.saved_cents}
                targetCents={goal.target_cents}
                ratio={goal.target_cents > 0 ? goal.saved_cents / goal.target_cents : 0}
                deadline={goal.deadline}
                onPress={() => router.push(`/metas/${goal.id}`)}
              />
            </Animated.View>
          ))}
        </View>
      )}

      {closedCount > 0 ? (
        <AppText style={[typography.caption, { color: colors.textTertiary, textAlign: 'center' }]}>
          {closedCount} meta{closedCount > 1 ? 's' : ''} já concluída{closedCount > 1 ? 's' : ''}
        </AppText>
      ) : null}

      <Sheet
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nova meta"
        maxHeightRatio={0.7}
      >
        <View style={{ paddingHorizontal: gutter, gap: spacing.lg, paddingBottom: spacing.lg }}>
          <Input
            label="Nome da meta"
            icon="target"
            placeholder="Ex.: Notebook novo"
            value={name}
            onChangeText={setName}
            onClear={() => setName('')}
            maxLength={40}
          />

          <Input
            label="Quanto você quer juntar"
            icon="wallet"
            placeholder="0,00"
            value={amount.text}
            onChangeText={amount.setText}
            onClear={amount.clear}
            keyboardType="decimal-pad"
          />

          {amount.cents > 0 ? (
            <AppText style={[typography.caption, { color: colors.textTertiary }]}>
              Meta de {formatCurrency(amount.cents)}
            </AppText>
          ) : null}

          <Button
            label="Criar meta"
            variant="primary"
            icon="check"
            fullWidth
            loading={saving}
            disabled={!name.trim() || amount.cents <= 0}
            onPress={() => void create()}
          />
        </View>
      </Sheet>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  summary: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
  },
});