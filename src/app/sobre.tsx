import React from 'react';
import { StyleSheet,  View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import Constants from 'expo-constants';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { DetailScreen } from '@/components/DetailScreen';
import { useTheme } from '@/theme';

const PROMISES = [
  {
    icon: 'shield',
    title: 'Sem conta, sem servidor',
    text: 'O Contei não pede cadastro e não sincroniza nada sozinho. O banco fica no seu aparelho.',
  },
  {
    icon: 'database',
    title: 'Tudo em SQLite',
    text: 'Lançamentos, metas e parcelas moram em um arquivo local. Funciona com o avião ligado.',
  },
  {
    icon: 'palette',
    title: 'Feito para o seu bolso',
    text: 'Dinheiro em centavos e teclado numérico próprio: nada de erro de vírgula em R$ 1.500.',
  },
];

export default function AboutScreen() {
  const { colors, typography, radii, spacing, gutter } = useTheme();

  return (
    <DetailScreen title="Sobre" backTo="/mais">
      <Animated.View entering={FadeInDown.duration(220)} style={{ alignItems: 'center', gap: spacing.sm }}>
        <View
          style={[
            styles.mark,
            { borderRadius: radii.xl, backgroundColor: colors.primaryDim, borderColor: colors.primaryBorder },
          ]}
        >
          <Icon name="wallet" size={36} color={colors.primaryLight} strokeWidth={1.9} />
        </View>
        <AppText style={[typography.h2, { color: colors.text }]}>Contei</AppText>
        <AppText style={[typography.caption, { color: colors.textTertiary }]}>
          Controle financeiro pessoal · versão {Constants.expoConfig?.version ?? '1.0.0'}
        </AppText>
      </Animated.View>

      <View style={{ gap: spacing.md, marginTop: gutter }}>
        {PROMISES.map((item, index) => (
          <Animated.View
            key={item.title}
            entering={FadeInDown.delay(80 + index * 60).duration(220)}
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
            <Icon name={item.icon} size={20} color={colors.primaryLight} strokeWidth={2.1} />
            <AppText style={[typography.bodyStrong, { color: colors.text }]}>{item.title}</AppText>
            <AppText style={[typography.caption, { color: colors.textTertiary, lineHeight: 18 }]}>
              {item.text}
            </AppText>
          </Animated.View>
        ))}
      </View>
    </DetailScreen>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});