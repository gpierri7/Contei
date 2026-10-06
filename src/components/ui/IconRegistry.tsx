import { categoryColors } from '@/theme/colors';

export const CATEGORY_ICONS = [
  'home',
  'bed',
  'building',
  'wifi',
  'zap',
  'droplet',
  'phone',
  'shopping-bag',
  'shopping-cart',
  'utensils',
  'coffee',
  'beer',
  'fuel',
  'car',
  'bus',
  'plane',
  'heart',
  'heart-pulse',
  'activity',
  'pill',
  'graduation-cap',
  'book',
  'gamepad-2',
  'music',
  'film',
  'tv',
  'shirt',
  'scissors',
  'sparkles',
  'gift',
  'dollar-sign',
  'credit-card',
  'piggy-bank',
  'banknote',
  'trending-up',
  'briefcase',
  'users',
  'baby',
  'dog',
  'cat',
  'tree-pine',
  'file-text',
  'receipt',
  'wallet',
  'percent',
  'layers',
  'package',
  'box',
  'hammer',
  'lightbulb',
  'camera',
  'smartphone',
  'headphones',
  'watch',
  'globe',
  'map-pin',
  'anchor',
  'target',
  'award',
  'star',
  'bookmark',
  'calendar',
  'clock',
  'more-horizontal',
  'grid',
  'circle',
] as const;

export type CategoryIconName = (typeof CATEGORY_ICONS)[number];

export interface IconPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (icon: string, color: string) => void;
  initialIcon?: string;
  initialColor?: string;
}

export const DEFAULT_CATEGORY_COLOR = categoryColors[0];
export const DEFAULT_CATEGORY_ICON = 'grid';
