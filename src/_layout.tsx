import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useFonts } from 'expo-font';
import { View } from 'react-native';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

import { ThemeProvider } from '@/theme';
import { DatabaseProvider } from '@/database/DatabaseProvider';
import { initializeNotifications, useNotificationObserver } from '@/services/notifications';
import { colors } from '@/theme/colors';

void SystemUI.setBackgroundColorAsync(colors.background).catch((error: unknown) => {
  console.error('Não foi possível definir o fundo nativo do Contei.', error);
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useNotificationObserver();

  React.useEffect(() => {
    void initializeNotifications().catch((error: unknown) => {
      console.error('Não foi possível inicializar as notificações do Contei.', error);
    });
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <DatabaseProvider>
            <StatusBar style="light" />
            <View style={{ flex: 1, backgroundColor: colors.background }}>{children}</View>
          </DatabaseProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
