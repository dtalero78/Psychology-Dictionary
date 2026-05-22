import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, aiTimeout, unwrap } from '../../../src/api/client';
import { useAuth } from '../../../src/context/AuthContext';
import type { ApaDocument } from '../../../src/types';
import { Body, Button, H2, LabelCaps, Muted, Screen } from '../../../components/ui';

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
  const [generating, setGenerating] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('abstract');

  const fetchLatest = useCallback(async () => {
    try {
      const res = await api.get(`/documents/by-project/${projectId}`);
      const docs = unwrap<ApaDocument[]>(res);
      setDoc(docs[0] ?? null);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  async function generate() {
    setGenerating(true);
    try {
      const res = await api.post('/documents', { project_id: projectId }, aiTimeout(180000));
      setDoc(unwrap<ApaDocument>(res));
    } catch (e: any) {
      Alert.alert('Generation failed', e?.response?.data?.error ?? e?.response?.data?.detail ?? e.message);
    } finally {
      setGenerating(false);
    }
  }

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
          <Button onPress={generate} loading={generating} variant="success">
            ✦ {doc ? 'Regenerate Report' : 'Generate APA Report'}
          </Button>

          {generating && (
            <Muted className="italic text-center text-label-sm">
              This may take 30–60 seconds. Claude is writing all sections in APA 7th edition format.
            </Muted>
          )}

          {doc && (
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

          {!doc && !generating && (
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
