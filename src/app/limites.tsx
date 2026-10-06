import React, { useEffect, useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { AppText, Button, Input, ProgressBar } from '@/components/ui';
import { DetailScreen } from '@/components/DetailScreen';
import { getDatabase, useDatabase } from '@/database/DatabaseProvider';
import { categoriesRepo } from '@/database/repositories/categories';
import { SETTINGS_KEYS, settingsRepo } from '@/database/repositories/settings';
import type { Category } from '@/database/types';
import { runDatabaseTransaction } from '@/database/transaction';
import { useTheme } from '@/theme';
import { formatCurrency, formatPercent, parseCurrencyToCents } from '@/utils/currency';
import { currentMonthKey, formatMonthLabel } from '@/utils/date';
import { ensureNotificationPermissions } from '@/services/notifications';
import { getMonthlyCategorySpend, normalizeCategoryLimits } from '@/services/spendingLimits';

type BudgetConfig = {
  limitEnabled: boolean;
  monthlyLimitCents: number;
  notificationsEnabled: boolean;
  categoryLimits: Record<string, number>;
  categories: Category[];
  spendByCategory: Record<string, number>;
};

const EMPTY_CONFIG: BudgetConfig = {
  limitEnabled: false,
  monthlyLimitCents: 0,
  notificationsEnabled: true,
  categoryLimits: {},
  categories: [],
  spendByCategory: {},
};

export default function SpendingLimitsScreen() {
  const { colors, spacing, typography, radii } = useTheme();
  const { invalidate } = useDatabase();
  const [config, setConfig] = useState(EMPTY_CONFIG);
  const [monthlyInput, setMonthlyInput] = useState('');
  const [categoryInputs, setCategoryInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const db = await getDatabase();
        const [limitEnabled, monthlyLimit, notificationsEnabled, categoryLimits, categories, spends] =
          await Promise.all([
            settingsRepo.get(db, SETTINGS_KEYS.limitEnabled, false),
            settingsRepo.get(db, SETTINGS_KEYS.monthlyLimitCents, 0),
            settingsRepo.get(db, SETTINGS_KEYS.limitNotificationsEnabled, true),
            settingsRepo.getJson<unknown>(
              db,
              SETTINGS_KEYS.limitCategoryOverrides,
              {}
            ),
            categoriesRepo.list(db),
            getMonthlyCategorySpend(db, currentMonthKey()),
          ]);
        if (cancelled) return;

        const nextConfig: BudgetConfig = {
          limitEnabled: limitEnabled === true,
          monthlyLimitCents: typeof monthlyLimit === 'number' ? monthlyLimit : 0,
          notificationsEnabled: notificationsEnabled !== false,
          categoryLimits: normalizeCategoryLimits(categoryLimits),
          categories,
          spendByCategory: Object.fromEntries(
            spends.map((spend) => [String(spend.category_id), spend.total_cents])
          ),
        };
        setConfig(nextConfig);
        setMonthlyInput(
          nextConfig.monthlyLimitCents > 0
            ? formatCurrency(nextConfig.monthlyLimitCents, { showSymbol: false })
            : ''
        );
        setCategoryInputs(
          Object.fromEntries(
            Object.entries(nextConfig.categoryLimits).map(([id, cents]) => [
              id,
              formatCurrency(cents, { showSymbol: false }),
            ])
          )
        );
      } catch (error) {
        Alert.alert(
          'Não foi possível carregar os limites',
          error instanceof Error ? error.message : undefined
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const monthlyLimitCents = Math.max(0, parseCurrencyToCents(monthlyInput));
      const categoryLimits = Object.fromEntries(
        Object.entries(categoryInputs)
          .map(([id, value]) => [id, parseCurrencyToCents(value)] as const)
          .filter(([, cents]) => cents > 0)
      );
      const hasAnyLimit =
        (config.limitEnabled && monthlyLimitCents > 0) ||
        Object.keys(categoryLimits).length > 0;
      let notificationsEnabled = config.notificationsEnabled;

      if (hasAnyLimit && notificationsEnabled) {
        notificationsEnabled = await ensureNotificationPermissions();
      }

      const db = await getDatabase();
      await runDatabaseTransaction(db, async (transaction) => {
        await settingsRepo.set(transaction, SETTINGS_KEYS.limitEnabled, config.limitEnabled);
        await settingsRepo.set(transaction, SETTINGS_KEYS.monthlyLimitCents, monthlyLimitCents);
        await settingsRepo.set(transaction, SETTINGS_KEYS.notificationsEnabled, notificationsEnabled);
        await settingsRepo.set(transaction, SETTINGS_KEYS.limitNotificationsEnabled, notificationsEnabled);
        await settingsRepo.setJson(
          transaction,
          SETTINGS_KEYS.limitCategoryOverrides,
          categoryLimits
        );
      });

      setConfig((current) => ({
        ...current,
        monthlyLimitCents,
        categoryLimits,
        notificationsEnabled,
      }));
      setCategoryInputs(
        Object.fromEntries(
          Object.entries(categoryLimits).map(([id, cents]) => [
            id,
            formatCurrency(cents, { showSymbol: false }),
          ])
        )
      );
      invalidate();

      if (hasAnyLimit && !notificationsEnabled) {
        Alert.alert(
          'Limites salvos',
          'O sistema não autorizou notificações. Você pode ativá-las nas configurações do aparelho.'
        );
      } else {
        Alert.alert('Limites salvos', 'Os alertas serão enviados quando um novo gasto atingir os percentuais configurados.');
      }
    } catch (error) {
      Alert.alert('Não foi possível salvar', error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const totalSpent = Object.values(config.spendByCategory).reduce((sum, cents) => sum + cents, 0);
  const effectiveMonthlyLimit = config.limitEnabled ? config.monthlyLimitCents : 0;

  return (
    <DetailScreen
      title="Limites de gastos"
      subtitle={formatMonthLabel(currentMonthKey())}
      backTo="/mais"
      footer={
        <Button
          label={saving ? 'Salvando…' : 'Salvar limites'}
          variant="primary"
          icon="check"
          loading={saving || loading}
          onPress={() => void save()}
          fullWidth
        />
      }
    >
      <View style={[styles.card, { borderRadius: radii.lg, backgroundColor: colors.surface, borderColor: colors.border, padding: spacing.lg, gap: spacing.md }]}>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <AppText style={[typography.bodyStrong, { color: colors.text }]}>Limite geral do mês</AppText>
            <AppText style={[typography.caption, { color: colors.textTertiary }]}>
              Soma os gastos de todas as categorias
            </AppText>
          </View>
          <Switch
            value={config.limitEnabled}
            onValueChange={(value) => setConfig((current) => ({ ...current, limitEnabled: value }))}
            trackColor={{ false: colors.surfaceAlt, true: colors.primary }}
            thumbColor={colors.text}
          />
        </View>
        <Input
          label="Valor do limite geral"
          prefix="R$"
          placeholder="0,00"
          value={monthlyInput}
          onChangeText={setMonthlyInput}
          keyboardType="decimal-pad"
          editable={!loading}
          accessibilityLabel="Valor do limite geral mensal em reais"
        />
        {effectiveMonthlyLimit > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <ProgressBar ratio={totalSpent / effectiveMonthlyLimit} />
            <AppText style={[typography.caption, { color: colors.textSecondary }]}>
              {formatCurrency(totalSpent)} de {formatCurrency(effectiveMonthlyLimit)} ·{' '}
              {formatPercent(totalSpent / effectiveMonthlyLimit)}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText style={[typography.h4, { color: colors.text }]}>Limites por categoria</AppText>
        <AppText style={[typography.caption, { color: colors.textTertiary }]}>
          Opcional. Cada valor acompanha os gastos daquela categoria neste mês.
        </AppText>
        {config.categories.map((category) => {
          const spent = config.spendByCategory[String(category.id)] ?? 0;
          const limit = parseCurrencyToCents(categoryInputs[String(category.id)] ?? '');
          return (
            <View
              key={category.id}
              style={[
                styles.card,
                {
                  borderRadius: radii.lg,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  padding: spacing.lg,
                  gap: spacing.sm,
                },
              ]}
            >
              <AppText style={[typography.bodyStrong, { color: colors.text }]}>{category.name}</AppText>
              <Input
                label="Limite mensal"
                prefix="R$"
                placeholder="Sem limite"
                value={categoryInputs[String(category.id)] ?? ''}
                onChangeText={(value) =>
                  setCategoryInputs((current) => ({ ...current, [String(category.id)]: value }))
                }
                keyboardType="decimal-pad"
                editable={!loading}
                accessibilityLabel={`Limite mensal da categoria ${category.name} em reais`}
              />
              {limit > 0 ? (
                <>
                  <ProgressBar ratio={spent / limit} color={category.color} />
                  <AppText style={[typography.caption, { color: colors.textSecondary }]}>
                    {formatCurrency(spent)} de {formatCurrency(limit)} · {formatPercent(spent / limit)}
                  </AppText>
                </>
              ) : null}
            </View>
          );
        })}
        {config.categories.length === 0 ? (
          <AppText style={[typography.caption, { color: colors.textTertiary }]}>
            Cadastre uma categoria para definir um limite específico.
          </AppText>
        ) : null}
      </View>

      <View style={[styles.card, { borderRadius: radii.lg, backgroundColor: colors.surface, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm }]}>
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <AppText style={[typography.bodyStrong, { color: colors.text }]}>Notificações no celular</AppText>
            <AppText style={[typography.caption, { color: colors.textTertiary }]}>
              Avisar aos 90% e ao atingir o limite
            </AppText>
          </View>
          <Switch
            value={config.notificationsEnabled}
            onValueChange={(value) => setConfig((current) => ({ ...current, notificationsEnabled: value }))}
            trackColor={{ false: colors.surfaceAlt, true: colors.primary }}
            thumbColor={colors.text}
          />
        </View>
        <AppText style={[typography.micro, { color: colors.textTertiary }]}>
          Os limites incluem contas fixas e parcelas do mês, além dos gastos registrados.
        </AppText>
      </View>
    </DetailScreen>
  );
}

const styles = {
  card: {
    borderWidth: 1,
  },
  flex: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
};
