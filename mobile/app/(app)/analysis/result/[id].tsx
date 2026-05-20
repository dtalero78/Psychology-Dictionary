import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator, Share, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, unwrap } from '../../../../src/api/client';
import type { AnalysisResult } from '../../../../src/types';

const TEST_LABELS: Record<string, string> = {
  independent_ttest: 'Independent Samples t-test',
  paired_ttest: 'Paired Samples t-test',
  one_way_anova: 'One-Way ANOVA',
  pearson: 'Pearson Correlation',
  spearman: 'Spearman Correlation',
  multiple_regression: 'Linear Regression',
  chi_square: 'Chi-Square Test',
};

export default function AnalysisResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/analysis/${id}`)
      .then(res => setResult(unwrap<AnalysisResult>(res)))
      .catch(e => Alert.alert('Error', e?.response?.data?.error ?? e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function shareResult() {
    if (!result) return;
    const sig = result.p_value < 0.05;
    const label = TEST_LABELS[result.test_type] ?? result.test_type;
    const text = [
      `${label}`,
      `Statistic: ${result.statistic.toFixed(3)}`,
      `p-value: ${result.p_value < 0.001 ? '< .001' : result.p_value.toFixed(3)}`,
      result.effect_size != null ? `Effect size: ${result.effect_size.toFixed(3)} (${result.effect_label})` : null,
      result.ci_95 ? `95% CI: [${result.ci_95[0].toFixed(3)}, ${result.ci_95[1].toFixed(3)}]` : null,
      '',
      result.interpretation_apa,
      '',
      sig ? 'Result is statistically significant (p < .05)' : 'Result is not statistically significant',
    ].filter(Boolean).join('\n');
    await Share.share({ message: text });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Result</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={C.teal} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!result) return null;

  const sig = result.p_value < 0.05;
  const label = TEST_LABELS[result.test_type] ?? result.test_type.replace(/_/g, ' ');
  const date = result.created_at ? new Date(result.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;

  const extraStats = Object.entries(result.result_json).filter(
    ([k]) => !['statistic', 'p_value', 'effect_size', 'effect_label', 'ci_95', 'interpretation_apa'].includes(k)
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analysis Result</Text>
        <TouchableOpacity onPress={shareResult} style={styles.shareBtn}>
          <Text style={styles.shareText}>Share</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <Text style={styles.testLabel}>{label}</Text>
            {date && <Text style={styles.dateText}>{date}</Text>}
          </View>
          <View style={[styles.sigBadge, sig ? styles.sigBadgeYes : styles.sigBadgeNo]}>
            <Text style={[styles.sigText, sig ? styles.sigTextYes : styles.sigTextNo]}>
              {sig ? 'p < .05 ✓' : 'p ≥ .05'}
            </Text>
          </View>
        </View>

        {/* Stats grid */}
        <Text style={styles.sectionLabel}>Statistics</Text>
        <View style={styles.statsGrid}>
          <StatCell label="Statistic" value={result.statistic.toFixed(4)} />
          <StatCell
            label="p-value"
            value={result.p_value < 0.001 ? '< .001' : result.p_value.toFixed(4)}
            highlight={sig}
          />
          {result.effect_size != null && (
            <StatCell label="Effect Size" value={result.effect_size.toFixed(4)} />
          )}
          {result.effect_label && (
            <StatCell label="Effect Label" value={result.effect_label} />
          )}
          {result.ci_95 && (
            <StatCell
              label="95% CI (lower)"
              value={result.ci_95[0].toFixed(4)}
            />
          )}
          {result.ci_95 && (
            <StatCell
              label="95% CI (upper)"
              value={result.ci_95[1].toFixed(4)}
            />
          )}
          {extraStats.map(([k, v]) => (
            typeof v === 'number' ? (
              <StatCell key={k} label={k.replace(/_/g, ' ')} value={(v as number).toFixed(4)} />
            ) : null
          ))}
        </View>

        {/* APA Interpretation */}
        <Text style={styles.sectionLabel}>APA Interpretation</Text>
        <View style={styles.apaCard}>
          <Text style={styles.apaText}>{result.interpretation_apa}</Text>
        </View>

        {/* Significance note */}
        <View style={[styles.sigNote, sig ? styles.sigNoteYes : styles.sigNoteNo]}>
          <Text style={styles.sigNoteText}>
            {sig
              ? 'This result is statistically significant at p < .05. The null hypothesis can be rejected.'
              : 'This result is not statistically significant (p ≥ .05). There is insufficient evidence to reject the null hypothesis.'
            }
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statCellLabel}>{label}</Text>
      <Text style={[styles.statCellValue, highlight && styles.statCellValueHighlight]}>{value}</Text>
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
  shareBtn: { width: 60, alignItems: 'flex-end' },
  shareText: { color: C.teal, fontSize: 14, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16 },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 },
  titleLeft: { flex: 1, marginRight: 12 },
  testLabel: { fontSize: 20, fontWeight: '700', color: C.dark, marginBottom: 4 },
  dateText: { fontSize: 13, color: C.sub },
  sigBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1.5, alignSelf: 'flex-start' },
  sigBadgeYes: { backgroundColor: '#e8f8f5', borderColor: C.teal },
  sigBadgeNo: { backgroundColor: '#f5f5f5', borderColor: '#ccc' },
  sigText: { fontSize: 12, fontWeight: '700' },
  sigTextYes: { color: C.dark },
  sigTextNo: { color: '#888' },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1, backgroundColor: C.edge, borderRadius: 14, overflow: 'hidden', marginBottom: 24 },
  statCell: { flex: 1, minWidth: '45%', backgroundColor: C.card, padding: 14 },
  statCellLabel: { fontSize: 10, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  statCellValue: { fontSize: 18, fontWeight: '700', color: C.dark, fontFamily: 'monospace' },
  statCellValueHighlight: { color: C.teal },

  apaCard: { backgroundColor: C.card, borderRadius: 14, padding: 18, borderLeftWidth: 3, borderLeftColor: C.teal, marginBottom: 16 },
  apaText: { fontSize: 15, color: C.ink, lineHeight: 26, fontStyle: 'italic' },

  sigNote: { borderRadius: 12, padding: 14 },
  sigNoteYes: { backgroundColor: C.tint },
  sigNoteNo: { backgroundColor: '#f0f0f0' },
  sigNoteText: { fontSize: 13, color: C.ink, lineHeight: 20 },
});
