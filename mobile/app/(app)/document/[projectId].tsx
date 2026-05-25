import { useEffect, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, unwrap } from '../../../src/api/client';
import { useAuth } from '../../../src/context/AuthContext';
import type { ApaDocument } from '../../../src/types';
import { Button, H2, Muted, Screen } from '../../../components/ui';

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 min hard cap

const SECTIONS = [
  { key: 'abstract', label: 'Abstract' },
  { key: 'introduction', label: 'Introduction' },
  { key: 'method', label: 'Method' },
  { key: 'results', label: 'Results' },
  { key: 'discussion', label: 'Discussion' },
  { key: 'references', label: 'References' },
] as const;

export default function DocumentScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { user } = useAuth();
  const [doc, setDoc] = useState<ApaDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>('abstract');
  // Polling lifecycle — kept in refs so unmount cleanup is reliable.
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollDeadline = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const pollDocument = useCallback(async (documentId: string) => {
    try {
      const res = await api.get(`/documents/${documentId}`);
      const updated = unwrap<ApaDocument>(res);
      setDoc(updated);
      if (updated.status === 'ready') {
        stopPolling();
        return;
      }
      if (updated.status === 'failed') {
        stopPolling();
        Alert.alert('Generation failed', updated.error ?? 'The backend returned no detail.');
        return;
      }
      if (Date.now() > pollDeadline.current) {
        stopPolling();
        Alert.alert('Still working', 'The report is taking longer than expected. Check back in a minute.');
        return;
      }
      pollTimer.current = setTimeout(() => pollDocument(documentId), POLL_INTERVAL_MS);
    } catch (e: any) {
      stopPolling();
      Alert.alert('Polling error', e?.response?.data?.error ?? e?.response?.data?.detail ?? e.message);
    }
  }, [stopPolling]);

  const fetchLatest = useCallback(async () => {
    try {
      const res = await api.get(`/documents/by-project/${projectId}`);
      const docs = unwrap<ApaDocument[]>(res);
      const latest = docs[0] ?? null;
      setDoc(latest);
      // If the user comes back while a previous generation is still pending,
      // resume polling so the UI catches up automatically.
      if (latest && latest.status === 'pending') {
        pollDeadline.current = Date.now() + POLL_TIMEOUT_MS;
        pollTimer.current = setTimeout(() => pollDocument(latest.id), POLL_INTERVAL_MS);
      }
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, pollDocument]);

  useEffect(() => {
    fetchLatest();
    return () => stopPolling();
  }, [fetchLatest, stopPolling]);

  async function generate() {
    stopPolling();
    try {
      const res = await api.post('/documents', { project_id: projectId });
      const created = unwrap<ApaDocument>(res);
      setDoc(created);
      pollDeadline.current = Date.now() + POLL_TIMEOUT_MS;
      pollTimer.current = setTimeout(() => pollDocument(created.id), POLL_INTERVAL_MS);
    } catch (e: any) {
      Alert.alert('Generation failed', e?.response?.data?.error ?? e?.response?.data?.detail ?? e.message);
    }
  }

  const generating = doc?.status === 'pending';

  async function openPdf() {
    if (!doc?.pdf_url) return;
    const supported = await Linking.canOpenURL(doc.pdf_url);
    if (supported) {
      await Linking.openURL(doc.pdf_url);
    } else {
      Alert.alert('Cannot open PDF', 'No PDF viewer available on this device.');
    }
  }

  async function exportDocx() {
    if (user?.plan !== 'pro') {
      Alert.alert('Pro Feature', '.docx export is available on the Pro plan ($79.99/year). Upgrade in Settings.');
      return;
    }
    if (!doc?.docx_url) {
      Alert.alert('Not available', 'This document was generated without a .docx file. Regenerate to get the .docx.');
      return;
    }
    await Linking.openURL(doc.docx_url);
  }

  function toggleSection(key: string) {
    setExpandedSection((prev) => (prev === key ? null : key));
  }

  return (
    <Screen>
      <View className="bg-surface-lowest border-b border-outline-soft px-4 py-3 flex-row items-center">
        <Pressable onPress={() => router.back()} className="w-16">
          <Text className="font-sans-medium text-body-md text-navy">‹ Back</Text>
        </Pressable>
        <Text className="flex-1 text-center font-serif text-headline-md text-ink">APA Report</Text>
        <View className="w-16" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6f518e" size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
          <Button onPress={generate} loading={generating} variant="success" disabled={generating}>
            ✦ {generating ? 'Generating…' : doc?.status === 'ready' ? 'Regenerate Report' : 'Generate APA Report'}
          </Button>

          {generating && (
            <View className="items-center gap-2 py-2">
              <ActivityIndicator color="#6f518e" size="small" />
              <Muted className="italic text-center text-label-sm">
                Claude is writing all sections in APA 7th edition format. This usually takes 60–120 seconds — you can leave this screen and come back.
              </Muted>
            </View>
          )}

          {doc?.status === 'failed' && (
            <View className="bg-red-50 border border-red-200 rounded p-3">
              <Text className="font-sans-semibold text-red-700">Last attempt failed</Text>
              <Text className="text-red-700 text-label-sm mt-1">{doc.error ?? 'Unknown error'}</Text>
            </View>
          )}

          {doc?.status === 'ready' && (
            <>
              <View className="flex-row gap-2.5">
                <Pressable onPress={openPdf} className="flex-1 bg-navy-deep rounded py-3 items-center active:bg-navy">
                  <Text className="font-sans-semibold text-white text-body-md">Open PDF</Text>
                </Pressable>
                <Pressable
                  onPress={exportDocx}
                  className={`flex-1 rounded py-3 items-center ${user?.plan === 'pro' ? 'bg-purple active:bg-purple/80' : 'bg-surface-high'}`}
                >
                  <Text className={`font-sans-semibold text-body-md ${user?.plan === 'pro' ? 'text-white' : 'text-ink-muted'}`}>
                    {user?.plan === 'pro' ? 'Export .docx' : 'Export .docx 🔒'}
                  </Text>
                </Pressable>
              </View>

              {doc.content_json.title && (
                <H2 className="text-center leading-7">{doc.content_json.title}</H2>
              )}

              <View className="gap-2">
                {SECTIONS.map(({ key, label }) => {
                  const text = doc.content_json[key];
                  if (!text) return null;
                  const expanded = expandedSection === key;
                  return (
                    <View key={key} className="bg-surface-lowest rounded border border-outline-soft overflow-hidden">
                      <Pressable
                        onPress={() => toggleSection(key)}
                        className="flex-row justify-between items-center p-4 active:bg-surface-low"
                      >
                        <Text className="font-serif text-headline-md text-ink">{label}</Text>
                        <Text className="font-sans text-label-sm text-ink-muted">{expanded ? '▲' : '▼'}</Text>
                      </Pressable>
                      {expanded && (
                        <Text className="font-sans text-body-md text-ink leading-6 px-4 pb-4">{text}</Text>
                      )}
                    </View>
                  );
                })}
              </View>

              <Muted className="text-center text-label-sm mt-2">
                Generated {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Muted>
            </>
          )}

          {!doc && (
            <View className="items-center py-10">
              <Text className="text-5xl mb-4">📄</Text>
              <H2 className="mb-2">No report yet</H2>
              <Muted className="text-center">
                Complete your research design steps, then generate a full APA 7th edition report — abstract, introduction, method, results, discussion, and references.
              </Muted>
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
