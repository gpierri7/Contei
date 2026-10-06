import React, { useState } from 'react';
import { Pressable, StyleSheet,  View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { Button, EmptyState, Input, Skeleton } from '@/components/ui';
import { Sheet } from '@/components/dashboard';
import { DetailScreen, confirmDelete } from '@/components/DetailScreen';
import { useTheme } from '@/theme';
import { getDatabase, useDatabase } from '@/database/DatabaseProvider';
import { sourcesRepo } from '@/database/repositories/incomes';
import { useAsync } from '@/hooks/useAsync';
import { useMoneyInput } from '@/hooks/useMoneyInput';
import { incomeSourceColors } from '@/theme/colors';
import { formatCurrency } from '@/utils/currency';
import type { IncomeSource } from '@/database/types';

const ICONS = ['briefcase', 'laptop', 'home', 'wallet', 'gift', 'piggyBank', 'banknote'];

export default function IncomeSourcesScreen() {
  const { colors, typography, radii, spacing } = useTheme();
  const { invalidate } = useDatabase();

  const sources = useAsync((db) => sourcesRepo.list(db), [], []);
  const [editing, setEditing] = useState<IncomeSource | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [recurrence, setRecurrence] = useState<'monthly_day' | 'oneoff'>('monthly_day');
  const [day, setDay] = useState('5');
  const expected = useMoneyInput();
  const [colorIndex, setColorIndex] = useState(0);
  const [iconIndex, setIconIndex] = useState(0);

  const openCreate = () => {
    setName('');
    setRecurrence('monthly_day');
    setDay('5');
    expected.clear();
    setColorIndex(sources.data.length % incomeSourceColors.length);
    setIconIndex(sources.data.length % ICONS.length);
    setCreating(true);
  };

  const openEdit = (source: IncomeSource) => {
    setName(source.name);
    setRecurrence(source.recurrence);
    setDay(String(source.day_of_month ?? 5));
    expected.set(source.expected_cents);
    const exact = (incomeSourceColors as readonly string[]).indexOf(source.color);
    setColorIndex(exact >= 0 ? exact : 0);
    const iconExact = ICONS.indexOf(source.icon);
    setIconIndex(iconExact >= 0 ? iconExact : 0);
    setEditing(source);
  };

  const save = async () => {
    if (!name.trim() || saving) return;
    const parsedDay = clampDay(Number(day));
    setSaving(true);
    try {
      const db = await getDatabase();
      const payload = {
        name: name.trim(),
        color: incomeSourceColors[colorIndex % incomeSourceColors.length],
        icon: ICONS[iconIndex % ICONS.length],
        recurrence,
        day_of_month: recurrence === 'monthly_day' ? parsedDay : null,
        expected_cents: expected.cents,
      };

      if (editing) {
        await sourcesRepo.update(db, editing.id, payload);
      } else {
        await sourcesRepo.create(db, payload);
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      setCreating(false);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const remove = (source: IncomeSource) => {
    confirmDelete(`Excluir “${source.name}”?`, 'Os lançamentos já registradas continuam com o nome antigo.', async () => {
      const db = await getDatabase();
      await sourcesRepo.remove(db, source.id);
      setEditing(null);
      invalidate();
    });
  };

  const formOpen = creating || Boolean(editing);

  return (
    <DetailScreen
      title="Fontes de renda"
      subtitle={`${sources.data.length} cadastrada${sources.data.length === 1 ? '' : 's'}`}
      backTo="/mais"
      footer={
        <Button label="Nova fonte" variant="secondary" icon="plus" fullWidth onPress={openCreate} />
      }
    >
      {sources.loading ? (
        <>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </>
      ) : sources.data.length === 0 ? (
        <EmptyState
          icon="wallet"
          title="Nenhuma fonte de renda"
          message="Fontes organizam o que entra: salário, freela, pensão. O valor esperado ajuda a saber quanto falta para o mês fechar."
          actionLabel="Cadastrar fonte"
          onAction={openCreate}
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {sources.data.map((source, index) => (
            <Animated.View key={source.id} entering={FadeInDown.delay(index * 40).duration(200)}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Editar ${source.name}`}
                onPress={() => openEdit(source)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderRadius: radii.lg,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    padding: spacing.lg,
                    gap: spacing.md,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.disc,
                    { backgroundColor: `${source.color}1F`, borderRadius: radii.pill },
                  ]}
                >
                  <Icon name={source.icon} size={19} color={source.color} strokeWidth={2.1} />
                </View>

                <View style={styles.flex}>
                  <AppText style={[typography.bodyStrong, { color: colors.text }]}>{source.name}</AppText>
                  <AppText style={[typography.caption, { color: colors.textTertiary }]}>
                    {source.recurrence === 'monthly_day'
                      ? `Todo dia ${source.day_of_month}`
                      : 'Renda avulsa'}
                    {source.expected_cents > 0
                      ? ` · esperado ${formatCurrency(source.expected_cents)}`
                      : ''}
                  </AppText>
                </View>

                <Icon name="chevronRight" size={16} color={colors.textTertiary} />
              </Pressable>
            </Animated.View>
          ))}
        </View>
      )}

      <Sheet
        visible={formOpen}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? 'Editar fonte' : 'Nova fonte de renda'}
        maxHeightRatio={0.92}
      >
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg, paddingBottom: spacing.lg }}>
          <Input
            label="Nome"
            icon="fileText"
            placeholder="Ex.: Salário"
            value={name}
            onChangeText={setName}
            onClear={() => setName('')}
            maxLength={30}
          />

          <View style={{ gap: spacing.sm }}>
            <AppText style={[typography.label, { color: colors.textTertiary }]}>Recorrência</AppText>
            <View style={styles.chipRow}>
              <Chip
                label="Todo mês"
                active={recurrence === 'monthly_day'}
                onPress={() => setRecurrence('monthly_day')}
              />
              <Chip
                label="Avulso"
                active={recurrence === 'oneoff'}
                onPress={() => setRecurrence('oneoff')}
              />
            </View>
          </View>

          {recurrence === 'monthly_day' ? (
            <Input
              label="Dia do pagamento"
              icon="calendar"
              placeholder="5"
              value={day}
              onChangeText={(text) => setDay(text.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
            />
          ) : null}

          <Input
            label="Valor esperado (opcional)"
            icon="wallet"
            placeholder="0,00"
            value={expected.text}
            onChangeText={expected.setText}
            onClear={expected.clear}
            keyboardType="decimal-pad"
          />

          <View style={{ gap: spacing.sm }}>
            <AppText style={[typography.label, { color: colors.textTertiary }]}>Cor</AppText>
            <View style={styles.chipRow}>
              {incomeSourceColors.map((color, index) => (
                <Pressable
                  key={color}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: colorIndex === index }}
                  accessibilityLabel={`Cor ${index + 1}`}
                  onPress={() => setColorIndex(index)}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: color,
                      borderColor: colorIndex === index ? colors.text : 'transparent',
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <AppText style={[typography.label, { color: colors.textTertiary }]}>Ícone</AppText>
            <View style={styles.chipRow}>
              {ICONS.map((icon, index) => (
                <Pressable
                  key={icon}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: iconIndex === index }}
                  accessibilityLabel={`Ícone ${index + 1}`}
                  onPress={() => setIconIndex(index)}
                  style={[
                    styles.iconCell,
                    {
                      borderRadius: radii.md,
                      backgroundColor:
                        iconIndex === index
                          ? `${incomeSourceColors[colorIndex % incomeSourceColors.length]}26`
                          : colors.surface,
                      borderColor:
                        iconIndex === index
                          ? incomeSourceColors[colorIndex % incomeSourceColors.length]
                          : colors.border,
                    },
                  ]}
                >
                  <Icon
                    name={icon}
                    size={18}
                    color={
                      iconIndex === index
                        ? incomeSourceColors[colorIndex % incomeSourceColors.length]
                        : colors.textTertiary
                    }
                    strokeWidth={2.1}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          <Button
            label={editing ? 'Salvar' : 'Criar fonte'}
            variant="primary"
            icon="check"
            fullWidth
            loading={saving}
            disabled={!name.trim()}
            onPress={() => void save()}
          />

          {editing ? (
            <Button
              label="Excluir fonte"
              variant="danger"
              icon="trash"
              fullWidth
              onPress={() => remove(editing)}
            />
          ) : null}
        </View>
      </Sheet>
    </DetailScreen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors, typography, radii, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: radii.pill,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: active ? colors.primaryDim : colors.surface,
          borderColor: active ? colors.primaryBorder : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <AppText style={[typography.caption, { color: active ? colors.text : colors.textTertiary }]}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Dia 0, 99 ou vazio cairiam fora do intervalo válido do SQLite. */
function clampDay(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  if (value > 31) return 31;
  return Math.floor(value);
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  disc: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
  },
  iconCell: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});