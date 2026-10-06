import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';
import { duration } from '@/theme/motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface DonutSlice {
  id: string | number;
  label: string;
  value: number;
  color: string;
}

type DonutChartProps = {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  /** Texto no centro; usually o total. */
  centerLabel?: string;
  centerCaption?: string;
  /** Fatia destacada, desenhada com traço mais grosso. */
  highlightedId?: string | number | null;
};

/**
 * Rosca de categorias.
 *
 * Fatias desenham de -90° para não começarem em 3h, onde o olho lê mal. O
 * `strokeDasharray` de cada arco é calculado sobre a circunferência inteira,
 * com o deslocamento acumulado — é o truque que evita `path` e mantém tudo
 * animável por Props no Reanimated.
 */
export function DonutChart({
  slices,
  size = 220,
  thickness = 26,
  centerLabel,
  centerCaption,
  highlightedId = null,
}: DonutChartProps) {
  const { colors, typography } = useTheme();

  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  const arcs = useMemo(() => {
    // O deslocamento de cada arco é a soma das frações anteriores. Usar `reduce`
    // em vez de um acumulador `offset +=` mantém o memo livre de estado mutável
    // entre renders, que é exatamente o que a regra de imutabilidade exige.
    const visible = slices.filter((slice) => slice.value > 0);

    return visible
      .map((slice, index) => ({
        slice,
        fraction: total > 0 ? slice.value / total : 0,
        offsetFraction: visible
          .slice(0, index)
          .reduce((sum, other) => sum + (total > 0 ? other.value / total : 0), 0),
      }))
      .map(({ slice, fraction, offsetFraction }) => ({
        ...slice,
        fraction,
        // Folga de 2px entre fatias impede que cores adjacentes se misturem.
        dash: Math.max(0, fraction * circumference - 2),
        gap: 2,
        offset: -offsetFraction * circumference,
      }));
  }, [slices, total, circumference]);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Anel de fundo, para a rosca não parecer "buraco" quando há poucas fatias. */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.fill}
          strokeWidth={thickness}
          fill="none"
        />
        <G rotation={-90} originX={size / 2} originY={size / 2}>
          {arcs.map((arc) => (
            <DonutArc
              key={arc.id}
              size={size}
              circumference={circumference}
              radius={radius}
              thickness={highlightedId === arc.id ? thickness + 6 : thickness}
              color={arc.color}
              dash={arc.dash}
              offset={arc.offset}
            />
          ))}
        </G>
      </Svg>

      {centerLabel ? (
        <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
          <Animated.Text numberOfLines={1} style={[typography.amountLg, { color: colors.text }]}>
            {centerLabel}
          </Animated.Text>
          {centerCaption ? (
            <Animated.Text
              numberOfLines={1}
              style={[typography.caption, { color: colors.textTertiary, textAlign: 'center' }]}
            >
              {centerCaption}
            </Animated.Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function DonutArc({
  size,
  circumference,
  radius,
  thickness,
  color,
  dash,
  offset,
}: {
  size: number;
  circumference: number;
  radius: number;
  thickness: number;
  color: string;
  dash: number;
  offset: number;
}) {
  const progress = useDerivedValue(() => withTiming(1, { duration: duration.chart, easing: Easing.out(Easing.cubic) }), []);

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: [dash * progress.value, circumference],
    strokeDashoffset: offset * progress.value,
  }));

  return (
    <AnimatedCircle
      animatedProps={animatedProps}
      // O centro precisa ser o meio do canvas: o `G` pai só rotaciona em torno
      // desse ponto, ele não translada. Com cx/cy em zero a rosca inteira
      // ficaria no canto superior esquerdo, fora da área visível.
      cx={size / 2}
      cy={size / 2}
      r={radius}
      stroke={color}
      strokeWidth={thickness}
      strokeLinecap="butt"
      fill="none"
    />
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
});