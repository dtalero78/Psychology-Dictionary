import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, RefreshControl, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, unwrap } from '../../../src/api/client';
import type { Survey } from '../../../src/types';

export default function SurveyListScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSurveys = useCallback(async () => {
    try {
      const res = await api.get(`/surveys/by-project/${projectId}`);
      setSurveys(unwrap<Survey[]>(res));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => { fetchSurveys(); }, [fetchSurveys]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Surveys</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.teal} size="large" /></View>
      ) : (
        <FlatList
          data={surveys}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSurveys(); }} tintColor={C.teal} />}
          contentContainerStyle={surveys.length === 0 ? styles.emptyContainer : styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No surveys yet</Text>
              <Text style={styles.emptySub}>Create your first survey to start collecting participant data.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(app)/survey/${item.id}?projectId=${projectId}`)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <View style={[styles.statusBadge, item.status === 'active' ? styles.statusActive : styles.statusClosed]}>
                  <Text style={[styles.statusText, item.status === 'active' ? styles.statusTextActive : styles.statusTextClosed]}>
                    {item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardSub}>
                {item.config_json.questions?.length ?? 0} questions · Created {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push(`/(app)/survey/create?projectId=${projectId}`)}
      >
        <Text style={styles.fabText}>+ New Survey</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const C = { teal: '#00BDB6', dark: '#133844', tint: '#D1F9F1', edge: '#8EE8D8', ink: '#232830', sub: '#546072', bg: '#f5f7f7', card: '#fff' };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.card, borderBottomWidth: 0.5, borderBottomColor: C.edge },
  backBtn: { width: 60 },
  backText: { color: C.teal, fontSize: 16 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: C.ink },
  list: { padding: 16, gap: 12, paddingBottom: 100 },
  emptyContainer: { flex: 1, justifyContent: 'center', padding: 32 },
  empty: { alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.ink, marginBottom: 8 },
  emptySub: { fontSize: 15, color: C.sub, textAlign: 'center', lineHeight: 22 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.edge },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: C.ink },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  statusActive: { backgroundColor: C.tint, borderColor: C.teal },
  statusClosed: { backgroundColor: '#f5f5f5', borderColor: '#ccc' },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusTextActive: { color: C.dark },
  statusTextClosed: { color: '#888' },
  cardSub: { fontSize: 13, color: C.sub },
  fab: { position: 'absolute', bottom: 24, left: 20, right: 20, backgroundColor: C.teal, borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: C.teal, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  fabText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
