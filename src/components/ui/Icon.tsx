import React, { useMemo } from 'react';
import { CircleHelp } from 'lucide-react-native';
import type { ColorValue } from 'react-native';

import { ICONS, type IconName, type LucideProps } from './iconRegistry';
import { useTheme } from '@/theme';

type IconProps = Omit<LucideProps, 'name'> & {
  name: string;
  size?: number;
  color?: ColorValue;
};

const registry = ICONS as Record<string, (typeof ICONS)[IconName] | undefined>;
const legacyAliases: Record<string, IconName> = {
  home: 'house',
  droplet: 'zap',
  phone: 'smartphone',
  coffee: 'cupSoda',
  beer: 'wine',
  heart: 'heartPulse',
  book: 'bookOpen',
  gamepad2: 'ticket',
  music: 'notebookPen',
  film: 'ticket',
  tv: 'smartphone',
  dollarSign: 'circleDollarSign',
  trees: 'sprout',
  fileText: 'notebookPen',
  layers: 'grid',
  hammer: 'wrench',
  lightbulb: 'zap',
  camera: 'sparkles',
  headphones: 'notebookPen',
  watch: 'clock',
  globe: 'grid',
  mapPin: 'grid',
  anchor: 'building',
  award: 'trophy',
  star: 'sparkles',
  bookmark: 'notebookPen',
  calendar: 'calendarDays',
  moreHorizontal: 'grid',
  circle: 'circleCheck',
  flame: 'zap',
  flower: 'sprout',
  leaf: 'sprout',
  mountain: 'plane',
};

/**
 * Aceita as grafias que o app já gravou no banco e devolve a chave canônica.
 *
 * `categories.icon` e `income_sources.icon` guardam texto, e esse texto veio de
 * três épocas diferentes do app: nomes em kebab-case do seed original
 * (`credit-card`), camelCase do registro (`creditCard`) e, se o usuário
 * escrever à mão, qualquer coisa. Normalizar na renderização evita uma migração
 * de banco por um detalhe cosmético — e o nome novo continua valendo.
 */
function normalize(name: string): keyof typeof ICONS | undefined {
  if (name in registry) return name as IconName;
  if (name in legacyAliases) return legacyAliases[name];

  const camel = name
    .trim()
    .replace(/[\s_-]+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/^./, (char) => char.toLowerCase());

  if (camel in registry) return camel as IconName;

  // Última tentativa: compara ignorando separadores e caixa
  // ("credit card" e "CreditCard" caem no mesmo ícone).
  const flat = name.toLowerCase().replace(/[\s_-]/g, '');
  return Object.keys(registry).find((key) => key.toLowerCase() === flat) as IconName | undefined;
}

/**
 * Ícone de linha com conjunto único (Lucide).
 *
 * Nome desconhecido cai no ícone de ajuda em vez de quebrar a tela: um dado
 * antigo não pode derrubar a lista inteira.
 */
export function Icon({ name, size = 20, color, strokeWidth = 2, ...rest }: IconProps) {
  const { colors } = useTheme();
  const Component = useMemo(() => registry[normalize(name) as IconName] ?? CircleHelp, [name]);

  return (
    <Component
      size={size}
      color={color ?? colors.textSecondary}
      strokeWidth={strokeWidth}
      {...rest}
    />
  );
}

/** Igual ao `Icon`, mas garante a cor branca — para dentro de botões com fundo. */
export function IconOnAccent({ name, size = 20, strokeWidth = 2.2, ...rest }: IconProps) {
  const { colors } = useTheme();
  return <Icon name={name} size={size} color={colors.textOnPrimary} strokeWidth={strokeWidth} {...rest} />;
}

export type { IconName };
export { ICONS, ICON_NAMES } from './iconRegistry';