/**
 * Durações e curvas. As animações do app ficam entre 200 e 300 ms — mais lento
 * que isso pesa a navegação, mais rápido que isso não se lê como transição.
 */
export const duration = {
  instant: 120,
  fast: 200,
  base: 250,
  slow: 300,
  deliberate: 420,
  chart: 700,
} as const;

/** Saída rápida na entrada, suave na saída — padrão de interface. */
export const easing = {
  standard: [0.2, 0, 0, 1],
  decelerate: [0.05, 0.7, 0.1, 1],
  accelerate: [0.3, 0, 0.8, 0.15],
  spring: { damping: 18, stiffness: 220, mass: 0.9 },
  springSoft: { damping: 22, stiffness: 140, mass: 1 },
  springBouncy: { damping: 14, stiffness: 260, mass: 0.7 },
} as const;

/** Escala de pulso para barras e progresso: cresce rápido, assenta suave. */
export const barGrow = {
  duration: duration.chart,
  easing: easing.decelerate,
} as const;
