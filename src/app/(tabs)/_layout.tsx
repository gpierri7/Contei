import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/ui';
import { useTheme } from '@/theme';
import { duration, easing } from '@/theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedView = Animated.createAnimatedComponent(View);

const TABS = [
  { name: 'index', label: 'Início', icon: 'house' },
  { name: 'ganhos', label: 'Ganhos', icon: 'trendingUp' },
  { name: 'gastos', label: 'Gastos', icon: 'receipt' },
  { name: 'relatorios', label: 'Relatórios', icon: 'chartPie' },
  { name: 'mais', label: 'Mais', icon: 'grid' },
] as const;

/**
 * Tipo das props que o `Tabs` entrega ao render-prop `tabBar`.
 *
 * Derivado de `ComponentProps<typeof Tabs>` em vez de importado de
 * `@react-navigation/bottom-tabs`: o expo-router do SDK 57 não expõe esse tipo
 * na raiz, e inferir daqui mantém a barra customizada sincronizada com a
 * versão instalada sem depender de caminho interno do pacote.
 */
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />
      ))}
    </Tabs>
  );
}

function FloatingTabBar({ state, navigation }: TabBarProps) {
  const { colors, radii, spacing, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const routeIndex = (name: string) => state.routes.findIndex((r) => r.name === name);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, spacing.md), gap: spacing.lg },
      ]}
    >
      <Fab />

      <BlurView
        intensity={isDark ? 26 : 55}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.bar,
          { borderRadius: radii.pill, borderColor: colors.navBorder },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: radii.pill, backgroundColor: colors.navBackground },
          ]}
        />

        {TABS.map((tab) => {
          const index = routeIndex(tab.name);
          const focused = state.index === index;

          return (
            <TabItem
              key={tab.name}
              label={tab.label}
              icon={tab.icon}
              focused={focused}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: state.routes[index].key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigation.navigate(state.routes[index].name);
              }}
            />
          );
        })}
      </BlurView>
    </View>
  );
}

function TabItem({
  label,
  icon,
  focused,
  onPress,
}: {
  label: string;
  icon: string;
  focused: boolean;
  onPress: () => void;
}) {
  const { colors, radii } = useTheme();
  const progress = useDerivedValue(
    () => withSpring(focused ? 1 : 0, easing.spring),
    [focused]
  );

  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.86 + progress.value * 0.14 }],
  }));

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withTiming(focused ? 1 : 0.96, { duration: duration.fast }) }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.item, pressStyle]}
    >
      <AnimatedView
        style={[
          styles.itemPill,
          pillStyle,
          { backgroundColor: colors.primaryDim, borderRadius: radii.pill },
        ]}
      />
      <View style={styles.itemIcon}>
        <Icon
          name={icon}
          size={22}
          color={focused ? colors.primaryLight : colors.textTertiary}
          strokeWidth={focused ? 2.3 : 1.9}
        />
      </View>
    </AnimatedPressable>
  );
}

function Fab() {
  const { colors, radii, shadows } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel="Adicionar lançamento"
      onPress={() => router.push('/add')}
      onPressIn={() => {
        // eslint-disable-next-line react-hooks/immutability -- SharedValue do Reanimated e mutavel por design
        scale.value = withTiming(0.9, { duration: duration.instant });
      }}
      onPressOut={() => {
        // eslint-disable-next-line react-hooks/immutability -- SharedValue do Reanimated e mutavel por design
        scale.value = withSpring(1, easing.spring);
      }}
      style={[
        styles.fab,
        animatedStyle,
        {
          borderRadius: radii.pill,
          backgroundColor: colors.primary,
          shadowColor: colors.primary,
          ...shadows.glowStrong,
        },
      ]}
    >
      <AnimatedView style={[styles.fabIcon, { borderRadius: radii.pill }]}>
        <Icon name="plus" size={26} color={colors.textOnPrimary} strokeWidth={2.6} />
      </AnimatedView>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 3,
  },
  itemPill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    marginVertical: 1,
  },
  itemIcon: {
    width: 46,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
});