import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, unwrap } from '../../../src/api/client';
import type { AnalysisResult } from '../../../src/types';

const TESTS = [
  {
    id: 'independent_ttest',
    label: 'Independent t-test',
    desc: 'Compare means of two separate groups',
    fields: [
      { key: 'group1', label: 'Group 1 scores', hint: 'e.g. 3,4,5,4,3' },
      { key: 'group2', label: 'Group 2 scores', hint: 'e.g. 2,3,2,3,2' },
    ],
    buildData: (f: Record<string, string>) => ({
      group1: parseNums(f.group1),
      group2: parseNums(f.group2),
    }),
  },
  {
    id: 'paired_ttest',
    label: 'Paired t-test',
    desc: 'Compare pre/post scores from the same participants',
    fields: [
      { key: 'pre', label: 'Pre scores', hint: 'e.g. 3,4,5,4,3' },
      { key: 'post', label: 'Post scores', hint: 'e.g. 4,5,6,5,4' },
    ],
    buildData: (f: Record<string, string>) => ({
      pre: parseNums(f.pre),
      post: parseNums(f.post),
    }),
  },
  {
    id: 'one_way_anova',
    label: 'One-way ANOVA',
    desc: 'Compare means across 3 or more groups',
    fields: [
      { key: 'g1', label: 'Group 1 scores', hint: 'e.g. 3,4,5' },
      { key: 'g2', label: 'Group 2 scores', hint: 'e.g. 2,3,2' },
      { key: 'g3', label: 'Group 3 scores', hint: 'e.g. 5,6,5' },
    ],
    buildData: (f: Record<string, string>) => ({
      groups: [parseNums(f.g1), parseNums(f.g2), parseNums(f.g3)].filter(g => g.length > 0),
    }),
  },
  {
    id: 'pearson',
    label: 'Pearson Correlation',
    desc: 'Measure linear relationship between two continuous variables',
    fields: [
      { key: 'x', label: 'Variable X', hint: 'e.g. 1,2,3,4,5' },
      { key: 'y', label: 'Variable Y', hint: 'e.g. 2,4,5,4,5' },
    ],
    buildData: (f: Record<string, string>) => ({ x: parseNums(f.x), y: parseNums(f.y) }),
  },
  {
    id: 'spearman',
    label: 'Spearman Correlation',
    desc: 'Measure rank-order relationship (non-parametric)',
    fields: [
      { key: 'x', label: 'Variable X', hint: 'e.g. 1,2,3,4,5' },
      { key: 'y', label: 'Variable Y', hint: 'e.g. 2,4,5,4,5' },
    ],
    buildData: (f: Record<string, string>) => ({ x: parseNums(f.x), y: parseNums(f.y) }),
  },
  {
    id: 'multiple_regression',
    label: 'Linear Regression',
    desc: 'Predict outcome Y from predictor X',
    fields: [
      { key: 'y', label: 'Outcome (Y)', hint: 'e.g. 4,5,6,5,4' },
      { key: 'x', label: 'Predictor (X)', hint: 'e.g. 1,2,3,4,5' },
    ],
    buildData: (f: Record<string, string>) => ({
      y: parseNums(f.y),
      X: parseNums(f.x).map(v => [v]),
    }),
  },
  {
    id: 'chi_square',
    label: 'Chi-square Test',
    desc: 'Test association between categorical variables (2×N table)',
    fields: [
      { key: 'row1', label: 'Row 1 observed counts', hint: 'e.g. 10,20,15' },
      { key: 'row2', label: 'Row 2 observed counts', hint: 'e.g. 15,10,25' },
    ],
    buildData: (f: Record<string, string>) => ({
      observed: [parseNums(f.row1), parseNums(f.row2)],
    }),
  },
] as const;

function parseNums(raw: string): number[] {
  return raw.split(/[,\s]+/).map(Number).filter(n => !isNaN(n) && raw.trim() !== '');
}

