import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { Amount, Badge, Divider, EmptyState, SkeletonList } from '@/components/ui/Feedback';
import { useTheme } from '@/theme';
import { formatRelativeDay } from '@/utils/date';
import { PAYMENT_METHOD_SHORT, type PaymentMethod } from '@/database/types';
import type { TransactionListItem } from '@/services/overview';

/**
 * Lista de lançamentos agrupada por dia.
 *
 * Cada linha responde a três perguntas sem precisar de detalhe: quanto, o quê
 * e por qual meio. Isso é o mínimo para reconciliar conta bancária no café da
 * manhã sem abrir dez telas.
 */
export function TransactionList({
  items,
  loading = false,
  onPressItem,
  onTogglePaid,
  emptyAction,
  showDayHeaders = true,
}: {
  items: TransactionListItem[];
  loading?: boolean;
  onPressItem?: (item: TransactionListItem) => void;
  onTogglePaid?: (item: TransactionListItem) => void;
  emptyAction?: () => void;
  showDayHeaders?: boolean;
}) {
  const { spacing } = useTheme();

  if (loading) return <SkeletonList count={6} />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon="receipt"
        title="Nada por aqui ainda"
        message="Os lançamentos que você registrar aparecem aqui, agrupados por dia."
        actionLabel="Registrar lançamento"
        onAction={emptyAction}
        compact
      />
    );
  }

  const groups = groupByDay(items);

  return (
    <View style={{ gap: spacing.lg }}>
      {groups.map(([day, rows]) => (
        <View key={day} style={{ gap: spacing.xs }}>
          {showDayHeaders ? <DayHeader day={day} /> : null}
          <View>
            {rows.map((item, index) => (
              <React.Fragment key={itemKey(item)}>
                {index > 0 ? <Divider /> : null}
                <TransactionRow item={item} onPress={onPressItem} onTogglePaid={onTogglePaid} />
              </React.Fragment>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function DayHeader({ day }: { day: string }) {
  const { colors, typography, spacing } = useTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xs,
        paddingBottom: spacing.xs,
      }}
    >
      <Animated.Text style={[typography.label, { color: colors.textSecondary }]}>
        {formatRelativeDay(dayKeyToTimestamp(day))}
      </Animated.Text>
    </Animated.View>
  );
}

/** "AAAA-MM-DD" local -> epoch ms, sem passar por UTC. */
function dayKeyToTimestamp(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

const TransactionRow = memo(function TransactionRow({
  item,
  onPress,
  onTogglePaid,
}: {
  item: TransactionListItem;
  onPress?: (item: TransactionListItem) => void;
  onTogglePaid?: (item: TransactionListItem) => void;
}) {
  const { colors, typography, radii, spacing } = useTheme();

  const unpaid = item.kind === 'expense' && !item.isPaid;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.categoryName}`}
      onPress={() => onPress?.(item)}
      style={({ pressed }) => [
        styles.row,
        {
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.xs,
          gap: spacing.md,
          opacity: pressed ? 0.7 : unpaid ? 0.72 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.iconDisc,
          { borderRadius: radii.iconMd, backgroundColor: `${item.categoryColor}1F` },
        ]}
      >
        <Icon name={item.categoryIcon} size={19} color={item.categoryColor} strokeWidth={2.1} />
        {unpaid ? (
          <View
            style={[
              styles.unpaidDot,
              { borderColor: colors.surface, backgroundColor: colors.warningStrong },
            ]}
          />
        ) : null}
      </View>

      <View style={styles.flex}>
        <Animated.Text numberOfLines={1} style={[typography.bodyStrong, { color: colors.text }]}>
          {item.title}
        </Animated.Text>
        <View style={styles.metaRow}>
          <Animated.Text numberOfLines={1} style={[typography.caption, { color: item.categoryColor }]}>
            {item.categoryName}
          </Animated.Text>
          <View style={[styles.dot, { backgroundColor: colors.textTertiary }]} />
          <MethodPill method={item.method} />
          {item.origin !== 'variable' ? (
            <>
              <View style={[styles.dot, { backgroundColor: colors.textTertiary }]} />
              <Animated.Text style={[typography.caption, { color: colors.textTertiary }]}>
                {ORIGIN_LABELS[item.origin]}
              </Animated.Text>
            </>
          ) : null}
        </View>
      </View>

      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <Amount cents={item.amountCents} sign={item.kind === 'income' ? 'always' : 'none'} variant="md" />
        {unpaid ? (
          <Badge label={item.method === 'credito' ? 'Fatura pendente' : 'Pendente'} tone="warning" />
        ) : null}
      </View>
      {item.kind === 'expense' && onTogglePaid ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ checked: item.isPaid }}
          accessibilityLabel={item.isPaid ? `Marcar ${item.title} como pendente` : `Confirmar pagamento de ${item.title}`}
          onPress={(event) => {
            event.stopPropagation();
            onTogglePaid(item);
          }}
          hitSlop={8}
          style={({ pressed }) => [
            styles.paymentAction,
            {
              backgroundColor: item.isPaid ? colors.incomeDim : colors.warningDim,
              opacity: pressed ? 0.65 : 1,
            },
          ]}
        >
          <Icon
            name={item.isPaid ? 'check' : 'check'}
            size={15}
            color={item.isPaid ? colors.income : colors.warningStrong}
            strokeWidth={2.5}
          />
        </Pressable>
      ) : null}
    </Pressable>
  );
});

function MethodPill({ method }: { method: PaymentMethod | null }) {
  const { colors, typography } = useTheme();
  if (!method) return null;

  return (
    <View style={styles.rowInline}>
      <Icon
        name={METHOD_ICONS[method]}
        size={12}
        color={colors.textTertiary}
        strokeWidth={2.2}
      />
      <Animated.Text style={[typography.caption, { color: colors.textTertiary }]}>
        {PAYMENT_METHOD_SHORT[method]}
      </Animated.Text>
    </View>
  );
}

export const METHOD_ICONS: Record<PaymentMethod, string> = {
  pix: 'zap',
  debito: 'banknote',
  credito: 'creditCard',
  dinheiro: 'wallet',
};

const ORIGIN_LABELS: Record<TransactionListItem['origin'], string> = {
  variable: 'Avulso',
  fixed: 'Fixo',
  installment: 'Parcela',
};

function itemKey(item: TransactionListItem) {
  return `${item.kind}-${item.origin}-${item.id}`;
}

/** Agrupa preservando a ordem de entrada (a query já vem em ordem de data). */
function groupByDay(items: TransactionListItem[]): [string, TransactionListItem[]][] {
  const groups: [string, TransactionListItem[]][] = [];
  for (const item of items) {
    const day = dayKey(item.date);
    const last = groups[groups.length - 1];
    if (last && last[0] === day) last[1].push(item);
    else groups.push([day, [item]]);
  }
  return groups;
}

function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Soma dos itens, para o rodapé da lista. */
export function listTotal(items: TransactionListItem[]): number {
  return items.reduce((sum, item) => sum + (item.kind === 'income' ? item.amountCents : -item.amountCents), 0);
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  iconDisc: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unpaidDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 11,
    height: 11,
    borderRadius: 999,
    borderWidth: 2.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  paymentAction: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 999,
  },
});