import React from 'react';
import { type TextProps } from 'react-native';
import { Text as NativeText } from 'react-native';

import { useTheme } from '@/theme';

export const AppText = React.forwardRef<NativeText, TextProps>(function AppText(
  { style, ...props },
  ref
) {
  const { colors } = useTheme();

  return <NativeText ref={ref} {...props} style={[{ color: colors.text }, style]} />;
});