export default function AnalysisScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [selectedTest, setSelectedTest] = useState(TESTS[0]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get(`/analysis/by-project/${projectId}`);
      setHistory(unwrap<AnalysisResult[]>(res));
    } catch {
      // non-fatal
    } finally {
      setHistoryLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  function selectTest(test: typeof TESTS[number]) {
    setSelectedTest(test);
    setFields({});
    setResult(null);
  }

  function validate(): string | null {
    for (const field of selectedTest.fields) {
      const nums = parseNums(fields[field.key] ?? '');
      if (nums.length < 2) return `"${field.label}" needs at least 2 numbers.`;
    }
    return null;
  }

  async function runAnalysis() {
    const err = validate();
    if (err) { Alert.alert('Data error', err); return; }

    setRunning(true);
    setResult(null);
    try {
      const data = selectedTest.buildData(fields);
      const res = await api.post('/analysis', {
        project_id: projectId,
        test_type: selectedTest.id,
        data,
      });
      const r = unwrap<AnalysisResult>(res);
      setResult(r);
      setHistory(prev => [r, ...prev]);
    } catch (e: any) {
      Alert.alert('Analysis failed', e?.response?.data?.error ?? e?.response?.data?.detail ?? e.message);
    } finally {
      setRunning(false);
    }
  }

  const sig = result ? result.p_value < 0.05 : false;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Statistical Analysis</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Test selector */}
        <Text style={styles.sectionLabel}>Test Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.testScroll} contentContainerStyle={styles.testScrollContent}>
          {TESTS.map(t => (
            <TouchableOpacity
              key={t.id}
              style={[styles.testChip, selectedTest.id === t.id && styles.testChipActive]}
              onPress={() => selectTest(t)}
            >
              <Text style={[styles.testChipText, selectedTest.id === t.id && styles.testChipTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={styles.testDesc}>{selectedTest.desc}</Text>

        {/* Data fields */}
        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Data Input</Text>
        <Text style={styles.dataHint}>Enter numbers separated by commas. Each cell = one participant's score.</Text>

        {selectedTest.fields.map(f => (
          <View key={f.key} style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>{f.label}</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder={f.hint}
              placeholderTextColor={C.sub}
              value={fields[f.key] ?? ''}
              onChangeText={v => setFields(prev => ({ ...prev, [f.key]: v }))}
              keyboardType="numbers-and-punctuation"
              autoCorrect={false}
            />
            {(fields[f.key] ?? '').length > 0 && (
              <Text style={styles.fieldCount}>
                {parseNums(fields[f.key]).length} values
              </Text>
            )}
          </View>
        ))}

        <TouchableOpacity
          style={[styles.runBtn, running && styles.runBtnDisabled]}
          onPress={runAnalysis}
          disabled={running}
        >
          {running
            ? <><ActivityIndicator color="#fff" size="small" /><Text style={styles.runBtnText}>  Analyzing…</Text></>
            : <Text style={styles.runBtnText}>Run Analysis ✦</Text>
          }
        </TouchableOpacity>

        {/* Results */}
        {result && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>{selectedTest.label}</Text>
              <View style={[styles.sigBadge, sig ? styles.sigBadgeYes : styles.sigBadgeNo]}>
                <Text style={[styles.sigText, sig ? styles.sigTextYes : styles.sigTextNo]}>
                  {sig ? 'p < .05 ✓' : 'p ≥ .05'}
                </Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <StatCell label="Statistic" value={result.statistic.toFixed(3)} />
              <StatCell label="p-value" value={result.p_value < 0.001 ? '< .001' : result.p_value.toFixed(3)} />
              {result.effect_size != null && (
                <StatCell label="Effect size" value={`${result.effect_size.toFixed(3)} (${result.effect_label})`} />
              )}
              {result.ci_95 && (
                <StatCell label="95% CI" value={`[${result.ci_95[0].toFixed(3)}, ${result.ci_95[1].toFixed(3)}]`} />
              )}
            </View>

            <Text style={styles.apaLabel}>APA Interpretation</Text>
            <Text style={styles.apaText}>{result.interpretation_apa}</Text>

            <TouchableOpacity
              style={styles.detailBtn}
              onPress={() => router.push(`/(app)/analysis/result/${result.id}`)}
            >
              <Text style={styles.detailBtnText}>View full result →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* History */}
        {history.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 28 }]}>Previous Analyses</Text>
            {historyLoading
              ? <ActivityIndicator color={C.teal} />
              : history.map(h => (
                <TouchableOpacity
                  key={h.id}
                  style={styles.historyItem}
                  onPress={() => router.push(`/(app)/analysis/result/${h.id}`)}
                >
                  <View style={styles.historyLeft}>
                    <Text style={styles.historyTest}>{h.test_type.replace(/_/g, ' ')}</Text>
                    <Text style={styles.historyStat}>
                      p = {h.p_value < 0.001 ? '< .001' : h.p_value.toFixed(3)}
                      {h.effect_label ? ` · ${h.effect_label} effect` : ''}
                    </Text>
                  </View>
                  <View style={[styles.histSigDot, h.p_value < 0.05 ? styles.histSigDotYes : styles.histSigDotNo]} />
                </TouchableOpacity>
              ))
            }
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statCellLabel}>{label}</Text>
      <Text style={styles.statCellValue}>{value}</Text>
    </View>
  );
}

