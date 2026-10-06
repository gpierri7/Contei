import React, { useMemo } from 'react';
import { StyleSheet,  View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { DetailRow, DetailScreen } from '@/components/DetailScreen';
import { useTheme } from '@/theme';
import { useAsync } from '@/hooks/useAsync';
import { formatDateDayMonth } from '@/utils/date';

type CountRow = { label: string; count: number };

/**
 * Backup.
 *
 * A integração com o Google Drive ainda não existe, e esta tela existe para dizer
 * isso com clareza em vez de esconder o item do menu. O que já dá para fazer é
 * mostrar o tamanho real do banco — é o número que decide se vale a pena
 * configurar o backup antes de acumular dois anos de lançamentos.
 */
export default function BackupScreen() {
  const { colors, typography, radii, spacing } = useTheme();

  // Fixado na montagem: "atualizado agora" não deve mudar a cada re-render da
  // lista de contagens.
  // eslint-disable-next-line react-hooks/purity -- instante capturado uma vez, não relido a cada render.
  const generatedAt = useMemo(() => Date.now(), []);

  const counts = useAsync(
    async (db) => {
      const tables: CountRow[] = [
        { label: 'Ganhos', count: 0 },
        { label: 'Gastos variáveis', count: 0 },
        { label: 'Gastos fixos', count: 0 },
        { label: 'Parcelas', count: 0 },
        { label: 'Metas', count: 0 },
        { label: 'Investimentos', count: 0 },
      ];

      const sources = [
        'incomes',
        'variable_expenses',
        'fixed_expenses',
        'installments',
        'goals',
        'investments',
      ];

      await Promise.all(
        tables.map(async (row, index) => {
          const result = await db.getFirstAsync<{ n: number }>(
            `SELECT COUNT(*) AS n FROM ${sources[index]}`
          );
          row.count = result?.n ?? 0;
        })
      );

      return tables;
    },
    [],
    [] as CountRow[]
  );

  const total = counts.data.reduce((sum, row) => sum + row.count, 0);

  return (
    <DetailScreen title="Backup" subtitle="Google Drive" backTo="/mais">
      <Animated.View
        entering={FadeInDown.duration(200)}
        style={[
          styles.card,
          {
            borderRadius: radii.xl,
            backgroundColor: colors.primaryDim,
            borderColor: colors.primaryBorder,
            padding: spacing.xl,
            gap: spacing.sm,
          },
        ]}
      >
        <Icon name="cloud" size={26} color={colors.primaryLight} strokeWidth={1.9} />
        <AppText style={[typography.h3, { color: colors.text }]}>Ainda não conectado</AppText>
        <AppText style={[typography.caption, { color: colors.textSecondary, lineHeight: 19 }]}>
          O envio automático para o Google Drive está em desenvolvimento. Quando
          chegar, ele usará uma pasta exclusiva do app no seu Drive, sem pedir
          acesso a outros arquivos seus.
        </AppText>
      </Animated.View>

      <View style={{ gap: spacing.md }}>
        <AppText style={[typography.h4, { color: colors.text }]}>O que está guardado aqui</AppText>
        <AppText style={[typography.caption, { color: colors.textTertiary }]}>
          {total} registro{total === 1 ? '' : 's'} no banco local, atualizado em{' '}
          {formatDateDayMonth(generatedAt)}.
        </AppText>

        {counts.data.map((row, index) => (
          <Animated.View key={row.label} entering={FadeInDown.delay(60 + index * 40).duration(200)}>
            <DetailRow
              label={row.label}
              value={String(row.count)}
              icon="database"
            />
          </Animated.View>
        ))}
      </View>

      <View style={{ gap: spacing.sm }}>
        <AppText style={[typography.label, { color: colors.textTertiary }]}>Como está guardado</AppText>
        <AppText style={[typography.caption, { color: colors.textTertiary, lineHeight: 19 }]}>
          Em um arquivo SQLite no armazenamento interno do app. Desinstalar o
          Contei apaga tudo — por isso o backup vai ser importante assim que
          você tiver meses de histórico.
        </AppText>
      </View>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});