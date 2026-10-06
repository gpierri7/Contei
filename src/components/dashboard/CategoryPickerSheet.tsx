import React from 'react';
import { Pressable, ScrollView, StyleSheet,  View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import * as Haptics from 'expo-haptics';

import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Inputs';
import { Sheet } from './Sheet';
import { useTheme } from '@/theme';
import { categoryColors } from '@/theme/colors';
import type { Category } from '@/database/types';

export function CategoryPickerSheet({
  visible,
  categories,
  value,
  onClose,
  onSelect,
  onCreate,
  onRequestCreate,
  allowCustomColor,
}: {
  visible: boolean;
  categories: Category[];
  value: number | null;
  onClose: () => void;
  onSelect: (category: Category) => void;
  onCreate?: (name: string, color: string, icon: string) => void;
  onRequestCreate?: () => void;
  allowCustomColor?: boolean;
}) {
  const { spacing, colors } = useTheme();
  const [search, setSearch] = React.useState('');

  const [lastVisible, setLastVisible] = React.useState(visible);
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (!visible) setSearch('');
  }

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(term));
  }, [categories, search]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Escolher categoria">
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
        {categories.length > 8 ? (
          <Input
            placeholder="Buscar categoria"
            icon="search"
            value={search}
            onChangeText={setSearch}
            onClear={() => setSearch('')}
          />
        ) : null}

        <ScrollView
          style={[styles.list, { backgroundColor: colors.surface }]}
          contentContainerStyle={{ paddingBottom: spacing.lg, backgroundColor: colors.surface }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.grid}>
            {filtered.map((category) => (
              <CategoryCell
                key={category.id}
                category={category}
                selected={category.id === value}
                onPress={() => {
                  void Haptics.selectionAsync();
                  onSelect(category);
                }}
              />
            ))}
          </View>

          {filtered.length === 0 && onCreate ? (
            <CreateRow
              name={search.trim()}
              onCreate={() => {
                void Haptics.selectionAsync();
                const color = categoryColors[categories.length % categoryColors.length];
                onCreate(search.trim(), color, 'circleHelp');
                setSearch('');
              }}
            />
          ) : null}

          {(onRequestCreate || onCreate) && !search.trim() ? (
            <CreateRow
              name="Nova categoria"
              onCreate={() => {
                void Haptics.selectionAsync();
                if (onRequestCreate) {
                  onRequestCreate();
                } else if (onCreate) {
                  const color = categoryColors[categories.length % categoryColors.length];
                  onCreate('Nova categoria', color, 'grid');
                  setSearch('');
                }
              }}
            />
          ) : null}
        </ScrollView>
      </View>
    </Sheet>
  );
}

function CategoryCell({
  category,
  selected,
  onPress,
}: {
  category: Category;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, typography, radii } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={category.name}
      onPress={onPress}
      style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.75 : 1 }]}
    >
      <View
        style={[
          styles.disc,
          {
            borderRadius: radii.pill,
            backgroundColor: selected ? category.color : `${category.color}1F`,
            borderColor: selected ? 'transparent' : `${category.color}44`,
          },
        ]}
      >
        <Icon
          name={category.icon}
          size={20}
          color={selected ? colors.textOnPrimary : category.color}
          strokeWidth={2.1}
        />
      </View>
      <AppText
        numberOfLines={2}
        style={[
          typography.micro,
          { color: selected ? colors.text : colors.textTertiary, textAlign: 'center' },
        ]}
      >
        {category.name}
      </AppText>
    </Pressable>
  );
}

function CreateRow({ name, onCreate }: { name: string; onCreate: () => void }) {
  const { colors, typography, radii, spacing } = useTheme();
  const trimmed = name.trim();
  if (!trimmed) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Criar categoria ${trimmed}`}
      onPress={onCreate}
      style={({ pressed }) => [
        styles.createRow,
        {
          borderRadius: radii.md,
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
          gap: spacing.md,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Icon name="plus" size={18} color={colors.primaryLight} strokeWidth={2.4} />
      <AppText style={[typography.body, { color: colors.text }]}>Criar “{trimmed}”</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    maxHeight: 380,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '25%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  disc: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
