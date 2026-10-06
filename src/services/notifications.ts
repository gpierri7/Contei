import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import { router } from 'expo-router';

export const SCHEDULED_NOTIFICATIONS_CHANNEL_ID = 'contas';
export const LIMIT_NOTIFICATIONS_CHANNEL_ID = 'limite';

export async function ensureNotificationPermissions(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  const granted =
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;

  if (granted) return true;

  const request = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return (
    request.granted ||
    request.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    request.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED
  );
}

export async function configureNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(SCHEDULED_NOTIFICATIONS_CHANNEL_ID, {
      name: 'Contas a vencer',
      description: 'Lembretes de assinaturas e gastos agendados',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
    await Notifications.setNotificationChannelAsync(LIMIT_NOTIFICATIONS_CHANNEL_ID, {
      name: 'Limites de gastos',
      description: 'Avisos quando os gastos se aproximam dos limites definidos',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
    });
  }
}

export async function initializeNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  await configureNotificationChannel();
}

export function useNotificationObserver() {
  useEffect(() => {
    const redirect = (notification: Notifications.Notification) => {
      const url = notification.request.content.data?.url;
      if (url === '/limites') router.push('/limites');
    };

    const response = Notifications.getLastNotificationResponse();
    if (response?.notification) {
      redirect(response.notification);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      redirect(response.notification);
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
