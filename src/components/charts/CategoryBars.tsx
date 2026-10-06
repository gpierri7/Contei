import React, { useCallback, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';
import { duration } from '@/theme/motion';
import { formatCurrency } from '@/utils/currency';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// Geometria das barras do gráfico de entradas/saídas.
const BAR_WIDTH = 12;
const BAR_GAP = 4;

/**
 * Barras horizontais, ordenadas da maior para a menor.
 *
 * A ordem é a decisão que importa aqui. Em ordem alfabética as maiores somem
 * no meio da lista e o gráfico deixa de responder "onde está o meu dinheiro".
 */
export function CategoryBars({
  points,
  max,
  barColor,
  emptyLabel = 'Nenhum gasto neste mês',
}: {
  points: BarPoint[];
  max?: number;
  barColor: string;
  emptyLabel?: string;
}) {
  const { colors, typography, spacing } = useTheme();
  const peak = max ?? Math.max(1, ...points.map((p) => p.value));

  if (points.length === 0) {
    return (
      <Animated.Text style={[typography.body, { color: colors.textTertiary }]}>{emptyLabel}</Animated.Text>
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      {points.map((point, index) => (
        <BarRow
          key={`${point.label}-${index}`}
          label={point.label}
          value={point.value}
          ratio={point.value / peak}
          barColor={barColor}
        />
      ))}
    </View>
  );
}

export interface BarPoint {
  label: string;
  value: number;
}

function BarRow({
  label,
  value,
  ratio,
  barColor,
}: {
  label: string;
  value: number;
  ratio: number;
  barColor: string;
}) {
  const { colors, typography, radii } = useTheme();

  // O `react-native-svg` não interpola `width` em porcentagem, então medimos a
  // faixa e animamos em pixels.
  const [trackWidth, setTrackWidth] = useState(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const progress = useDerivedValue(
    () => withTiming(1, { duration: duration.chart, easing: Easing.out(Easing.cubic) }),
    []
  );

  const barProps = useAnimatedProps(() => ({
    width: Math.max(0, ratio * trackWidth * progress.value),
  }));

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.row}>
        <Animated.Text
          numberOfLines={1}
          style={[typography.caption, styles.flex, { color: colors.textSecondary }]}
        >
          {label}
        </Animated.Text>
        <Animated.Text style={[typography.caption, { color: colors.text }]}>
          {formatCurrency(value)}
        </Animated.Text>
      </View>

      <View
        onLayout={onLayout}
        style={[styles.track, { height: 8, borderRadius: radii.pill, backgroundColor: colors.fill }]}
      >
        {trackWidth > 0 ? (
          <Svg width={trackWidth} height={8}>
            <AnimatedRect animatedProps={barProps} x={0} y={0} height={8} rx={4} ry={4} fill={barColor} />
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

export interface SeriesPoint {
  label: string;
  income: number;
  expense: number;
}

/**
 * Entradas × saídas mês a mês.
 *
 * Barras pareadas em vez de linha: o objetivo é comparar dois valores do mesmo
 * mês, e a distância horizontal entre duas barras comunica isso melhor do que
 * duas linhas que se cruzam.
 */
export function IncomeExpenseChart({
  points,
  height = 150,
}: {
  points: SeriesPoint[];
  height?: number;
}) {
  const { colors, typography, spacing } = useTheme();

  const peak = Math.max(1, ...points.flatMap((p) => [p.income, p.expense]));

  if (points.length === 0) {
    return (
      <Animated.Text style={[typography.body, { color: colors.textTertiary }]}>
        Ainda não há histórico para comparar.
      </Animated.Text>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.row}>
        <Legend color={colors.income} label="Entrou" />
        <Legend color={colors.expense} label="Saiu" />
      </View>

      <View style={[styles.chart, { height }]}>
        {points.map((point, index) => (
          <MonthColumn
            key={point.label}
            label={point.label}
            incomeRatio={point.income / peak}
            expenseRatio={point.expense / peak}
            height={height}
          />
        ))}
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const { colors, typography } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Animated.Text style={[typography.caption, { color: colors.textSecondary }]}>{label}</Animated.Text>
    </View>
  );
}

function MonthColumn({
  label,
  incomeRatio,
  expenseRatio,
  height,
}: {
  label: string;
  incomeRatio: number;
  expenseRatio: number;
  height: number;
}) {
  const { colors, typography } = useTheme();

  const progress = useDerivedValue(
    () => withTiming(1, { duration: duration.chart, easing: Easing.out(Easing.cubic) }),
    []
  );

  const incomeProps = useAnimatedProps(() => {
    const barHeight = incomeRatio * progress.value * height;
    return { height: barHeight, y: height - barHeight };
  });
  const expenseProps = useAnimatedProps(() => {
    const barHeight = expenseRatio * progress.value * height;
    return { height: barHeight, y: height - barHeight };
  });

  return (
    <View style={styles.column}>
      {/* `Rect` só existe dentro de um `<Svg>`; fora dele o react-native-svg
          não renderiza nada e as barras ficam invisíveis. */}
      <Svg width={BAR_WIDTH * 2 + BAR_GAP} height={height}>
        <AnimatedRect
          animatedProps={incomeProps}
          x={0}
          y={height}
          width={BAR_WIDTH}
          height={0}
          rx={BAR_WIDTH / 2}
          ry={BAR_WIDTH / 2}
          fill={colors.income}
        />
        <AnimatedRect
          animatedProps={expenseProps}
          x={BAR_WIDTH + BAR_GAP}
          y={height}
          width={BAR_WIDTH}
          height={0}
          rx={BAR_WIDTH / 2}
          ry={BAR_WIDTH / 2}
          fill={colors.expense}
        />
      </Svg>
      <Animated.Text style={[typography.micro, { color: colors.textTertiary }]}>{label}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flex: {
    flex: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: 8,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  track: {
    width: '100%',
    overflow: 'hidden',
  },
});