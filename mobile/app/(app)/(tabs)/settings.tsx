import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { useAuth } from '../../../src/context/AuthContext';
import { api, unwrap } from '../../../src/api/client';
import type { SubscriptionStatus } from '../../../src/types';
import { Body, Button, Card, H1, LabelCaps, Muted, Pill, Screen } from '../../../components/ui';

const PRODUCT_ID = 'com.psychologydictionary.pro.annual';
const PRIVACY_URL = 'https://api.psychologydictionary.app/privacy';
const TERMS_URL = 'https://api.psychologydictionary.app/terms';

export default function SettingsScreen() {
  const { user, hasAiConsent, setAiConsent, logout, refreshUser } = useAuth();
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleToggleAi(grant: boolean) {
    if (togglingAi) return;
    if (!grant) {
      // Revoke: confirm because AI-dependent features will be disabled.
      Alert.alert(
        'Revoke AI consent?',
        'Generate, statistical interpretations, and APA report generation will be disabled. You can re-enable AI any time from this screen.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Revoke',
            style: 'destructive',
            onPress: async () => {
              setTogglingAi(true);
              try { await setAiConsent(false); }
              catch (e: any) { Alert.alert('Failed', e.message); }
              finally { setTogglingAi(false); }
            },
          },
        ],
      );
      return;
    }
    setTogglingAi(true);
    try {
      await setAiConsent(true);
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setTogglingAi(false);
    }
  }

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
    } catch (e: any) {
      // RevenueCat not configured (simulator / dev build / store sandbox not signed in).
      // Surfacing this via console makes App Review's job easier when they tap Subscribe
      // and we have to explain why the offering didn't load.
      console.warn('[Settings] Purchases.getOfferings failed:', e?.message ?? e);
    }
  }

  async function handleUpgrade() {
    // If we don't have an offering yet, try once more — App Review may have signed
    // into a sandbox account AFTER the screen mounted, in which case the first
    // loadOffering() at useEffect time returned nothing.
    let activePkg = pkg;
    if (!activePkg) {
      await loadOffering();
      activePkg = pkg;
    }
    if (!activePkg) {
      Alert.alert(
        'Subscription unavailable',
        'No active subscription offering was returned by the App Store. If you are reviewing this build, please sign in to a Sandbox tester account in Settings → App Store → Sandbox Account, then return here and try again.',
      );
      return;
    }
    setPurchasing(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(activePkg);
      const isActive = !!customerInfo.entitlements.active['pro'];
      if (isActive) {
        // Backend uses the authenticated user's id as RevenueCat's appUserID,
        // so we don't (and can't) pass rc_customer_id here.
        await api.post('/subscriptions/verify', { product_id: PRODUCT_ID });
        await refreshUser();
        await fetchStatus();
        Alert.alert('Welcome to Pro!', 'Your subscription is now active. Enjoy unlimited projects and all features.');
      } else {
        // Edge case: purchase reported success but no entitlement yet.
        Alert.alert(
          'Almost done',
          'The purchase completed but the Pro entitlement has not propagated yet. Try Restore Purchases in a few seconds.',
        );
      }
    } catch (e: any) {
      if (e?.userCancelled) return;
      const detail =
        e?.underlyingErrorMessage ??
        e?.message ??
        e?.toString?.() ??
        'Unknown error';
      console.warn('[Settings] purchasePackage failed:', detail, e?.code, e);
      Alert.alert(
        'Purchase could not be completed',
        `${detail}\n\nIf you are App Review, please sign in to a Sandbox tester account and try again.`,
      );
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
        await api.post('/subscriptions/verify', { product_id: PRODUCT_ID });
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

  // App Store Guideline 5.1.1(v): apps that support account creation must
  // also offer in-app account deletion. We hit DELETE /auth/me (already
  // exists in backend), then logout and route back to the login screen.
  function handleDeleteAccount() {
    Alert.alert(
      'Delete your account?',
      'This permanently removes your account and EVERY project, survey, response, statistical analysis and APA paper you have created. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            // Second confirmation — Apple does not require it but it gives the
            // user a sober beat before destroying data.
            Alert.alert(
              'Are you absolutely sure?',
              'Tap "Delete forever" to permanently delete your account and all associated data. Tap Cancel to keep your account.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete forever',
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      await api.delete('/auth/me');
                      await logout();
                      router.replace('/(auth)/login');
                    } catch (e: any) {
                      Alert.alert(
                        'Could not delete account',
                        e?.response?.data?.error ?? e?.response?.data?.detail ?? e.message,
                      );
                    } finally {
                      setDeleting(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
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
              <Text className="font-serif text-headline-md text-white">
                Psychology Dictionary Lab Pro
              </Text>
              <View className="bg-white/15 rounded-full px-3 py-1">
                <Text className="font-sans-semibold text-label-caps text-white">{priceLabel}/year</Text>
              </View>
            </View>
            <Text className="font-sans text-body-md text-white/70 mb-4">
              Annual auto-renewing subscription · {priceLabel} per year
            </Text>

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

            {/* Apple Guideline 3.1.2(c) — the auto-renewal disclosure and the
                tappable Privacy + Terms links MUST appear in the same screen
                as the Subscribe button. */}
            <Text
              className="font-sans text-label-sm text-white/60 mt-3 mb-2"
              style={{ lineHeight: 18 }}
            >
              Payment will be charged to your Apple ID at confirmation of purchase.
              Subscription automatically renews unless canceled at least 24 hours before
              the end of the current period. Manage your subscription in iOS Settings →
              your name → Subscriptions.
            </Text>

            <Pressable
              onPress={handleUpgrade}
              disabled={purchasing}
              className={`mt-2 rounded-lg py-3.5 items-center justify-center flex-row ${purchasing ? 'bg-purple/50' : 'bg-purple active:bg-purple/80'}`}
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

            <View className="flex-row items-center justify-center mt-3" style={{ gap: 18 }}>
              <Pressable
                onPress={() => Linking.openURL(PRIVACY_URL)}
                hitSlop={10}
              >
                <Text className="font-sans text-label-sm text-white/80 underline">
                  Privacy Policy
                </Text>
              </Pressable>
              <Text className="text-white/40">·</Text>
              <Pressable
                onPress={() => Linking.openURL(TERMS_URL)}
                hitSlop={10}
              >
                <Text className="font-sans text-label-sm text-white/80 underline">
                  Terms of Use
                </Text>
              </Pressable>
              <Text className="text-white/40">·</Text>
              <Pressable onPress={handleRestore} disabled={restoring} hitSlop={10}>
                {restoring ? (
                  <ActivityIndicator color="#dcb8fd" size="small" />
                ) : (
                  <Text className="font-sans text-label-sm text-white/80 underline">
                    Restore Purchases
                  </Text>
                )}
              </Pressable>
            </View>
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
            {/* Pro users still need the same legal links + Restore Purchases
                available, per Apple's policy. */}
            <View className="flex-row items-center justify-center mt-2 mb-2" style={{ gap: 18 }}>
              <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={10}>
                <Text className="font-sans text-label-sm text-ink-muted underline">Privacy</Text>
              </Pressable>
              <Text className="text-ink-muted">·</Text>
              <Pressable onPress={() => Linking.openURL(TERMS_URL)} hitSlop={10}>
                <Text className="font-sans text-label-sm text-ink-muted underline">Terms</Text>
              </Pressable>
              <Text className="text-ink-muted">·</Text>
              <Pressable onPress={handleRestore} disabled={restoring} hitSlop={10}>
                {restoring ? (
                  <ActivityIndicator color="#1a2b48" size="small" />
                ) : (
                  <Text className="font-sans text-label-sm text-ink-muted underline">Restore</Text>
                )}
              </Pressable>
            </View>
          </>
        )}

        {/* AI features toggle — required by App Store Guideline 5.1.2(i) */}
        <LabelCaps className="mt-4 mb-2">AI features</LabelCaps>
        <Card className="mb-2">
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Body className="font-sans-medium">
                {hasAiConsent ? 'Enabled' : 'Disabled'}
              </Body>
              <Muted className="text-label-sm mt-1">
                When enabled, your research design content is sent to Anthropic Claude for guided
                suggestions, statistical interpretations, and APA paper drafts. Survey participant
                responses are never sent. Anthropic does not train on your inputs.
              </Muted>
            </View>
            <Pressable
              onPress={() => handleToggleAi(!hasAiConsent)}
              disabled={togglingAi}
              accessibilityRole="switch"
              accessibilityState={{ checked: hasAiConsent }}
              style={{
                width: 52,
                height: 32,
                borderRadius: 16,
                backgroundColor: hasAiConsent ? '#6f518e' : '#c5c6ce',
                padding: 2,
                opacity: togglingAi ? 0.5 : 1,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: '#ffffff',
                  transform: [{ translateX: hasAiConsent ? 20 : 0 }],
                  shadowColor: '#000',
                  shadowOpacity: 0.15,
                  shadowRadius: 2,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 2,
                }}
              />
            </Pressable>
          </View>
        </Card>

        {/* Legal — global links for users who don't subscribe and so never see
            the paywall section above. */}
        <LabelCaps className="mt-4 mb-2">Legal</LabelCaps>
        <Card className="mb-2">
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} className="py-1">
            <Body className="font-sans-medium text-navy">Privacy Policy</Body>
          </Pressable>
        </Card>
        <Card className="mb-4">
          <Pressable onPress={() => Linking.openURL(TERMS_URL)} className="py-1">
            <Body className="font-sans-medium text-navy">Terms of Use</Body>
          </Pressable>
        </Card>

        <Pressable
          onPress={handleLogout}
          className="mt-2 bg-surface-lowest rounded-lg py-4 items-center border border-danger active:bg-danger/5"
        >
          <Text className="font-sans-semibold text-body-lg text-danger">Sign Out</Text>
        </Pressable>

        {/* Account deletion — App Store Guideline 5.1.1(v) */}
        <Pressable
          onPress={handleDeleteAccount}
          disabled={deleting}
          className="mt-3 rounded-lg py-4 items-center"
          style={{ backgroundColor: 'rgba(192, 57, 43, 0.08)', opacity: deleting ? 0.6 : 1 }}
        >
          {deleting ? (
            <ActivityIndicator color="#c0392b" size="small" />
          ) : (
            <Text className="font-sans-semibold text-body-md" style={{ color: '#c0392b' }}>
              Delete Account
            </Text>
          )}
        </Pressable>
        <Muted className="text-label-sm text-center mt-2 mb-2 px-4">
          Permanently deletes your account and all data. This cannot be undone.
        </Muted>
      </ScrollView>
    </Screen>
  );
}
