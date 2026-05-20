import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { useAuth } from '../../../src/context/AuthContext';
import { api, unwrap } from '../../../src/api/client';
import type { SubscriptionStatus } from '../../../src/types';

const PRODUCT_ID = 'com.psychologydictionary.annual';

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
      const annual = offerings.current?.availablePackages.find(
        p => p.product.identifier === PRODUCT_ID
      ) ?? offerings.current?.availablePackages[0] ?? null;
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
        await api.post('/subscriptions/verify', {
          rc_customer_id: user!.id,
          product_id: PRODUCT_ID,
        });
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
        await api.post('/subscriptions/verify', {
          rc_customer_id: user!.id,
          product_id: PRODUCT_ID,
        });
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
        text: 'Sign Out', style: 'destructive', onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  const isPro = user?.plan === 'pro';
  const priceLabel = pkg?.product.priceString ?? '$70.00';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        {/* Account */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email ?? 'Apple Account'}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Plan</Text>
          <Text style={[styles.value, isPro && styles.valuePro]}>
            {isPro ? 'Pro Annual' : 'Free'}
          </Text>
          {isPro && subStatus?.expires_at && (
            <Text style={styles.expiresText}>
              Renews {new Date(subStatus.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </Text>
          )}
        </View>

        {/* Upgrade card — shown only for free users */}
        {!isPro && (
          <View style={styles.upgradeCard}>
            <View style={styles.upgradeHeader}>
              <Text style={styles.upgradeTitle}>Upgrade to Pro</Text>
              <View style={styles.priceBadge}>
                <Text style={styles.priceText}>{priceLabel}/year</Text>
              </View>
            </View>
            <Text style={styles.upgradeSubtitle}>Everything you need for serious research</Text>

            {[
              'Unlimited research projects',
              'Unlimited survey responses',
              '.docx export for APA reports',
              'All 7 statistical tests',
            ].map(f => (
              <View key={f} style={styles.featureRow}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}

            <TouchableOpacity
              style={[styles.upgradeBtn, purchasing && styles.upgradeBtnDisabled]}
              onPress={handleUpgrade}
              disabled={purchasing}
            >
              {purchasing
                ? <><ActivityIndicator color="#fff" size="small" /><Text style={styles.upgradeBtnText}>  Processing…</Text></>
                : <Text style={styles.upgradeBtnText}>Subscribe for {priceLabel}/year</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.restoreBtn}
              onPress={handleRestore}
              disabled={restoring}
            >
              {restoring
                ? <ActivityIndicator color={C.teal} size="small" />
                : <Text style={styles.restoreText}>Restore purchases</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Pro features status */}
        {isPro && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Pro Features</Text>
            {['Unlimited projects', 'Unlimited survey responses', '.docx export', 'All statistical tests'].map(f => (
              <View key={f} style={styles.featureCard}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={[styles.featureText, { color: C.ink }]}>{f}</Text>
              </View>
            ))}
          </>
        )}

        {/* Sign out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const C = { teal: '#00BDB6', dark: '#133844', tint: '#D1F9F1', edge: '#8EE8D8', ink: '#232830', sub: '#546072', bg: '#f5f7f7', card: '#fff' };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: C.ink, marginBottom: 20 },

  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  card: { backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 8 },
  label: { fontSize: 12, color: C.sub, marginBottom: 4 },
  value: { fontSize: 16, fontWeight: '500', color: C.ink },
  valuePro: { color: C.teal, fontWeight: '700' },
  expiresText: { fontSize: 12, color: C.sub, marginTop: 4 },

  upgradeCard: { backgroundColor: C.dark, borderRadius: 18, padding: 20, marginTop: 8, marginBottom: 16 },
  upgradeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  upgradeTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  priceBadge: { backgroundColor: '#ffffff22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  priceText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  upgradeSubtitle: { fontSize: 13, color: '#ffffffaa', marginBottom: 18 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  featureCheck: { color: C.teal, fontSize: 15, fontWeight: '700', marginRight: 10, width: 20 },
  featureText: { fontSize: 14, color: '#ffffffdd' },
  featureCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 10, padding: 14, marginBottom: 6 },

  upgradeBtn: { backgroundColor: C.teal, borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginTop: 8 },
  upgradeBtnDisabled: { backgroundColor: C.sub },
  upgradeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  restoreBtn: { alignItems: 'center', marginTop: 14, paddingVertical: 8 },
  restoreText: { color: '#ffffffaa', fontSize: 13 },

  logoutBtn: { marginTop: 24, backgroundColor: C.card, borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#ff3b30' },
  logoutText: { color: '#ff3b30', fontSize: 16, fontWeight: '600' },
});
