import { View, Text, TouchableOpacity, StyleSheet, Alert, SafeAreaView, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../../src/context/AuthContext';

export default function SettingsScreen() {
  const { user, logout } = useAuth();

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email ?? 'Apple Account'}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Plan</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.value, user?.plan === 'pro' && { color: '#0070c9' }]}>{user?.plan === 'pro' ? 'Pro Annual ($70/year)' : 'Free'}</Text>
              {user?.plan === 'free' && (
                <TouchableOpacity style={styles.upgradeBtn}>
                  <Text style={styles.upgradeBtnText}>Upgrade</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pro Features</Text>
          {['Unlimited projects', 'Unlimited survey responses', '.docx export', 'All statistical tests'].map((f) => (
            <View key={f} style={styles.featureRow}>
              <Text style={{ color: user?.plan === 'pro' ? '#34c759' : '#aaa', marginRight: 8 }}>{user?.plan === 'pro' ? '✓' : '○'}</Text>
              <Text style={{ color: user?.plan === 'pro' ? '#1d1d1f' : '#888', fontSize: 15 }}>{f}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  content: { padding: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#1d1d1f', marginBottom: 24 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, paddingHorizontal: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 8 },
  label: { fontSize: 13, color: '#888', marginBottom: 4 },
  value: { fontSize: 16, fontWeight: '500', color: '#1d1d1f' },
  upgradeBtn: { backgroundColor: '#0070c9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  upgradeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  featureRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 10, marginBottom: 6 },
  logoutBtn: { marginTop: 16, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#ff3b30' },
  logoutText: { color: '#ff3b30', fontSize: 16, fontWeight: '600' },
});