const C = { teal: '#00BDB6', dark: '#133844', tint: '#D1F9F1', edge: '#8EE8D8', ink: '#232830', sub: '#546072', bg: '#f5f7f7', card: '#fff' };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.card, borderBottomWidth: 0.5, borderBottomColor: C.edge },
  backBtn: { width: 60 },
  backText: { color: C.teal, fontSize: 16 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: C.ink },
  content: { padding: 16 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 },
  testScroll: { marginHorizontal: -16 },
  testScrollContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 2 },
  testChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: C.edge, backgroundColor: C.card },
  testChipActive: { backgroundColor: C.dark, borderColor: C.dark },
  testChipText: { fontSize: 13, fontWeight: '600', color: C.sub },
  testChipTextActive: { color: '#fff' },
  testDesc: { fontSize: 13, color: C.sub, marginTop: 10, fontStyle: 'italic' },

  dataHint: { fontSize: 13, color: C.sub, marginBottom: 12 },
  fieldBlock: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 6 },
  fieldInput: { backgroundColor: C.card, borderRadius: 10, borderWidth: 1.5, borderColor: C.edge, padding: 12, fontSize: 15, color: C.ink, fontFamily: 'monospace' },
  fieldCount: { fontSize: 11, color: C.teal, fontWeight: '600', marginTop: 4, textAlign: 'right' },

  runBtn: { backgroundColor: C.teal, borderRadius: 12, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginTop: 8, marginBottom: 20 },
  runBtnDisabled: { backgroundColor: C.edge },
  runBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  resultCard: { backgroundColor: C.card, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.edge, marginBottom: 20 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  resultTitle: { fontSize: 15, fontWeight: '700', color: C.dark, flex: 1 },
  sigBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  sigBadgeYes: { backgroundColor: '#e8f8f5', borderColor: C.teal },
  sigBadgeNo: { backgroundColor: '#f5f5f5', borderColor: '#ccc' },
  sigText: { fontSize: 12, fontWeight: '700' },
  sigTextYes: { color: C.dark },
  sigTextNo: { color: '#888' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1, backgroundColor: C.edge, borderRadius: 10, overflow: 'hidden', marginBottom: 16 },
  statCell: { flex: 1, minWidth: '45%', backgroundColor: C.card, padding: 12 },
  statCellLabel: { fontSize: 10, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  statCellValue: { fontSize: 16, fontWeight: '700', color: C.dark, fontFamily: 'monospace' },

  apaLabel: { fontSize: 11, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  apaText: { fontSize: 14, color: C.ink, lineHeight: 22, fontStyle: 'italic' },
  detailBtn: { marginTop: 14, alignSelf: 'flex-end' },
  detailBtnText: { color: C.teal, fontSize: 14, fontWeight: '700' },

  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: C.edge },
  historyLeft: { flex: 1 },
  historyTest: { fontSize: 14, fontWeight: '600', color: C.ink, textTransform: 'capitalize' },
  historyStat: { fontSize: 12, color: C.sub, marginTop: 2 },
  histSigDot: { width: 10, height: 10, borderRadius: 5, marginLeft: 10 },
  histSigDotYes: { backgroundColor: C.teal },
  histSigDotNo: { backgroundColor: '#ccc' },
});
