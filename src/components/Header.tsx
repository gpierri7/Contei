import React from 'react';
import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/theme';

const SHRINK_START = 12;
const SHRINK_END = 72;

/**
 * Cabeçalho de telas de conteúdo.
 *
 * Encolhe conforme a tela rola: título grande → título pequeno. O movimento é
 * o que cria hierarquia sem gastar uma barra de navegação inteira, o que
 * importa em telas financeiras onde o número precisa ficar no topo.
 *
 * Passe o mesmo `scrollY` que a tela cria para que ambos leiam o mesmo valor.
 */
export function Header({
  title,
  subtitle,
  scrollY,
  back = false,
  right,
  left,
  style,
}: {
  title: string;
  subtitle?: string;
  scrollY?: SharedValue<number>;
  back?: boolean;
  right?: React.ReactNode;
  left?: React.ReactNode;
  style?: ViewProps['style'];
}) {
  const { colors, spacing, typography, radii, gutter } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const titleStyle = useAnimatedStyle(() => {
    if (!scrollY) return {};
    const p = interpolate(scrollY.value, [SHRINK_START, SHRINK_END], [0, 1], Extrapolation.CLAMP);
    return {
      transform: [{ translateY: interpolate(p, [0, 1], [0, -8], Extrapolation.CLAMP) }],
    };
  });

  const titleType = useAnimatedStyle(() => {
    if (!scrollY) return {};
    const p = interpolate(scrollY.value, [SHRINK_START, SHRINK_END], [0, 1], Extrapolation.CLAMP);
    return { opacity: interpolate(p, [0, 1], [1, 0.001], Extrapolation.CLAMP) };
  });

  const scrubStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 0 };
    const p = interpolate(scrollY.value, [SHRINK_START, SHRINK_END], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: p,
      transform: [{ translateY: interpolate(p, [0, 1], [10, 0], Extrapolation.CLAMP) }],
    };
  });

  const onBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.md, gap: spacing.md },
        style,
      ]}
    >
      <View style={[styles.row, { paddingHorizontal: gutter }]}>
        <View style={styles.side}>
          {back ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              hitSlop={12}
              onPress={onBack}
              style={[styles.circle, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
            >
              <Icon name="chevronLeft" size={20} color={colors.text} />
            </Pressable>
          ) : (
            left
          )}
        </View>

        <Animated.Text
          numberOfLines={1}
          style={[styles.titleWrap, titleStyle, titleType]}
          pointerEvents="none"
        >
          <Animated.Text
            numberOfLines={1}
            style={[typography.h1, { color: colors.text, textAlign: 'center' }]}
          >
            {title}
          </Animated.Text>
        </Animated.Text>

        <View style={[styles.side, styles.sideRight]}>{right}</View>
      </View>

      {subtitle ? (
        <Animated.Text
          numberOfLines={2}
          style={[
            typography.body,
            { color: colors.textSecondary, paddingHorizontal: gutter },
          ]}
        >
          {subtitle}
        </Animated.Text>
      ) : null}

      {scrollY ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.scrubRow,
            { paddingHorizontal: gutter },
            scrubStyle,
          ]}
        >
          <View
            style={[
              styles.scrubPill,
              {
                borderRadius: radii.pill,
                backgroundColor: colors.surfaceAlt,
                borderColor: colors.border,
              },
            ]}
          >
            <Animated.Text style={[typography.bodyStrong, { color: colors.text }]}>{title}</Animated.Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Cabeçalho da tela inicial: saudação, seletor de mês e avatar.
 */
export function HomeHeader({
  greeting,
  monthLabel,
  onMonthPress,
  hasPrevious,
  onPrevious,
  onNext,
  showNext,
  onAvatarPress,
  actionLabel = 'Abrir configurações',
  actionIcon = 'user',
}: {
  greeting: string;
  monthLabel: string;
  onMonthPress: () => void;
  hasPrevious: boolean;
  onPrevious: () => void;
  onNext: () => void;
  showNext: boolean;
  onAvatarPress?: () => void;
  actionLabel?: string;
  actionIcon?: string;
}) {
  const { colors, spacing, typography, radii, gutter } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.column, { paddingTop: insets.top + spacing.xl + spacing.sm, gap: spacing.lg }]}>
      <View style={[styles.row, { paddingHorizontal: gutter }]}>
        <View style={styles.flex}>
          <Animated.Text numberOfLines={1} style={[typography.h1, { color: colors.text }]}>
            {greeting}
          </Animated.Text>
          <Animated.Text numberOfLines={1} style={[typography.caption, { color: colors.textTertiary }]}>
            Vamos ver onde seu dinheiro está.
          </Animated.Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAvatarPress}
          style={[styles.avatar, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
        >
          <Icon name={actionIcon} size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={[styles.row, styles.monthRow, { paddingHorizontal: gutter }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
          disabled={!hasPrevious}
          hitSlop={8}
          onPress={onPrevious}
          style={[styles.circle, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
        >
          <Icon name="chevronLeft" size={18} color={hasPrevious ? colors.text : colors.textTertiary} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Escolher mês"
          onPress={onMonthPress}
          style={[
            styles.monthPill,
            { borderRadius: radii.pill, backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
        >
          <Icon name="calendar" size={15} color={colors.primaryLight} />
          <Animated.Text style={[typography.label, { color: colors.text }]}>{monthLabel}</Animated.Text>
          <Icon name="chevronDown" size={14} color={colors.textTertiary} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Próximo mês"
          disabled={!showNext}
          hitSlop={8}
          onPress={onNext}
          style={[styles.circle, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
        >
          <Icon name="chevronRight" size={18} color={showNext ? colors.text : colors.textTertiary} />
        </Pressable>
      </View>
    </View>
  );
}

/** Cartão com degradê da marca, para saldo, metas e destaques. */
export function GradientCard({
  children,
  style,
  palette,
}: {
  children: React.ReactNode;
  style?: ViewProps['style'];
  palette?: readonly [string, string];
}) {
  const { radii, gradients, sheen } = useTheme();
  const radius = radii.xl;

  return (
    <View style={[styles.gradientCard, { borderRadius: radius }, style]}>
      <LinearGradient
        colors={palette ?? gradients.primary.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
      />
      {/* Brilho diagonal: impede que o cartão pareça chapado em telas OLED. */}
      <LinearGradient
        colors={sheen.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  column: {
    flexDirection: 'column',
  },
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthRow: {
    justifyContent: 'space-between',
  },
  side: {
    width: 44,
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  titleWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  scrubRow: {
    justifyContent: 'center',
  },
  scrubPill: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  gradientCard: {
    overflow: 'hidden',
  },
});