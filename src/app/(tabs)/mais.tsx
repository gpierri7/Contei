import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { Amount } from '@/components/ui';
import { HomeHeader } from '@/components/Header';
import { ScreenContainer } from '@/components/Screen';
import { SectionTitle } from '@/components/dashboard';
import { useTheme } from '@/theme';
import { useAsync, useMonthData } from '@/hooks/useAsync';
import { currentMonthKey } from '@/utils/date';

type MenuItem = {
  label: string;
  description: string;
  icon: string;
  route?: string;
  onPress?: () => void;
  accent?: string;
};

export default function MoreScreen() {
  const { colors, spacing, typography, gutter } = useTheme();
  const insets = useSafeAreaInsets();

  const { overview } = useMonthData(currentMonthKey());

  const investments = useAsync(
    (db) => db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(CASE WHEN kind = 'aporte' THEN amount_cents ELSE -amount_cents END), 0) AS total
         FROM investment_movements`
    ),
    [],
    { total: 0 }
  );

  const primary: MenuItem[] = [
    {
      label: 'Contas fixas',
      description: 'Modelos que se repetem todo mês',
      icon: 'calendarClock',
      route: '/gastos/fixos',
    },
    {
      label: 'Parcelas',
      description: 'Compras parceladas em aberto',
      icon: 'creditCard',
      route: '/parcelas',
    },
    {
      label: 'Metas',
      description: 'Dinheiro guardado para algo',
      icon: 'target',
      route: '/metas',
    },
    {
      label: 'Investimentos',
      description: 'Aportes, resgates e patrimônio',
      icon: 'trendingUp',
      route: '/investimentos',
      accent: colors.income,
    },
  ];

  const secondary: MenuItem[] = [
    { label: 'Limites de gastos', description: 'Orçamentos e alertas no celular', icon: 'scale', route: '/limites' },
    { label: 'Categorias', description: 'Organize seus gastos', icon: 'palette', route: '/categorias' },
    { label: 'Fontes de renda', description: 'Salários, freelas, pensões', icon: 'wallet', route: '/ganhos/fontes' },
    { label: 'Backup no Drive', description: 'Exportar e importar dados', icon: 'cloud', route: '/backup' },
    { label: 'Configurações', description: 'Tema, lembretes, segurança', icon: 'settings', route: '/config' },
    { label: 'Sobre o Contei', description: 'Versão e privacidade', icon: 'circleHelp', route: '/sobre' },
  ];

  return (
    <ScreenContainer safeTop={false} safeBottom={false} horizontalGutter={false}>
      <HomeHeader
        greeting="Mais"
        monthLabel="Tudo sobre o app"
        onMonthPress={() => {}}
        hasPrevious={false}
        onPrevious={() => {}}
        onNext={() => {}}
        showNext={false}
      />

      <Animated.ScrollView
        style={[styles.flex, { backgroundColor: colors.background }]}
        contentContainerStyle={{
          backgroundColor: colors.background,
          paddingHorizontal: gutter,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + 170,
          gap: spacing.xxl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.quickGrid, { gap: spacing.md }]}>
          <QuickStat
            label="Patrimônio investido"
            cents={investments.data?.total ?? 0}
            loading={investments.loading}
            accent={colors.income}
          />
          <QuickStat
            label="Saldo do mês"
            cents={overview.balanceCents}
            accent={overview.balanceCents >= 0 ? colors.income : colors.expense}
          />
        </View>

        <View style={{ gap: spacing.md }}>
          <SectionTitle title="Organizar" />
          <View style={{ gap: spacing.sm }}>
            {primary.map((item, index) => (
              <Animated.View key={item.label} entering={FadeInDown.delay(index * 45).duration(200)}>
                <MenuRow item={item} />
              </Animated.View>
            ))}
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          <SectionTitle title="Ajustes" />
          <View style={{ gap: spacing.sm }}>
            {secondary.map((item, index) => (
              <Animated.View
                key={item.label}
                entering={FadeInDown.delay(120 + index * 45).duration(200)}
              >
                <MenuRow item={item} />
              </Animated.View>
            ))}
          </View>
        </View>

        <Animated.Text
          style={[
            typography.caption,
            { color: colors.textTertiary, textAlign: 'center', paddingTop: spacing.lg },
          ]}
        >
          Contei 1.0.0 · seus dados ficam só neste aparelho
        </Animated.Text>
      </Animated.ScrollView>
    </ScreenContainer>
  );
}

function MenuRow({ item }: { item: MenuItem }) {
  const { colors, typography, radii, spacing } = useTheme();
  const accent = item.accent ?? colors.primaryLight;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      onPress={() => item.route && router.push(item.route as never)}
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
      <View style={[styles.iconDisc, { borderRadius: radii.sm, backgroundColor: `${accent}1F` }]}>
        <Icon name={item.icon} size={18} color={accent} strokeWidth={2.1} />
      </View>

      <View style={styles.flex}>
        <Animated.Text style={[typography.bodyStrong, { color: colors.text }]}>{item.label}</Animated.Text>
        <Animated.Text numberOfLines={1} style={[typography.caption, { color: colors.textTertiary }]}>
          {item.description}
        </Animated.Text>
      </View>

      <Icon name="chevronRight" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

function QuickStat({
  label,
  cents,
  accent,
  loading = false,
}: {
  label: string;
  cents: number;
  accent: string;
  loading?: boolean;
}) {
  const { colors, typography, radii, spacing } = useTheme();

  return (
    <View
      style={[
        styles.quickCard,
        {
          borderRadius: radii.lg,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.xs,
        },
      ]}
    >
      <Animated.Text style={[typography.caption, { color: colors.textTertiary }]}>{label}</Animated.Text>
      <Amount cents={cents} variant="lg" color={accent} />
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconDisc: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickGrid: {
    flexDirection: 'row',
  },
  quickCard: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
  },
});