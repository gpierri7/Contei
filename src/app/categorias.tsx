import React, { useState } from 'react';
import { Pressable, StyleSheet,  View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { Button, EmptyState, Input, Skeleton } from '@/components/ui';
import { Sheet } from '@/components/dashboard';
import { DetailScreen, confirmDelete } from '@/components/DetailScreen';
import { ICON_NAMES } from '@/components/ui/iconRegistry';
import { useTheme } from '@/theme';
import { getDatabase, useDatabase } from '@/database/DatabaseProvider';
import { categoriesRepo } from '@/database/repositories/categories';
import { useAsync } from '@/hooks/useAsync';
import { categoryColors } from '@/theme/colors';
import { CATEGORY_KINDS, CATEGORY_KIND_LABELS, type Category, type CategoryKind } from '@/database/types';

/** O array é `as const`, então `indexOf` devolve um tipo literal sem match. */
function nearestColorIndex(color: string): number {
  const exact = (categoryColors as readonly string[]).indexOf(color);
  return exact >= 0 ? exact : 0;
}

const ICONS = ICON_NAMES.filter((icon) => icon !== 'circleHelp');

export default function CategoriesScreen() {
  const { colors, typography, radii, spacing } = useTheme();
  const { invalidate } = useDatabase();

  const categories = useAsync((db) => categoriesRepo.list(db), [], []);
  const { create, from } = useLocalSearchParams<{ create?: string; from?: string }>();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(create === 'expense');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKind>('variable');
  const [colorIndex, setColorIndex] = useState(0);
  const [iconIndex, setIconIndex] = useState(0);

  const grouped = CATEGORY_KINDS.map((k) => ({
    kind: k,
    items: categories.data.filter((c) => c.kind === k),
  }));

  const openCreate = () => {
    setName('');
    setKind('variable');
    setColorIndex(categories.data.length % categoryColors.length);
    setIconIndex(categories.data.length % ICONS.length);
    setSaveError(null);
    setCreating(true);
  };

  const openEdit = (category: Category) => {
    setName(category.name);
    setKind(category.kind);
    setColorIndex(nearestColorIndex(category.color));
    setIconIndex(Math.max(0, ICONS.findIndex((icon) => icon === category.icon)));
    setSaveError(null);
    setEditing(category);
  };

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const db = await getDatabase();
      const color = categoryColors[colorIndex % categoryColors.length];
      const icon = ICONS[iconIndex % ICONS.length];

      if (editing) {
        await categoriesRepo.update(db, editing.id, { name: name.trim(), color, icon, kind });
      } else {
        await categoriesRepo.create(db, { name: name.trim(), color, icon, kind });
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      invalidate();
      setCreating(false);
      setEditing(null);
    } catch (error) {
      console.error('Não foi possível salvar a categoria.', error);
      setSaveError('Não foi possível salvar a categoria. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (category: Category) => {
    confirmDelete(
      `Excluir “${category.name}”?`,
      'Se já houver lançamentos nesta categoria, ela será arquivada em vez de apagada.',
      async () => {
        const db = await getDatabase();
        await categoriesRepo.remove(db, category.id);
        setEditing(null);
        invalidate();
      }
    );
  };

  const formOpen = creating || Boolean(editing);

  return (
    <DetailScreen
      title="Categorias"
      subtitle={`${categories.data.length} ativas`}
      backTo={from === 'gastos' ? '/gastos' : '/mais'}
      footer={
        <Button label="Nova categoria" variant="secondary" icon="plus" fullWidth onPress={openCreate} />
      }
    >
      {categories.loading ? (
        <>
          <Skeleton height={48} />
          <Skeleton height={48} />
        </>
      ) : categories.data.length === 0 ? (
        <EmptyState
          icon="palette"
          title="Nenhuma categoria"
          message="Organize seus gastos por categoria. As mais usadas aparecem primeiro na hora de registrar."
          actionLabel="Criar categoria"
          onAction={openCreate}
        />
      ) : (
        grouped.map(({ kind: groupKind, items }) =>
          items.length === 0 ? null : (
            <View key={groupKind} style={{ gap: spacing.sm }}>
              <AppText style={[typography.label, { color: colors.textTertiary }]}>
                {CATEGORY_KIND_LABELS[groupKind]}
              </AppText>
              <View style={{ gap: spacing.xs }}>
                {items.map((category, index) => (
                  <Animated.View
                    key={category.id}
                    entering={FadeInDown.delay(index * 35).duration(200)}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Editar ${category.name}`}
                      onPress={() => openEdit(category)}
                      style={({ pressed }) => [
                        styles.row,
                        {
                          borderRadius: radii.lg,
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          padding: spacing.md,
                          gap: spacing.md,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.disc,
                          { backgroundColor: `${category.color}1F`, borderRadius: radii.pill },
                        ]}
                      >
                        <Icon name={category.icon} size={18} color={category.color} strokeWidth={2.1} />
                      </View>
                      <AppText style={[typography.body, styles.flex, { color: colors.text }]}>
                        {category.name}
                      </AppText>
                      <Icon name="chevronRight" size={16} color={colors.textTertiary} />
                    </Pressable>
                  </Animated.View>
                ))}
              </View>
            </View>
          )
        )
      )}

      <Sheet
        visible={formOpen}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? 'Editar categoria' : 'Nova categoria'}
        maxHeightRatio={0.9}
      >
        <Animated.View
          entering={FadeInDown.duration(180)}
          style={{ paddingHorizontal: spacing.xl, gap: spacing.lg, paddingBottom: spacing.lg }}
        >
          <Input
            label="Nome"
            icon="fileText"
            placeholder="Ex.: Mercado"
            value={name}
            onChangeText={setName}
            onClear={() => setName('')}
            maxLength={30}
          />

          <View style={{ gap: spacing.sm }}>
            <AppText style={[typography.label, { color: colors.textTertiary }]}>Tipo</AppText>
            <View style={styles.chipRow}>
              {CATEGORY_KINDS.map((option) => (
                <Chip
                  key={option}
                  label={CATEGORY_KIND_LABELS[option]}
                  active={kind === option}
                  onPress={() => setKind(option)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: spacing.sm }}>
            <AppText style={[typography.label, { color: colors.textTertiary }]}>Cor</AppText>
            <View style={styles.chipRow}>
              {categoryColors.map((color, index) => (
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
                          ? `${categoryColors[colorIndex % categoryColors.length]}26`
                          : colors.surface,
                      borderColor:
                        iconIndex === index
                          ? categoryColors[colorIndex % categoryColors.length]
                          : colors.border,
                    },
                  ]}
                >
                  <Icon
                    name={icon}
                    size={18}
                    color={
                      iconIndex === index
                        ? categoryColors[colorIndex % categoryColors.length]
                        : colors.textTertiary
                    }
                    strokeWidth={2.1}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          <Button
            label={editing ? 'Salvar' : 'Criar categoria'}
            variant="primary"
            icon="check"
            fullWidth
            loading={saving}
            disabled={!name.trim()}
            onPress={() => void save()}
          />
          {saveError ? (
            <AppText accessibilityRole="alert" style={[typography.caption, { color: colors.expense }]}>
              {saveError}
            </AppText>
          ) : null}

          {editing ? (
            <Button
              label="Excluir categoria"
              variant="danger"
              icon="trash"
              fullWidth
              onPress={() => remove(editing)}
            />
          ) : null}
        </Animated.View>
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
    width: 36,
    height: 36,
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