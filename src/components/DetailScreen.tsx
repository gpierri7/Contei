import React from 'react';
import { Alert, Pressable, StyleSheet,  View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui';
import { useTheme } from '@/theme';
import { ScreenContainer } from './Screen';

/**
 * Casca das telas de detalhe (gasto, ganho, meta, parcela).
 *
 * Todas têm o mesmo esqueleto — voltar, título, um valor em destaque e ações no
 * rodapé — e diferem só no conteúdo. Factorizar isso evita quatro telas que
 * divergem no botão voltar ou no espaço da barra de status.
 */
export function DetailScreen({
  title,
  subtitle,
  backTo,
  children,
  footer,
  overlay,
}: {
  title: string;
  subtitle?: string;
  /** Rota do botão voltar. Padão: voltar no histórico. */
  backTo?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  overlay?: React.ReactNode;
}) {
  const { colors, typography, radii, spacing, gutter, shadows } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScreenContainer
      safeTop={false}
      safeBottom={false}
      horizontalGutter={false}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.xl + spacing.sm, paddingHorizontal: gutter }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={10}
          onPress={() => (backTo ? router.replace(backTo as never) : router.back())}
          style={({ pressed }) => [
            styles.circleButton,
            {
              backgroundColor: colors.surface,
              borderRadius: radii.pill,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Icon name="chevronLeft" size={20} color={colors.text} />
        </Pressable>

        <View style={styles.center}>
          <AppText numberOfLines={1} style={[typography.h4, { color: colors.text }]}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText numberOfLines={1} style={[typography.caption, { color: colors.textTertiary }]}>
              {subtitle}
            </AppText>
          ) : null}
        </View>

        <View style={styles.circleSpacer} />
      </View>

      <Animated.ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{
          backgroundColor: colors.background,
          paddingHorizontal: gutter,
          paddingTop: spacing.lg,
          paddingBottom: (footer ? insets.bottom + 130 : insets.bottom + spacing.xxl),
          gap: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </Animated.ScrollView>

      {footer ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + spacing.md,
              paddingHorizontal: gutter,
              paddingTop: spacing.md,
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              ...shadows.lg,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
      {overlay}
    </ScreenContainer>
  );
}

/**
 * Linha rótulo/valor das fichas de detalhe.
 *
 * Com `onPress` a linha inteira vira alvo de toque (é o que permite abrir o
 * seletor de data/categoria); sem ele, é só leitura. O chevron só aparece no
 * caso editável para não sugerir interação onde não existe.
 */
export function DetailRow({
  label,
  value,
  icon,
  onPress,
  onDelete,
  tone,
  editable,
}: {
  label: string;
  value: string;
  icon?: string;
  onPress?: () => void;
  onDelete?: () => void;
  tone?: 'default' | 'income' | 'expense';
  /** Força o chevron mesmo sem `onPress` (uso em modo de leitura). */
  editable?: boolean;
}) {
  const { colors, typography, radii, spacing } = useTheme();
  const valueColor =
    tone === 'income' ? colors.income : tone === 'expense' ? colors.expense : colors.text;
  const interactive = !!onPress;

  const body = (
    <>
      {icon ? <Icon name={icon} size={18} color={colors.textTertiary} strokeWidth={2.1} /> : null}

      <AppText style={[typography.body, styles.rowLabel, { color: colors.textSecondary }]}>
        {label}
      </AppText>

      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Excluir ${label.toLowerCase()}`}
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => [styles.deleteButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Icon name="trash" size={18} color={colors.expense} strokeWidth={2.1} />
        </Pressable>
      ) : null}

      <AppText
        style={[
          typography.bodyStrong,
          { color: valueColor, textAlign: 'right', flexShrink: 1 },
        ]}
      >
        {value}
      </AppText>

      {editable && !onDelete ? (
        <Icon name="chevronRight" size={16} color={colors.textTertiary} strokeWidth={2.1} />
      ) : null}
    </>
  );

  const frameStyle = {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderColor: interactive ? colors.primaryBorder : colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  };

  if (!interactive) {
    return <View style={[styles.row, frameStyle]}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. Toque para editar.`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, frameStyle, pressed && styles.rowPressed]}
    >
      {body}
    </Pressable>
  );
}

/** Confirmação destrutiva. O botão de deletar nunca executa direto. */
export function confirmDelete(title: string, message: string, onConfirm: () => void): void {
  Alert.alert(title, message, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: onConfirm },
  ]);
}

export { Button };

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  circleButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  circleSpacer: {
    width: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    flex: 1,
  },
  rowPressed: {
    opacity: 0.65,
  },
  deleteButton: {
    padding: 2,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
  },
});