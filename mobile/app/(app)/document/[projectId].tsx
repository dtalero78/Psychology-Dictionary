import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, unwrap } from '../../../src/api/client';
import { useAuth } from '../../../src/context/AuthContext';
import type { ApaDocument } from '../../../src/types';

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

  useEffect(() => { fetchLatest(); }, [fetchLatest]);

  async function generate() {
    setGenerating(true);
    try {
      const res = await api.post('/documents', { project_id: projectId });
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
      Alert.alert('Pro Feature', '.docx export is available on the Pro plan ($70/year). Upgrade in Settings.');
      return;
    }
    if (!doc?.docx_url) {
      Alert.alert('Not available', 'This document was generated without a .docx file. Regenerate to get the .docx.');
      return;
    }
    await Linking.openURL(doc.docx_url);
  }

  function toggleSection(key: string) {
    setExpandedSection(prev => prev === key ? null : key);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>APA Report</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.teal} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Generate / Regenerate CTA */}
          <TouchableOpacity
            style={[styles.genBtn, generating && styles.genBtnDisabled]}
            onPress={generate}
            disabled={generating}
          >
            {generating ? (
              <><ActivityIndicator color="#fff" size="small" /><Text style={styles.genBtnText}>  Generating with AI…</Text></>
            ) : (
              <Text style={styles.genBtnText}>{doc ? 'Regenerate Report ✦' : 'Generate APA Report ✦'}</Text>
            )}
          </TouchableOpacity>

          {generating && (
            <Text style={styles.genHint}>This may take 30–60 seconds. Claude is writing all sections in APA 7th edition format.</Text>
          )}

          {doc && (
            <>
              {/* Export row */}
              <View style={styles.exportRow}>
                <TouchableOpacity style={styles.exportBtn} onPress={openPdf}>
                  <Text style={styles.exportBtnText}>Open PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.exportBtn, user?.plan !== 'pro' && styles.exportBtnLocked]}
                  onPress={exportDocx}
                >
                  <Text style={styles.exportBtnText}>
                    {user?.plan === 'pro' ? 'Export .docx' : 'Export .docx 🔒'}
                  </Text>
                </TouchableOpacity>
              </View>

              {doc.content_json.title && (
                <Text style={styles.docTitle}>{doc.content_json.title}</Text>
              )}

              {/* Sections */}
              {SECTIONS.map(({ key, label }) => {
                const text = doc.content_json[key];
                if (!text) return null;
                const expanded = expandedSection === key;
                return (
                  <View key={key} style={styles.sectionCard}>
                    <TouchableOpacity
                      style={styles.sectionHeader}
                      onPress={() => toggleSection(key)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.sectionLabel}>{label}</Text>
                      <Text style={styles.sectionChevron}>{expanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {expanded && (
                      <Text style={styles.sectionBody}>{text}</Text>
                    )}
                  </View>
                );
              })}

              <Text style={styles.generatedAt}>
                Generated {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            </>
          )}

          {!doc && !generating && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📄</Text>
              <Text style={styles.emptyTitle}>No report yet</Text>
              <Text style={styles.emptySubtitle}>
                Complete your research design steps, then generate a full APA 7th edition report — abstract, introduction, method, results, discussion, and references.
              </Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const C = { teal: '#00BDB6', dark: '#133844', tint: '#D1F9F1', edge: '#8EE8D8', ink: '#232830', sub: '#546072', bg: '#f5f7f7', card: '#fff' };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.card, borderBottomWidth: 0.5, borderBottomColor: C.edge },
  backBtn: { width: 60 },
  backText: { color: C.teal, fontSize: 16 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: C.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16 },

  genBtn: { backgroundColor: C.dark, borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginBottom: 8 },
  genBtnDisabled: { backgroundColor: C.sub },
  genBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  genHint: { fontSize: 13, color: C.sub, textAlign: 'center', marginBottom: 20, fontStyle: 'italic', lineHeight: 20 },

  exportRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  exportBtn: { flex: 1, backgroundColor: C.teal, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  exportBtnLocked: { backgroundColor: C.sub },
  exportBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  docTitle: { fontSize: 18, fontWeight: '700', color: C.dark, textAlign: 'center', marginBottom: 20, lineHeight: 26 },

  sectionCard: { backgroundColor: C.card, borderRadius: 14, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.edge },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  sectionLabel: { fontSize: 15, fontWeight: '700', color: C.dark },
  sectionChevron: { fontSize: 11, color: C.sub },
  sectionBody: { fontSize: 14, color: C.ink, lineHeight: 24, paddingHorizontal: 16, paddingBottom: 16 },

  generatedAt: { fontSize: 12, color: C.sub, textAlign: 'center', marginTop: 16 },

  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.dark, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: C.sub, textAlign: 'center', lineHeight: 22 },
});
