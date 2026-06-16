import { useEffect, useState, useCallback } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Archive, ArchiveRestore, MoreHorizontal, Microscope, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { api, unwrap } from '../../../src/api/client';
import { useAuth } from '../../../src/context/AuthContext';
import type { Project } from '../../../src/types';
import { Button, Card, H1, LabelCaps, Muted, Pill, Screen } from '../../../components/ui';
import { SheetModal } from '../../../components/SheetModal';

type ViewMode = 'active' | 'archived';

type DeletionPreview = {
  title: string;
  surveys: number;
  responses: number;
  analyses: number;
  apa_documents: number;
};

export default function DashboardScreen() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('active');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New project sheet
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  // Per-project action sheets — one set of state, project ref switches.
  const [actionOpen, setActionOpen] = useState(false);
  const [actionProject, setActionProject] = useState<Project | null>(null);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deletePreview, setDeletePreview] = useState<DeletionPreview | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await api.get(`/projects?status=${viewMode}`);
      setProjects(unwrap<Project[]>(res));
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [viewMode]);

  useEffect(() => {
    setLoading(true);
    fetchProjects();
  }, [fetchProjects]);

  // ----- Create -----

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
      Alert.alert('Could not create project', e?.response?.data?.error ?? e?.response?.data?.detail ?? e.message);
    } finally {
      setCreateBusy(false);
    }
  }

  // ----- Per-project actions -----

  function openActions(project: Project) {
    setActionProject(project);
    setActionOpen(true);
  }

  function closeActions() {
    setActionOpen(false);
    // Give the sheet a frame to slide out before dropping the project ref so
    // the title in the header doesn't blank-flash while closing.
    setTimeout(() => setActionProject(null), 250);
  }

  function startRename() {
    if (!actionProject) return;
    setRenameTitle(actionProject.title);
    setActionOpen(false);
    setRenameOpen(true);
  }

  async function submitRename() {
    if (!actionProject) return;
    const title = renameTitle.trim();
    if (!title || title === actionProject.title) {
      setRenameOpen(false);
      return;
    }
    setRenameBusy(true);
    try {
      const res = await api.put(`/projects/${actionProject.id}`, { title });
      const updated = unwrap<Project>(res);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setRenameOpen(false);
    } catch (e: any) {
      Alert.alert('Could not rename', e?.response?.data?.error ?? e?.response?.data?.detail ?? e.message);
    } finally {
      setRenameBusy(false);
    }
  }

  function startArchive() {
    setActionOpen(false);
    setArchiveOpen(true);
  }

  async function submitArchive() {
    if (!actionProject) return;
    setArchiveBusy(true);
    try {
      await api.post(`/projects/${actionProject.id}/archive`);
      setArchiveOpen(false);
      setActionProject(null);
      await fetchProjects();
    } catch (e: any) {
      Alert.alert('Could not archive', e?.response?.data?.error ?? e?.response?.data?.detail ?? e.message);
    } finally {
      setArchiveBusy(false);
    }
  }

  function startRestore() {
    setActionOpen(false);
    setRestoreOpen(true);
  }

  async function submitRestore() {
    if (!actionProject) return;
    setRestoreBusy(true);
    try {
      await api.post(`/projects/${actionProject.id}/restore`);
      setRestoreOpen(false);
      setActionProject(null);
      await fetchProjects();
    } catch (e: any) {
      Alert.alert('Could not restore', e?.response?.data?.error ?? e?.response?.data?.detail ?? e.message);
    } finally {
      setRestoreBusy(false);
    }
  }

  async function startDelete() {
    if (!actionProject) return;
    setActionOpen(false);
    setDeleteOpen(true);
    setDeletePreview(null);
    try {
      const res = await api.get(`/projects/${actionProject.id}/deletion-preview`);
      setDeletePreview(unwrap<DeletionPreview>(res));
    } catch (e: any) {
      Alert.alert('Could not load preview', e?.response?.data?.error ?? e?.response?.data?.detail ?? e.message);
      setDeleteOpen(false);
    }
  }

  async function submitDelete() {
    if (!actionProject) return;
    setDeleteBusy(true);
    try {
      await api.delete(`/projects/${actionProject.id}`);
      setDeleteOpen(false);
      setActionProject(null);
      await fetchProjects();
    } catch (e: any) {
      Alert.alert('Could not delete', e?.response?.data?.error ?? e?.response?.data?.detail ?? e.message);
    } finally {
      setDeleteBusy(false);
    }
  }

  const isPro = user?.plan === 'pro';
  const activeCount = viewMode === 'active' ? projects.length : 0;

  return (
    <Screen>
      <View className="px-5 pt-4 pb-2">
        <LabelCaps className="text-navy mb-1">Research Overview</LabelCaps>
        <H1>My Projects</H1>
        {!isPro && viewMode === 'active' && (
          <Muted className="mt-1">Free Plan · {activeCount}/1 active project</Muted>
        )}
        {isPro && <Pill color="gold" className="mt-2">PRO MEMBER</Pill>}
      </View>

      {/* Active / Archive segmented control */}
      <View
        style={{
          flexDirection: 'row',
          marginHorizontal: 16,
          marginTop: 8,
          marginBottom: 4,
          padding: 3,
          backgroundColor: '#eef0f3',
          borderRadius: 10,
        }}
      >
        {(['active', 'archived'] as const).map((mode) => {
          const isActive = mode === viewMode;
          return (
            <Pressable
              key={mode}
              onPress={() => setViewMode(mode)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                alignItems: 'center',
                backgroundColor: isActive ? '#ffffff' : 'transparent',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? '#1a2b48' : '#75777e' }}>
                {mode === 'active' ? 'Active' : 'Archive'}
              </Text>
            </Pressable>
          );
        })}
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
        contentContainerStyle={
          projects.length === 0
            ? { flex: 1, justifyContent: 'center', padding: 32 }
            : { padding: 16, gap: 12, paddingBottom: 96 }
        }
        ListEmptyComponent={
          loading ? null : (
            <View className="items-center">
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 16,
                  backgroundColor: 'rgba(111,81,142,0.10)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                {viewMode === 'archived' ? (
                  <Archive size={36} color="#6f518e" strokeWidth={1.6} />
                ) : (
                  <Microscope size={40} color="#6f518e" strokeWidth={1.6} />
                )}
              </View>
              <Text className="font-serif text-headline-md text-ink mb-2">
                {viewMode === 'archived' ? 'No archived projects' : 'No projects yet'}
              </Text>
              <Muted className="text-center">
                {viewMode === 'archived'
                  ? 'Archived projects let you preserve old studies without using up your active slot.'
                  : 'Start your first research project to begin the guided design wizard.'}
              </Muted>
            </View>
          )
        }
        renderItem={({ item }) => {
          const isArchived = item.status === 'archived';
          return (
            <Pressable
              onPress={() => {
                if (isArchived) {
                  // From archive view, primary tap opens actions instead of
                  // the project itself — archived projects are not editable.
                  openActions(item);
                } else {
                  router.push(`/(app)/project/${item.id}`);
                }
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Card>
                <View className="flex-row justify-between items-start gap-2 mb-2">
                  <Text className="flex-1 font-serif text-headline-md text-ink" numberOfLines={2}>
                    {item.title}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pill color={isArchived ? 'gray' : item.status === 'completed' ? 'teal' : 'purple'}>
                      {isArchived
                        ? 'archived'
                        : item.status === 'in_progress'
                        ? `Step ${item.current_step}/8`
                        : item.status}
                    </Pill>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation?.();
                        openActions(item);
                      }}
                      hitSlop={10}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <MoreHorizontal size={18} color="#75777e" strokeWidth={2.2} />
                    </Pressable>
                  </View>
                </View>
                <Muted className="text-label-sm">
                  Updated {new Date(item.updated_at).toLocaleDateString()}
                </Muted>
              </Card>
            </Pressable>
          );
        }}
      />

      {/* New project button — hidden in archive view */}
      {viewMode === 'active' && (
        <View className="absolute bottom-6 left-5 right-5">
          <Button
            onPress={openCreate}
            variant="primary"
            style={{
              shadowColor: '#1a2b48',
              shadowOpacity: 0.3,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Plus size={18} color="#fff" strokeWidth={2.4} />
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>New Project</Text>
            </View>
          </Button>
        </View>
      )}

      {/* --- Create sheet --- */}
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
          style={inputStyle}
        />
      </SheetModal>

      {/* --- Per-project actions sheet --- */}
      <SheetModal
        open={actionOpen}
        onClose={closeActions}
        title={actionProject?.title ?? ''}
        subtitle={
          actionProject?.status === 'archived'
            ? 'Archived project'
            : `Step ${actionProject?.current_step ?? '?'}/8`
        }
      >
        <View style={{ gap: 8 }}>
          {actionProject?.status !== 'archived' && (
            <ActionRow
              icon={<Pencil size={18} color="#1a2b48" strokeWidth={2} />}
              label="Edit name"
              onPress={startRename}
            />
          )}
          {actionProject?.status === 'archived' ? (
            <>
              <ActionRow
                icon={<ArchiveRestore size={18} color="#1a2b48" strokeWidth={2} />}
                label="Restore"
                description="Bring back to the active list. Closed surveys stay closed."
                onPress={startRestore}
              />
              <ActionRow
                icon={<Trash2 size={18} color="#c0392b" strokeWidth={2} />}
                label="Delete forever"
                description="Permanently deletes the project and all of its data. Cannot be undone."
                destructive
                onPress={startDelete}
              />
            </>
          ) : (
            <ActionRow
              icon={<Archive size={18} color="#1a2b48" strokeWidth={2} />}
              label="Archive"
              description="Hides this project and auto-closes its surveys. Responses are preserved."
              onPress={startArchive}
            />
          )}
        </View>
      </SheetModal>

      {/* --- Rename --- */}
      <SheetModal
        open={renameOpen}
        onClose={() => (renameBusy ? undefined : setRenameOpen(false))}
        title="Edit project name"
        footer={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button onPress={() => setRenameOpen(false)} variant="ghost" style={{ flex: 1 }}>
              <Text style={{ color: '#1a2b48', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
            </Button>
            <Button
              onPress={submitRename}
              variant="primary"
              loading={renameBusy}
              disabled={!renameTitle.trim()}
              style={{ flex: 1 }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Save</Text>
            </Button>
          </View>
        }
      >
        <TextInput
          value={renameTitle}
          onChangeText={setRenameTitle}
          placeholder="Project name"
          placeholderTextColor="#75777e"
          autoFocus
          maxLength={120}
          returnKeyType="done"
          onSubmitEditing={submitRename}
          style={inputStyle}
        />
      </SheetModal>

      {/* --- Archive confirm --- */}
      <SheetModal
        open={archiveOpen}
        onClose={() => (archiveBusy ? undefined : setArchiveOpen(false))}
        title="Archive this project?"
        subtitle="The project is hidden from your active list and any open surveys are auto-closed. Responses already collected are preserved. You can restore it later."
        footer={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button onPress={() => setArchiveOpen(false)} variant="ghost" style={{ flex: 1 }}>
              <Text style={{ color: '#1a2b48', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
            </Button>
            <Button onPress={submitArchive} variant="primary" loading={archiveBusy} style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Archive</Text>
            </Button>
          </View>
        }
      >
        <Text style={{ fontSize: 15, color: '#5b5d63', lineHeight: 22 }}>
          {`"${actionProject?.title ?? ''}" will move to the Archive tab.`}
        </Text>
      </SheetModal>

      {/* --- Restore confirm --- */}
      <SheetModal
        open={restoreOpen}
        onClose={() => (restoreBusy ? undefined : setRestoreOpen(false))}
        title="Restore this project?"
        footer={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button onPress={() => setRestoreOpen(false)} variant="ghost" style={{ flex: 1 }}>
              <Text style={{ color: '#1a2b48', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
            </Button>
            <Button onPress={submitRestore} variant="primary" loading={restoreBusy} style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Restore</Text>
            </Button>
          </View>
        }
      >
        <Text style={{ fontSize: 15, color: '#5b5d63', lineHeight: 22 }}>
          {`"${actionProject?.title ?? ''}" returns to your active list. Surveys that were auto-closed when you archived will stay closed — re-open them manually if you want to collect more responses.`}
        </Text>
      </SheetModal>

      {/* --- Delete forever confirm (with preview) --- */}
      <SheetModal
        open={deleteOpen}
        onClose={() => (deleteBusy ? undefined : setDeleteOpen(false))}
        title="Delete forever?"
        subtitle="This action cannot be undone. Everything listed below will be permanently removed."
        footer={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button onPress={() => setDeleteOpen(false)} variant="ghost" style={{ flex: 1 }}>
              <Text style={{ color: '#1a2b48', fontSize: 16, fontWeight: '600' }}>Cancel</Text>
            </Button>
            <Button
              onPress={submitDelete}
              variant="primary"
              loading={deleteBusy}
              disabled={!deletePreview}
              style={{ flex: 1, backgroundColor: '#c0392b' }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Delete</Text>
            </Button>
          </View>
        }
      >
        {deletePreview ? (
          <View style={{ gap: 14 }}>
            <Text style={{ fontSize: 15, color: '#5b5d63', lineHeight: 22 }}>
              {`Deleting "${deletePreview.title}" will also remove:`}
            </Text>
            <View
              style={{
                gap: 1,
                backgroundColor: '#e6e3da',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <CountRow label="Surveys" count={deletePreview.surveys} />
              <CountRow label="Participant responses" count={deletePreview.responses} />
              <CountRow label="Statistical analyses" count={deletePreview.analyses} />
              <CountRow label="Generated APA papers" count={deletePreview.apa_documents} />
            </View>
            <Text style={{ fontSize: 13, color: '#c0392b', lineHeight: 19 }}>
              Participant responses are irreplaceable. Consider Archive instead if you might want this data later.
            </Text>
          </View>
        ) : (
          <Text style={{ fontSize: 15, color: '#75777e' }}>Calculating impact…</Text>
        )}
      </SheetModal>
    </Screen>
  );
}

// ---- Local small components ----

function ActionRow({
  icon,
  label,
  description,
  destructive,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: pressed ? 0.65 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: destructive ? 'rgba(192,57,43,0.30)' : '#e6e3da',
        backgroundColor: '#ffffff',
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: destructive ? 'rgba(192,57,43,0.08)' : 'rgba(26,43,72,0.06)',
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: destructive ? '#c0392b' : '#191c1d',
          }}
        >
          {label}
        </Text>
        {description ? (
          <Text style={{ fontSize: 13, color: '#75777e', marginTop: 2, lineHeight: 18 }}>
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function CountRow({ label, count }: { label: string; count: number }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <Text style={{ fontSize: 15, color: '#191c1d' }}>{label}</Text>
      <Text style={{ fontSize: 17, fontWeight: '700', color: count > 0 ? '#c0392b' : '#75777e' }}>
        {count}
      </Text>
    </View>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: '#c5c6ce',
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 12,
  fontSize: 16,
  color: '#191c1d',
  backgroundColor: '#fff',
};
