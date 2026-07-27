// src/lib/pushNotifications.js — requests notification permission and
// registers the device's APNs token with the backend (POST /me/push-token)
// so the daily streak-reminder cron (/cron/send-push-reminders) can reach
// this device. Raw APNs via @react-native-community/push-notification-ios —
// no Firebase/OneSignal middleman, per the chosen setup.
import { Platform } from 'react-native';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { api } from './api';

let initialized = false;

export function initPushNotifications() {
  if (initialized || Platform.OS !== 'ios') return;
  initialized = true;

  PushNotificationIOS.addEventListener('register', (token) => {
    api.post('/me/push-token', { token, platform: 'ios' }).catch(() => {
      // non-fatal — this device just won't get reminders until next launch
    });
  });

  PushNotificationIOS.addEventListener('registrationError', (error) => {
    console.warn('[pushNotifications] registration failed', error?.message || error);
  });

  PushNotificationIOS.requestPermissions({ alert: true, badge: true, sound: true }).catch(() => {});
}
