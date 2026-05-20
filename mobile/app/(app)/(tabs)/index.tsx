import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { api, unwrap } from '../../../src/api/client';
import { useAuth } from '../../../src/context/AuthContext';
import type { Project } from '../../../src/types';

export default function DashboardScreen() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await api.get('/projects');
      setProjects(unwrap<Project[]>(res));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  async function createProject() {
    Alert.prompt('New Research Project', 'Enter a title for your project:', async (title) => {
      if (!title?.trim()) return;
      try {
        const res = await api.post('/projects', { title: title.trim() });
        const project = unwrap<Project>(res);
        router.push(`/(app)/project/${project.id}`);
      } catch (e: any) {
        Alert.alert('Error', e?.response?.data?.error ?? e.message);
      }
    });
  }

  const isPro = user?.plan === 'pro';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>My Projects</Text>
        {!isPro && (
          <Text style={styles.planBadge}>Free Plan · {projects.length}/1 project</Text>
        )}
      </View>

      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProjects(); }} />}
        contentContainerStyle={projects.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔬</Text>
              <Text style={styles.emptyTitle}>No projects yet</Text>
              <Text style={styles.emptySubtitle}>Start your first research project to begin the AI-guided design wizard.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/(app)/project/${item.id}`)}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              <View style={[styles.statusBadge, item.status === 'completed' && styles.statusCompleted]}>
                <Text style={styles.statusText}>{item.status === 'in_progress' ? `Step ${item.current_step}/8` : item.status}</Text>
              </View>
            </View>
            <Text style={styles.cardDate}>{new Date(item.updated_at).toLocaleDateString()}</Text>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={createProject}>
        <Text style={styles.fabText}>+ New Project</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  greeting: { fontSize: 28, fontWeight: '700', color: '#1d1d1f' },
  planBadge: { fontSize: 13, color: '#888', marginTop: 2 },
  list: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', padding: 32 },
  empty: { alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1d1d1f', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1d1d1f' },
  statusBadge: { backgroundColor: '#dce6f5', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusCompleted: { backgroundColor: '#e8f5e9' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#004AAE' },
  cardDate: { fontSize: 13, color: '#888' },
  fab: { position: 'absolute', bottom: 24, left: 20, right: 20, backgroundColor: '#004AAE', borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: '#004AAE', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  fabText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
