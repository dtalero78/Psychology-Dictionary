import { useEffect } from 'react';
import { Stack, Redirect } from 'expo-router';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import Purchases from 'react-native-purchases';
import { useAuth } from '../../src/context/AuthContext';
import { usePushRegistration } from '../../src/hooks/usePushRegistration';

const RC_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export default function AppLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    if (user?.id && RC_API_KEY && !isExpoGo) {
      Purchases.configure({ apiKey: RC_API_KEY, appUserID: user.id });
    }
  }, [user?.id]);

  // Register for APNs push notifications once auth has resolved a user.
  // The hook self-gates on Expo Go / web / non-iOS and is idempotent per
  // app session.
  usePushRegistration(user?.id);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
