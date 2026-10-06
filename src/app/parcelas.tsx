import React from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { Amount, Button, EmptyState, ProgressBar, Skeleton } from '@/components/ui';
import { DetailScreen } from '@/components/DetailScreen';
import { useTheme } from '@/theme';
import { getDatabase, useDatabase } from '@/database/DatabaseProvider';
import { installmentsRepo, type InstallmentGroup } from '@/database/repositories/installments';
import { useAsync } from '@/hooks/useAsync';
import { formatCurrency } from '@/utils/currency';
import { formatDateDayMonth } from '@/utils/date';
import { usePaymentUndo } from '@/hooks/usePaymentUndo';
import { PaymentUndoToast } from '@/components/PaymentUndoToast';

/**
 * Grupos de parcelas.
 *
 * O que importa aqui não é a parcela, é o **grupo**: "notebook, 10x de 890".
 * Mostrar 10 linhas quase iguais esconde o total que ainda está comprometido e
 * faz a pessoa contar na cabeça. Por isso a lista é por compra.
 */
export default function InstallmentsScreen() {
  const { colors, typography, radii, spacing } = useTheme();
  const { invalidate } = useDatabase();
  const paymentUndo = usePaymentUndo();

  const groups = useAsync((db) => installmentsRepo.listGroups(db, { onlyOpen: true }), [], []);

  const totalRemaining = groups.data.reduce((sum, g) => sum + g.remaining_cents, 0);
  const totalPaid = groups.data.reduce((sum, g) => sum + g.paid_cents, 0);

  const togglePaid = async (group: InstallmentGroup) => {
    try {
      const db = await getDatabase();
      const installments = await installmentsRepo.listByGroup(db, group.group_id);
      if (installments.length === 0) return;

      const settle = group.pending_count > 0;
      const targets = settle
        ? installments.filter((p) => !p.is_paid)
        : installments.filter((p) => p.is_paid);

      for (const installment of targets) {
        await installmentsRepo.setPaid(db, installment.id, settle);
      }

      await Haptics.notificationAsync(
        settle ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
      );
      invalidate();
      paymentUndo.offerUndo(
        settle ? 'Parcelas marcadas como pagas' : 'Parcelas marcadas como pendentes',
        async () => {
          for (const installment of targets) {
            await installmentsRepo.setPaid(db, installment.id, !settle);
          }
          invalidate();
        }
      );
    } catch (error) {
      Alert.alert('Não foi possível atualizar as parcelas', error instanceof Error ? error.message : undefined);
    }
  };

  return (
    <DetailScreen
      title="Parcelas"
      subtitle={`${groups.data.length} em aberto`}
      backTo="/gastos"
      overlay={
        <PaymentUndoToast
          message={paymentUndo.message}
          onUndo={() => void paymentUndo.undo()}
          bottomOffset={80}
        />
      }
      footer={
        <Button
          label="Nova compra parcelada"
          variant="secondary"
          icon="plus"
          fullWidth
          onPress={() => router.push('/add?kind=expense')}
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
          },
        ]}
      >
        <View style={styles.flex}>
          <AppText style={[typography.caption, { color: colors.textTertiary }]}>Já pago</AppText>
          <Amount cents={totalPaid} variant="lg" tone="income" />
        </View>
        <View style={[styles.flex, { alignItems: 'flex-end' }]}>
          <AppText style={[typography.caption, { color: colors.textTertiary }]}>Falta</AppText>
          <Amount cents={totalRemaining} variant="lg" tone="expense" />
        </View>
      </Animated.View>

      {groups.loading ? (
        <>
          <Skeleton height={120} />
          <Skeleton height={120} />
        </>
      ) : groups.data.length === 0 ? (
        <EmptyState
          icon="creditCard"
          title="Nenhuma parcela em aberto"
          message="Compras parceladas aparecem aqui agrupadas, com o quanto ainda está comprometido."
          actionLabel="Registrar compra parcelada"
          onAction={() => router.push('/add?kind=expense')}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {groups.data.map((group, index) => (
            <Animated.View key={group.group_id} entering={FadeInDown.delay(index * 50).duration(220)}>
              <GroupCard
                group={group}
                onToggle={() => void togglePaid(group)}
                onOpen={() => router.push(`/parcelas/${group.group_id}` as never)}
              />
            </Animated.View>
          ))}
        </View>
      )}
    </DetailScreen>
  );
}

function GroupCard({
  group,
  onToggle,
  onOpen,
}: {
  group: InstallmentGroup;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { colors, typography, radii, spacing } = useTheme();
  const progress = group.total_cents > 0 ? group.paid_cents / group.total_cents : 0;
  const settled = group.pending_count === 0;

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: radii.lg,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.md,
        },
      ]}
    >
      <View style={[styles.row, { gap: spacing.md }]}>
        <View
          style={[
            styles.disc,
            { backgroundColor: `${group.category_color}1F`, borderRadius: radii.pill },
          ]}
        >
          <Icon name="creditCard" size={18} color={group.category_color} strokeWidth={2.1} />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Editar ${group.description || group.category_name}`}
          onPress={onOpen}
          style={styles.flex}
        >
          <AppText numberOfLines={1} style={[typography.bodyStrong, { color: colors.text }]}>
            {group.description || group.category_name}
          </AppText>
          <AppText style={[typography.caption, { color: colors.textTertiary }]}>
            {group.total_count}x de {formatCurrency(group.amount_cents)} ·{' '}
            {group.category_name}
          </AppText>
        </Pressable>

        <Amount cents={group.total_cents} variant="md" tone={settled ? 'muted' : 'default'} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Detalhes de ${group.description || group.category_name}`}
          onPress={onOpen}
          hitSlop={8}
          style={({ pressed }) => [styles.action, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Icon name="edit" size={16} color={colors.textSecondary} strokeWidth={2.2} />
        </Pressable>
      </View>

      <ProgressBar
        ratio={progress}
        color={settled ? colors.income : group.category_color}
        height={8}
      />

      <View style={styles.row}>
        <AppText style={[typography.caption, { color: colors.textTertiary }]}>
          {group.paid_count} de {group.total_count} pagas
        </AppText>
        <View style={styles.flex} />
        {group.next_due_date ? (
          <AppText style={[typography.caption, { color: colors.textSecondary }]}>
            próxima {formatDateDayMonth(group.next_due_date)}
          </AppText>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={settled ? 'Reabrir parcelas' : 'Quitar parcelas'}
          onPress={onToggle}
          hitSlop={8}
          style={({ pressed }) => [styles.action, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Icon
            name={settled ? 'rotateCcw' : 'check'}
            size={16}
            color={settled ? colors.textTertiary : colors.income}
            strokeWidth={2.4}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summary: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  disc: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: {
    marginLeft: 12,
  },
});