import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { useAuth } from '../../../src/context/AuthContext';
import { api, unwrap } from '../../../src/api/client';
import type { SubscriptionStatus } from '../../../src/types';
import { Body, Button, Card, H1, LabelCaps, Muted, Pill, Screen } from '../../../components/ui';

const PRODUCT_ID = 'com.psychologydictionary.pro.annual';

export default function SettingsScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    fetchStatus();
    loadOffering();
  }, []);

  async function fetchStatus() {
    try {
      const res = await api.get('/subscriptions/status');
      setSubStatus(unwrap<SubscriptionStatus>(res));
    } catch {
      // non-fatal
    }
  }

  async function loadOffering() {
    try {
      const offerings = await Purchases.getOfferings();
      const annual =
        offerings.current?.availablePackages.find((p) => p.product.identifier === PRODUCT_ID) ??
        offerings.current?.availablePackages[0] ??
        null;
      setPkg(annual);
    } catch {
      // RevenueCat not configured yet (simulator / dev build)
    }
  }

  async function handleUpgrade() {
    if (!pkg) {
      Alert.alert('Not available', 'Unable to load subscription options. Please try again later.');
      return;
    }
    setPurchasing(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const isActive = !!customerInfo.entitlements.active['pro'];
      if (isActive) {
        await api.post('/subscriptions/verify', { rc_customer_id: user!.id, product_id: PRODUCT_ID });
        await refreshUser();
        await fetchStatus();
        Alert.alert('Welcome to Pro!', 'Your subscription is now active. Enjoy unlimited projects and all features.');
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Purchase failed', e.message ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const isActive = !!customerInfo.entitlements.active['pro'];
      if (isActive) {
        await api.post('/subscriptions/verify', { rc_customer_id: user!.id, product_id: PRODUCT_ID });
        await refreshUser();
        await fetchStatus();
        Alert.alert('Restored!', 'Your Pro subscription has been restored.');
      } else {
        Alert.alert('No purchases found', 'No active Pro subscription was found for your Apple ID.');
      }
    } catch (e: any) {
      Alert.alert('Restore failed', e.message ?? 'Something went wrong.');
    } finally {
      setRestoring(false);
    }
  }

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  const isPro = user?.plan === 'pro';
  const priceLabel = pkg?.product.priceString ?? '$79.99';

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <H1 className="mb-6">Settings</H1>

        <LabelCaps className="mb-2">Account</LabelCaps>
        <Card className="mb-2">
          <Muted className="text-label-sm mb-1">Email</Muted>
          <Body className="font-sans-medium">{user?.email ?? 'Apple Account'}</Body>
        </Card>
        <Card className="mb-4">
          <Muted className="text-label-sm mb-1">Plan</Muted>
          <Body className={`font-sans-semibold ${isPro ? 'text-teal' : 'text-ink'}`}>
            {isPro ? 'Pro Annual' : 'Free'}
          </Body>
          {isPro && subStatus?.expires_at && (
            <Muted className="text-label-sm mt-1">
              Renews{' '}
              {new Date(subStatus.expires_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Muted>
          )}
        </Card>

        {!isPro && (
          <View className="bg-navy-deep rounded-lg p-5 mb-4">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="font-serif text-headline-md text-white">Upgrade to Pro</Text>
              <View className="bg-white/15 rounded-full px-3 py-1">
                <Text className="font-sans-semibold text-label-caps text-white">{priceLabel}/year</Text>
              </View>
            </View>
            <Text className="font-sans text-body-md text-white/70 mb-4">Everything you need for serious research</Text>

            {[
              'Unlimited research projects',
              'Unlimited survey responses',
              '.docx export for APA reports',
              'All 7 statistical tests',
            ].map((f) => (
              <View key={f} className="flex-row items-center mb-2.5">
                <Text className="text-gold font-sans-semibold mr-2.5 w-5">✓</Text>
                <Text className="font-sans text-body-md text-white/90">{f}</Text>
              </View>
            ))}

            <Pressable
              onPress={handleUpgrade}
              disabled={purchasing}
              className={`mt-3 rounded-lg py-3.5 items-center justify-center flex-row ${purchasing ? 'bg-purple/50' : 'bg-purple active:bg-purple/80'}`}
            >
              {purchasing ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text className="font-sans-semibold text-white text-body-lg ml-2">Processing…</Text>
                </>
              ) : (
                <Text className="font-sans-semibold text-white text-body-lg">Subscribe for {priceLabel}/year</Text>
              )}
            </Pressable>

            <Pressable onPress={handleRestore} disabled={restoring} className="items-center mt-3 py-2">
              {restoring ? (
                <ActivityIndicator color="#dcb8fd" size="small" />
              ) : (
                <Text className="font-sans text-label-sm text-white/70">Restore purchases</Text>
              )}
            </Pressable>
          </View>
        )}

        {isPro && (
          <>
            <LabelCaps className="mt-2 mb-2">Pro Features</LabelCaps>
            {['Unlimited projects', 'Unlimited survey responses', '.docx export', 'All statistical tests'].map((f) => (
              <Card key={f} className="mb-1.5 flex-row items-center">
                <Text className="text-teal font-sans-semibold mr-3 w-5">✓</Text>
                <Body>{f}</Body>
                <View className="ml-auto">
                  <Pill color="teal">ACTIVE</Pill>
                </View>
              </Card>
            ))}
          </>
        )}

        <Pressable
          onPress={handleLogout}
          className="mt-6 bg-surface-lowest rounded-lg py-4 items-center border border-danger active:bg-danger/5"
        >
          <Text className="font-sans-semibold text-body-lg text-danger">Sign Out</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
