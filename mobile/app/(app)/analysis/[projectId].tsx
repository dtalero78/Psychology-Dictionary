import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, unwrap } from '../../../src/api/client';
import type { AnalysisResult } from '../../../src/types';
import { Body, Button, Card, H2, LabelCaps, Muted, Pill, Screen } from '../../../components/ui';

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
      groups: [parseNums(f.g1), parseNums(f.g2), parseNums(f.g3)].filter((g) => g.length > 0),
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
      X: parseNums(f.x).map((v) => [v]),
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
  return raw
    .split(/[,\s]+/)
    .map(Number)
    .filter((n) => !isNaN(n) && raw.trim() !== '');
}

type Test = (typeof TESTS)[number];

export default function AnalysisScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [selectedTest, setSelectedTest] = useState<Test>(TESTS[0]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get(`/analysis/by-project/${projectId}`);
      setHistory(unwrap<AnalysisResult[]>(res));
    } catch {
      // non-fatal
    }
  }, [projectId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  function selectTest(test: (typeof TESTS)[number]) {
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
    if (err) {
      Alert.alert('Data error', err);
      return;
    }
    setRunning(true);
    setResult(null);
    try {
      const data = selectedTest.buildData(fields);
      const res = await api.post('/analysis', { project_id: projectId, test_type: selectedTest.id, data });
      const r = unwrap<AnalysisResult>(res);
      setResult(r);
      setHistory((prev) => [r, ...prev]);
    } catch (e: any) {
      Alert.alert('Analysis failed', e?.response?.data?.error ?? e?.response?.data?.detail ?? e.message);
    } finally {
      setRunning(false);
    }
  }

  const sig = result ? result.p_value < 0.05 : false;

  return (
    <Screen>
      <View className="bg-surface-lowest border-b border-outline-soft px-4 py-3 flex-row items-center">
        <Pressable onPress={() => router.back()} className="w-16">
          <Text className="font-sans-medium text-body-md text-navy">‹ Back</Text>
        </Pressable>
        <Text className="flex-1 text-center font-serif text-headline-md text-ink">Statistical Analysis</Text>
        <View className="w-16" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View>
          <LabelCaps className="mb-2">Test Type</LabelCaps>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {TESTS.map((t) => {
              const active = selectedTest.id === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => selectTest(t)}
                  className={`px-3.5 py-2 rounded-full border ${active ? 'bg-navy border-navy' : 'bg-surface-lowest border-outline-soft'}`}
                >
                  <Text className={`font-sans-semibold text-label-sm ${active ? 'text-white' : 'text-ink-muted'}`}>{t.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Muted className="italic mt-3">{selectedTest.desc}</Muted>
        </View>

        <View>
          <LabelCaps className="mb-1">Data Input</LabelCaps>
          <Muted className="mb-3 text-label-sm">Enter numbers separated by commas. Each cell = one participant's score.</Muted>

          <View className="gap-3">
            {selectedTest.fields.map((f) => (
              <View key={f.key}>
                <Text className="font-sans-medium text-body-md text-ink mb-1.5">{f.label}</Text>
                <TextInput
                  className="bg-surface-lowest border border-outline-soft rounded p-3 font-mono text-body-md text-ink"
                  placeholder={f.hint}
                  placeholderTextColor="#75777e"
                  value={fields[f.key] ?? ''}
                  onChangeText={(v) => setFields((prev) => ({ ...prev, [f.key]: v }))}
                  keyboardType="numbers-and-punctuation"
                  autoCorrect={false}
                />
                {(fields[f.key] ?? '').length > 0 && (
                  <Text className="font-sans-semibold text-label-caps text-purple mt-1 text-right">
                    {parseNums(fields[f.key]).length} values
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>

        <Button onPress={runAnalysis} loading={running} variant="primary">
          ✦ Run Analysis
        </Button>

        {result && (
          <Card>
            <View className="flex-row justify-between items-center mb-3">
              <Text className="font-serif text-headline-md text-ink flex-1">{selectedTest.label}</Text>
              <Pill color={sig ? 'teal' : 'gray'}>{sig ? 'p < .05 ✓' : 'p ≥ .05'}</Pill>
            </View>

            <View className="flex-row flex-wrap gap-px bg-outline-soft rounded overflow-hidden mb-4">
              <StatCell label="Statistic" value={result.statistic.toFixed(3)} />
              <StatCell label="p-value" value={result.p_value < 0.001 ? '< .001' : result.p_value.toFixed(3)} />
              {result.effect_size != null && (
                <StatCell label="Effect size" value={`${result.effect_size.toFixed(3)} (${result.effect_label})`} />
              )}
              {result.ci_95 && <StatCell label="95% CI" value={`[${result.ci_95[0].toFixed(3)}, ${result.ci_95[1].toFixed(3)}]`} />}
            </View>

            <LabelCaps className="mb-2">APA Interpretation</LabelCaps>
            <Text className="font-serif text-body-lg italic text-ink leading-7">{result.interpretation_apa}</Text>

            <Pressable onPress={() => router.push(`/(app)/analysis/result/${result.id}`)} className="self-end mt-3">
              <Text className="font-sans-semibold text-label-sm text-navy">View full result →</Text>
            </Pressable>
          </Card>
        )}

        {history.length > 0 && (
          <View className="gap-2">
            <LabelCaps className="mt-3">Previous Analyses</LabelCaps>
            {history.map((h) => (
              <Pressable key={h.id} onPress={() => router.push(`/(app)/analysis/result/${h.id}`)}>
                <Card className="flex-row items-center">
                  <View className="flex-1">
                    <Text className="font-sans-medium text-body-md text-ink capitalize">{h.test_type.replace(/_/g, ' ')}</Text>
                    <Muted className="text-label-sm mt-0.5">
                      p = {h.p_value < 0.001 ? '< .001' : h.p_value.toFixed(3)}
                      {h.effect_label ? ` · ${h.effect_label} effect` : ''}
                    </Muted>
                  </View>
                  <View className={`w-2.5 h-2.5 rounded-full ml-2.5 ${h.p_value < 0.05 ? 'bg-teal' : 'bg-outline-soft'}`} />
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 min-w-[45%] bg-surface-lowest p-3">
      <Text className="font-sans-semibold text-label-caps text-ink-muted uppercase mb-1">{label}</Text>
      <Text className="font-mono text-headline-md text-ink">{value}</Text>
    </View>
  );
}
