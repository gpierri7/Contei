import React, { useState } from 'react';
import { Pressable, StyleSheet,  View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { Amount, Button, EmptyState, Input, PillToggle } from '@/components/ui';
import { AmountPad, Sheet } from '@/components/dashboard';
import { DetailScreen } from '@/components/DetailScreen';
import { useTheme } from '@/theme';
import { getDatabase, useDatabase } from '@/database/DatabaseProvider';
import { investmentsRepo, movementsRepo, typesRepo } from '@/database/repositories/investments';
import { useAsync } from '@/hooks/useAsync';
import { useMoneyInput } from '@/hooks/useMoneyInput';

import type { InvestmentType } from '@/database/types';

const TYPE_ICONS = ['trendingUp', 'landmark', 'coins', 'wallet', 'pieChart'];

export default function InvestmentsScreen() {
  const { colors, typography, radii, spacing } = useTheme();
  const { invalidate } = useDatabase();

  const [movementFor, setMovementFor] = useState<{ id: number; name: string } | null>(null);
  const [kind, setKind] = useState<'aporte' | 'resgate'>('aporte');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState('');
  const [newTypeId, setNewTypeId] = useState<number | null>(null);

  const amount = useMoneyInput();

  const list = useAsync((db) => investmentsRepo.list(db), [], []);
  const totals = useAsync((db) => investmentsRepo.totalByType(db), [], []);
  const types = useAsync((db) => typesRepo.list(db), [], []);

  const balance = totals.data.reduce((sum, t) => sum + t.saldo, 0);
  const totalAportes = totals.data.reduce((sum, t) => sum + t.total_aportes, 0);
  const totalResgates = totals.data.reduce((sum, t) => sum + t.total_resgates, 0);

  const createInvestment = async () => {
    if (!newName.trim() || !saving) return;
    setSaving(true);
    try {
      const db = await getDatabase();
      await investmentsRepo.create(db, {
        name: newName.trim(),
        type_id: newTypeId ?? types.data[0]?.id ?? 0,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      setNewName('');
      setCreating(false);
    } finally {
      setSaving(false);
    }
  };

  const addMovement = async () => {
    if (!movementFor || amount.cents <= 0 || saving) return;
    setSaving(true);
    try {
      const db = await getDatabase();
      await movementsRepo.add(db, {
        investment_id: movementFor.id,
        kind,
        amount_cents: amount.cents,
        date: Date.now(),
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      amount.clear();
      setMovementFor(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DetailScreen
      title="Investimentos"
      subtitle={`${list.data.length} ativo${list.data.length === 1 ? '' : 's'}`}
      backTo="/mais"
      footer={
        <Button
          label="Novo investimento"
          variant="secondary"
          icon="plus"
          fullWidth
          onPress={() => setCreating(true)}
        />
      }
    >
      <Animated.View
        entering={FadeInDown.duration(200)}
        style={[
          styles.summary,
          {
            borderRadius: radii.xl,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            padding: spacing.xl,
            gap: spacing.md,
          },
        ]}
      >
        <AppText style={[typography.caption, { color: colors.textTertiary }]}>Patrimônio</AppText>
        <Amount cents={balance} variant="xl" tone={balance >= 0 ? 'income' : 'expense'} />

        <View style={styles.row}>
          <View style={styles.flex}>
            <AppText style={[typography.caption, { color: colors.textTertiary }]}>Aportes</AppText>
            <Amount cents={totalAportes} variant="sm" tone="muted" />
          </View>
          <View style={[styles.flex, { alignItems: 'flex-end' }]}>
            <AppText style={[typography.caption, { color: colors.textTertiary }]}>Resgates</AppText>
            <Amount cents={totalResgates} variant="sm" tone="muted" />
          </View>
        </View>
      </Animated.View>

      {list.data.length === 0 ? (
        <EmptyState
          icon="trendingUp"
          title="Nenhum investimento"
          message="Registre o que você tem guardado fora da conta corrente para acompanhar o patrimônio junto com o resto."
          actionLabel="Cadastrar investimento"
          onAction={() => setCreating(true)}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {list.data.map((investment, index) => {
            return (
              <Animated.View
                key={investment.id}
                entering={FadeInDown.delay(index * 45).duration(200)}
                style={[
                  styles.rowCard,
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
                  accessibilityLabel={`Registrar aporte em ${investment.name}`}
                  onPress={() => setMovementFor({ id: investment.id, name: investment.name })}
                  style={[
                    styles.disc,
{ backgroundColor: `${investment.type_color}1F`, borderRadius: radii.pill },
                ]}
              >
                <Icon
                  name={investment.type_icon || TYPE_ICONS[investment.type_id % TYPE_ICONS.length]}
                  size={20}
                  color={investment.type_color}
                  strokeWidth={2.1}
                />
                </Pressable>

                <View style={styles.flex}>
                  <AppText numberOfLines={1} style={[typography.bodyStrong, { color: colors.text }]}>
                    {investment.name}
                  </AppText>
                  <AppText style={[typography.caption, { color: colors.textTertiary }]}>
                    {investment.type_name}
                  </AppText>
                </View>

                <Amount cents={investment.saldo_cents} variant="md" />
              </Animated.View>
            );
          })}
        </View>
      )}

      <Sheet visible={creating} onClose={() => setCreating(false)} title="Novo investimento">
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg, paddingBottom: spacing.lg }}>
          <Input
            label="Nome"
            icon="trendingUp"
            placeholder="Ex.: Tesouro Selic 2029"
            value={newName}
            onChangeText={setNewName}
            onClear={() => setNewName('')}
            maxLength={40}
          />
          <View style={{ gap: spacing.sm }}>
            <AppText style={[typography.label, { color: colors.textTertiary }]}>Tipo</AppText>
            <View style={styles.chipRow}>
              {types.data.map((type) => (
                <TypeChip
                  key={type.id}
                  type={type}
                  selected={type.id === newTypeId}
                  onPress={() => setNewTypeId(type.id)}
                />
              ))}
            </View>
          </View>
          <Button
            label="Criar"
            variant="primary"
            icon="check"
            fullWidth
            loading={saving}
            disabled={!newName.trim()}
            onPress={() => void createInvestment()}
          />
        </View>
      </Sheet>

      <Sheet
        visible={Boolean(movementFor)}
        onClose={() => setMovementFor(null)}
        title={movementFor?.name ?? ''}
        maxHeightRatio={0.9}
      >
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg, paddingBottom: spacing.lg }}>
          <PillToggle
            options={[
              { value: 'aporte', label: 'Aporte' },
              { value: 'resgate', label: 'Resgate' },
            ]}
            value={kind}
            onChange={(next) => setKind(next as 'aporte' | 'resgate')}
          />

          <AmountPad
            value={amount}
            label={kind === 'aporte' ? 'Quanto você aportou?' : 'Quanto você resgatou?'}
            accentColor={kind === 'aporte' ? colors.income : colors.expense}
          />

          <Button
            label="Registrar"
            variant="primary"
            icon="check"
            fullWidth
            loading={saving}
            disabled={amount.cents <= 0}
            onPress={() => void addMovement()}
          />
        </View>
      </Sheet>
    </DetailScreen>
  );
}

function TypeChip({
  type,
  selected,
  onPress,
}: {
  type: InvestmentType;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, typography, radii, spacing } = useTheme();
  const fallbackIcon = TYPE_ICONS[type.id % TYPE_ICONS.length];

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={type.name}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: radii.pill,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.xs,
          backgroundColor: selected ? `${type.color}26` : colors.surface,
          borderColor: selected ? type.color : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Icon
        name={type.icon || fallbackIcon}
        size={14}
        color={selected ? type.color : colors.textTertiary}
        strokeWidth={2.2}
      />
      <AppText style={[typography.caption, { color: selected ? colors.text : colors.textTertiary }]}>
        {type.name}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  summary: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  disc: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});