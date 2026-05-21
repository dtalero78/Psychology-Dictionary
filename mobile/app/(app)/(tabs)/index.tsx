import { useEffect, useState, useCallback } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router } from 'expo-router';
import { api, unwrap } from '../../../src/api/client';
import { useAuth } from '../../../src/context/AuthContext';
import type { Project } from '../../../src/types';
import { Body, Card, H1, LabelCaps, Muted, Pill, Screen } from '../../../components/ui';

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

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

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
    <Screen>
      <View className="px-5 pt-4 pb-2">
        <LabelCaps className="text-navy mb-1">Research Overview</LabelCaps>
        <H1>My Projects</H1>
        {!isPro && <Muted className="mt-1">Free Plan · {projects.length}/1 project</Muted>}
        {isPro && <Pill color="gold" className="mt-2">PRO MEMBER</Pill>}
      </View>

      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchProjects();
            }}
            tintColor="#1a2b48"
          />
        }
        contentContainerStyle={projects.length === 0 ? { flex: 1, justifyContent: 'center', padding: 32 } : { padding: 16, gap: 12, paddingBottom: 96 }}
        ListEmptyComponent={
          loading ? null : (
            <View className="items-center">
              <Text className="text-5xl mb-4">🔬</Text>
              <Text className="font-serif text-headline-md text-ink mb-2">No projects yet</Text>
              <Muted className="text-center">Start your first research project to begin the guided design wizard.</Muted>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(app)/project/${item.id}`)}>
            <Card className="active:opacity-80">
              <View className="flex-row justify-between items-start gap-2 mb-2">
                <Text className="flex-1 font-serif text-headline-md text-ink" numberOfLines={2}>
                  {item.title}
                </Text>
                <Pill color={item.status === 'completed' ? 'teal' : 'purple'}>
                  {item.status === 'in_progress' ? `Step ${item.current_step}/8` : item.status}
                </Pill>
              </View>
              <Muted className="text-label-sm">Updated {new Date(item.updated_at).toLocaleDateString()}</Muted>
            </Card>
          </Pressable>
        )}
      />

      <View className="absolute bottom-6 left-5 right-5">
        <Pressable
          onPress={createProject}
          className="bg-navy-deep rounded-lg py-4 items-center active:bg-navy shadow-lg"
          style={{ shadowColor: '#1a2b48', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}
        >
          <Body className="text-white font-sans-semibold text-body-lg">+ New Project</Body>
        </Pressable>
      </View>
    </Screen>
  );
}
