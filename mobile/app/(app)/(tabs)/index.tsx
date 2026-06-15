import { useEffect, useState, useCallback } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Microscope, Plus } from 'lucide-react-native';
import { api, unwrap } from '../../../src/api/client';
import { useAuth } from '../../../src/context/AuthContext';
import type { Project } from '../../../src/types';
import { Body, Button, Card, H1, LabelCaps, Muted, Pill, Screen } from '../../../components/ui';
import { SheetModal } from '../../../components/SheetModal';

export default function DashboardScreen() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // SheetModal-based "New Project" prompt. Replaces Alert.prompt (iOS-only,
  // crashes on Android) and gives us validation + length cap.
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

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

  function openCreate() {
    setCreateTitle('');
    setCreateOpen(true);
  }

  async function submitCreate() {
    const title = createTitle.trim();
    if (!title) return;
    setCreateBusy(true);
    try {
      const res = await api.post('/projects', { title });
      const project = unwrap<Project>(res);
      setCreateOpen(false);
      router.push(`/(app)/project/${project.id}`);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? e.message);
    } finally {
      setCreateBusy(false);
    }
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
              <View style={{ width: 72, height: 72, borderRadius: 16, backgroundColor: 'rgba(111,81,142,0.10)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Microscope size={40} color="#6f518e" strokeWidth={1.6} />
              </View>
              <Text className="font-serif text-headline-md text-ink mb-2">No projects yet</Text>
              <Muted className="text-center">Start your first research project to begin the guided design wizard.</Muted>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              console.log('[Dashboard] tapped project', item.id);
              router.push(`/(app)/project/${item.id}`);
            }}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Card>
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
        <Button
          onPress={openCreate}
          variant="primary"
          style={{ shadowColor: '#1a2b48', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Plus size={18} color="#fff" strokeWidth={2.4} />
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>New Project</Text>
          </View>
        </Button>
      </View>

      <SheetModal
        open={createOpen}
        onClose={() => (createBusy ? undefined : setCreateOpen(false))}
        title="New Research Project"
        subtitle="Enter a working title — you can refine it later."
        footer={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button onPress={() => setCreateOpen(false)} variant="ghost" style={{ flex: 1 }}>
              <Text style={{ color: '#1a2b48', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
            </Button>
            <Button
              onPress={submitCreate}
              variant="primary"
              loading={createBusy}
              disabled={!createTitle.trim()}
              style={{ flex: 1 }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Create</Text>
            </Button>
          </View>
        }
      >
        <TextInput
          value={createTitle}
          onChangeText={setCreateTitle}
          placeholder="e.g. Stress and academic performance in undergraduates"
          placeholderTextColor="#75777e"
          autoFocus
          maxLength={120}
          returnKeyType="done"
          onSubmitEditing={submitCreate}
          style={{
            borderWidth: 1,
            borderColor: '#c5c6ce',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 12,
            fontSize: 16,
            color: '#191c1d',
            backgroundColor: '#fff',
          }}
        />
      </SheetModal>
    </Screen>
  );
}
