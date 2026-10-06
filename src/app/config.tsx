import React from 'react';
import { Pressable, StyleSheet,  View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import Constants from 'expo-constants';


import { Icon } from '@/components/ui/Icon';
import { DetailRow, DetailScreen } from '@/components/DetailScreen';
import { useTheme } from '@/theme';

export default function SettingsScreen() {
  const { colors, typography, spacing } = useTheme();

  return (
    <DetailScreen title="Configurações" backTo="/mais">
      <View style={{ gap: spacing.md }}>
        <AppText style={[typography.h4, { color: colors.text }]}>Aparência</AppText>
        <AppText style={[typography.caption, { color: colors.textTertiary }]}>
          O Contei usa sempre o tema escuro, independentemente do tema do aparelho.
        </AppText>
      </View>

      <View style={{ gap: spacing.md }}>
        <AppText style={[typography.h4, { color: colors.text }]}>Dados</AppText>
        <DetailRow label="Armazenamento" value="SQLite local" icon="database" />
        <DetailRow label="Backup no Drive" value="Em breve" icon="cloud" />
        <AppText style={[typography.caption, { color: colors.textTertiary }]}>
          Tudo fica no aparelho. Nada sai daqui sem você pedir — não há conta,
          servidor ou telemetria.
        </AppText>
      </View>

      <View style={{ gap: spacing.md }}>
        <AppText style={[typography.h4, { color: colors.text }]}>Sobre</AppText>
        <DetailRow label="Versão" value={appVersion()} icon="circleHelp" />
        <DetailRow label="Identificador" value={Constants.expoConfig?.slug ?? 'contei'} icon="palette" />
      </View>
    </DetailScreen>
  );
}

const appVersion = () => {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build = (Constants.expoConfig as { ios?: { buildNumber?: string } } | undefined)?.ios
    ?.buildNumber;
  return build ? `${version} (${build})` : version;
};

export function SettingsRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const { colors, typography, radii, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderRadius: radii.lg,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          padding: spacing.lg,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <AppText style={[typography.body, { color: colors.text }]}>{label}</AppText>
      <View style={styles.flex} />
      <AppText style={[typography.caption, { color: colors.textTertiary }]}>{value}</AppText>
      <Icon name="chevronRight" size={18} color={colors.textTertiary} />
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
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
});