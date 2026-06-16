import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { api } from '../api/client';

/**
 * Registers the device's raw APNs token with the backend so the push pipeline
 * (services/push_service.py -> apns2) can deliver "new survey response"
 * notifications to this user.
 *
 * Why raw APNs token (getDevicePushTokenAsync) and NOT Expo token
 * (getExpoPushTokenAsync): the backend speaks directly to APNs via apns2 with
 * a hex device token. Expo push tokens are opaque ExponentPushToken[...]
 * strings that only work with Expo's push service.
 *
 * Skips:
 *   - Expo Go (StoreClient): bundle id is host.exp.Exponent, not our
 *     com.psychologydictionary.* id, so APNs registration would fail. Same
 *     pattern we already use for RevenueCat in (app)/_layout.tsx.
 *   - Web: no APNs on web.
 *   - Android: out of scope for this hook (backend is APNs-only). When/if
 *     FCM is added on the backend, branch here on Platform.OS.
 *
 * Idempotent per app session via a module-level flag — the (app) layout's
 * useEffect can re-fire on user object identity changes without re-prompting
 * or re-PUTting. A fresh app launch resets the flag naturally.
 *
 * Never throws. A backend 4xx/5xx, a denied permission, or a network blip
 * must not crash the authed layout.
 */

let registrationAttempted = false;

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

async function registerForPushNotifications(): Promise<void> {
  if (isExpoGo) return;
  if (Platform.OS === 'web') return;
  if (Platform.OS !== 'ios') return;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    status = req.status;
  }
  if (status !== 'granted') return;

  // getDevicePushTokenAsync returns the raw APNs token as a hex string on iOS.
  // The backend stores this in users.apns_token and feeds it straight to apns2.
  const deviceToken = await Notifications.getDevicePushTokenAsync();
  const token = deviceToken?.data;
  if (!token || typeof token !== 'string') return;

  // Backend schema (backend/app/schemas/auth.py -> APNsTokenRequest) expects
  // snake_case `apns_token`. The api client interceptor attaches the Bearer
  // token automatically.
  await api.put('/auth/apns-token', { apns_token: token });
}

export function usePushRegistration(userId: string | null | undefined): void {
  // Local ref guards against the StrictMode-style double-effect in dev as well
  // as rapid user identity flips during auth bootstrap.
  const inFlight = useRef(false);

  useEffect(() => {
    if (!userId) return;
    if (registrationAttempted) return;
    if (inFlight.current) return;

    inFlight.current = true;
    registrationAttempted = true;

    (async () => {
      try {
        await registerForPushNotifications();
      } catch (err) {
        // Swallow: permissions denied, simulator (no APNs), backend 401 mid-
        // refresh, network offline — none should tear down the layout.
        if (__DEV__) {
          console.log('[Push] registration failed (non-fatal):', err);
        }
        // Allow a retry next session; do not reset registrationAttempted here
        // to avoid prompt loops if the failure was permission-related.
      } finally {
        inFlight.current = false;
      }
    })();
  }, [userId]);
}
