import { useEffect, useState, useCallback } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Database, ListChecks } from 'lucide-react-native';
import { api, unwrap, aiTimeout } from '../../../src/api/client';
import { useAuth } from '../../../src/context/AuthContext';
import type { AnalysisResult, Survey, SurveyQuestion } from '../../../src/types';
import { Button, Card, LabelCaps, Muted, Pill, Screen } from '../../../components/ui';
import { SheetModal } from '../../../components/SheetModal';
import { AIConsentModal } from '../../../components/AIConsentModal';
import { AIWarningBanner } from '../../../components/AIWarningBanner';

// kind: 'numeric' accepts likert/number questions; 'category' accepts select/text;
// 'multi-numeric' allows multiple numeric questions (regression predictors).
type SlotKind = 'numeric' | 'category' | 'multi-numeric';
type Slot = { key: string; label: string; kind: SlotKind };

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
    slots: [
      { key: 'outcome_q', label: 'Outcome (numeric)', kind: 'numeric' },
      { key: 'grouping_q', label: 'Grouping (2 categories)', kind: 'category' },
    ] as Slot[],
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
    slots: [
      { key: 'pre_q', label: 'Pre question', kind: 'numeric' },
      { key: 'post_q', label: 'Post question', kind: 'numeric' },
    ] as Slot[],
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
    slots: [
      { key: 'outcome_q', label: 'Outcome (numeric)', kind: 'numeric' },
      { key: 'grouping_q', label: 'Grouping (3+ categories)', kind: 'category' },
    ] as Slot[],
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
    slots: [
      { key: 'x_q', label: 'Variable X (numeric)', kind: 'numeric' },
      { key: 'y_q', label: 'Variable Y (numeric)', kind: 'numeric' },
    ] as Slot[],
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
    slots: [
      { key: 'x_q', label: 'Variable X (numeric)', kind: 'numeric' },
      { key: 'y_q', label: 'Variable Y (numeric)', kind: 'numeric' },
    ] as Slot[],
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
    slots: [
      { key: 'y_q', label: 'Outcome Y (numeric)', kind: 'numeric' },
      { key: 'x_qs', label: 'Predictors X (1+ numeric)', kind: 'multi-numeric' },
    ] as Slot[],
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
    slots: [
      { key: 'outcome_q', label: 'Variable A (category)', kind: 'category' },
      { key: 'grouping_q', label: 'Variable B (category)', kind: 'category' },
    ] as Slot[],
  },
] as const;

function parseNums(raw: string): number[] {
  return raw
    .split(/[,\s]+/)
    .map(Number)
    .filter((n) => !isNaN(n) && raw.trim() !== '');
}

type Test = (typeof TESTS)[number];

type Mapping = Record<string, string | string[]>;

export default function AnalysisScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const { hasAiConsent } = useAuth();
  const [consentOpen, setConsentOpen] = useState(false);
  const [mode, setMode] = useState<'manual' | 'survey'>('manual');
  const [selectedTest, setSelectedTest] = useState<Test>(TESTS[0]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [mapping, setMapping] = useState<Mapping>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  // From-survey: list of surveys with response counts.
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(null);
  // Question picker sheet state.
  const [pickerSlot, setPickerSlot] = useState<Slot | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get(`/analysis/by-project/${projectId}`);
      setHistory(unwrap<AnalysisResult[]>(res));
    } catch {
      // non-fatal
    }
  }, [projectId]);

  const fetchSurveys = useCallback(async () => {
    try {
      const res = await api.get(`/surveys/by-project/${projectId}`);
      const list = unwrap<Survey[]>(res);
      setSurveys(list);
      // Fetch response counts in parallel (only first page needed for total).
      const counts: Record<string, number> = {};
      await Promise.all(
        list.map(async (s) => {
          try {
            const r = await api.get(`/surveys/${s.id}/responses?limit=1`);
            counts[s.id] = unwrap<{ total: number }>(r).total;
          } catch {
            counts[s.id] = 0;
          }
        }),
      );
      setResponseCounts(counts);
    } catch {
      // non-fatal
    }
  }, [projectId]);

  useEffect(() => {
    fetchHistory();
    fetchSurveys();
  }, [fetchHistory, fetchSurveys]);

  function selectTest(test: (typeof TESTS)[number]) {
    setSelectedTest(test);
    setFields({});
    setMapping({});
    setResult(null);
  }

  function validate(): string | null {
    for (const field of selectedTest.fields) {
      const nums = parseNums(fields[field.key] ?? '');
      if (nums.length < 2) return `"${field.label}" needs at least 2 numbers.`;
    }
    return null;
  }

  function validateMapping(): string | null {
    if (!selectedSurveyId) return 'Choose a survey first.';
    for (const slot of selectedTest.slots) {
      const v = mapping[slot.key];
      if (slot.kind === 'multi-numeric') {
        if (!Array.isArray(v) || v.length === 0) return `Pick at least one question for "${slot.label}".`;
      } else {
        if (typeof v !== 'string' || !v) return `Pick a question for "${slot.label}".`;
      }
    }
    return null;
  }

  async function runAnalysis() {
    const err = validate();
    if (err) {
      Alert.alert('Data error', err);
      return;
    }
    if (!hasAiConsent) { setConsentOpen(true); return; }
    setRunning(true);
    setResult(null);
    try {
      const data = selectedTest.buildData(fields);
      const res = await api.post('/analysis', { project_id: projectId, test_type: selectedTest.id, data }, aiTimeout(180000));
      const r = unwrap<AnalysisResult>(res);
      setResult(r);
      setHistory((prev) => [r, ...prev]);
    } catch (e: any) {
      if (e?.response?.status === 403 && e?.response?.data?.detail === 'AI_CONSENT_REQUIRED') {
        setConsentOpen(true);
        return;
      }
      Alert.alert('Analysis failed', e?.response?.data?.error ?? e?.response?.data?.detail ?? e.message);
    } finally {
      setRunning(false);
    }
  }

  async function runFromSurvey() {
    const err = validateMapping();
    if (err) {
      Alert.alert('Mapping incomplete', err);
      return;
    }
    if (!hasAiConsent) { setConsentOpen(true); return; }
    setRunning(true);
    setResult(null);
    try {
      const res = await api.post('/analysis/from-survey', {
        project_id: projectId,
        survey_id: selectedSurveyId,
        test_type: selectedTest.id,
        mapping,
      }, aiTimeout(180000));
      const r = unwrap<AnalysisResult>(res);
      setResult(r);
      setHistory((prev) => [r, ...prev]);
    } catch (e: any) {
      if (e?.response?.status === 403 && e?.response?.data?.detail === 'AI_CONSENT_REQUIRED') {
        setConsentOpen(true);
        return;
      }
      Alert.alert('Analysis failed', e?.response?.data?.error ?? e?.response?.data?.detail ?? e.message);
    } finally {
      setRunning(false);
    }
  }

  function selectSurvey(id: string) {
    setSelectedSurveyId(id);
    setMapping({});
    setResult(null);
  }

  function assignQuestion(slot: Slot, qKey: string) {
    setMapping((prev) => {
      const next = { ...prev };
      if (slot.kind === 'multi-numeric') {
        const current = (next[slot.key] as string[]) ?? [];
        // Toggle: if already present, remove; otherwise append.
        next[slot.key] = current.includes(qKey) ? current.filter((k) => k !== qKey) : [...current, qKey];
      } else {
        next[slot.key] = qKey;
      }
      return next;
    });
  }

  const currentSurvey = surveys.find((s) => s.id === selectedSurveyId) ?? null;
  const questions: SurveyQuestion[] = currentSurvey?.config_json?.questions ?? [];

  function questionLabel(qKey: string): string {
    const idx = Number(qKey.replace('q_', ''));
    const q = questions[idx];
    if (!q) return qKey;
    const short = q.text.length > 60 ? q.text.slice(0, 57) + '…' : q.text;
    return `Q${idx + 1}: ${short}`;
  }

  function isNumericQ(q: SurveyQuestion): boolean {
    return q.type === 'likert' || q.type === 'number';
  }

  function isCategoryQ(q: SurveyQuestion): boolean {
    return q.type === 'select' || q.type === 'text';
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
        {/* Data source toggle */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: '#eef0f3',
            borderRadius: 10,
            padding: 3,
            gap: 3,
          }}
        >
          <Pressable
            onPress={() => setMode('manual')}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: mode === 'manual' ? '#ffffff' : 'transparent',
            }}
          >
            <ListChecks size={15} color={mode === 'manual' ? '#1a2b48' : '#75777e'} strokeWidth={2} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: mode === 'manual' ? '#1a2b48' : '#75777e' }}>
              Enter data
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('survey')}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              backgroundColor: mode === 'survey' ? '#ffffff' : 'transparent',
            }}
          >
            <Database size={15} color={mode === 'survey' ? '#1a2b48' : '#75777e'} strokeWidth={2} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: mode === 'survey' ? '#1a2b48' : '#75777e' }}>
              From survey
            </Text>
          </Pressable>
        </View>

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

        {mode === 'manual' ? (
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
        ) : (
          <View style={{ gap: 16 }}>
            {/* Survey picker */}
            <View>
              <LabelCaps className="mb-2">Survey</LabelCaps>
              {surveys.length === 0 ? (
                <Card>
                  <Muted>No surveys in this project yet. Create one from the project page.</Muted>
                </Card>
              ) : (
                <View style={{ gap: 8 }}>
                  {surveys.map((s) => {
                    const active = s.id === selectedSurveyId;
                    const n = responseCounts[s.id] ?? 0;
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => selectSurvey(s.id)}
                        style={{
                          backgroundColor: active ? 'rgba(26,43,72,0.06)' : '#ffffff',
                          borderWidth: 1,
                          borderColor: active ? '#1a2b48' : '#e1e2e8',
                          borderRadius: 10,
                          padding: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: '#191c1d' }} numberOfLines={1}>{s.title}</Text>
                          <Text style={{ fontSize: 12, color: '#75777e', marginTop: 2 }}>
                            {n} response{n === 1 ? '' : 's'} · {s.config_json?.questions?.length ?? 0} questions
                          </Text>
                        </View>
                        {active && <Pill color="purple">Selected</Pill>}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Slot mapping */}
            {selectedSurveyId && (
              <View>
                <LabelCaps className="mb-2">Map Questions</LabelCaps>
                <Muted className="mb-3 text-label-sm">
                  Pick which survey question feeds each role. Numeric slots accept Likert/number questions; category slots accept select/text questions.
                </Muted>
                <View style={{ gap: 8 }}>
                  {selectedTest.slots.map((slot) => {
                    const value = mapping[slot.key];
                    const empty = slot.kind === 'multi-numeric'
                      ? !Array.isArray(value) || value.length === 0
                      : !value;
                    const display = slot.kind === 'multi-numeric'
                      ? (Array.isArray(value) && value.length > 0
                          ? `${value.length} question${value.length === 1 ? '' : 's'} selected`
                          : 'Tap to pick predictors')
                      : (typeof value === 'string' && value ? questionLabel(value) : 'Tap to pick a question');
                    return (
                      <Pressable
                        key={slot.key}
                        onPress={() => setPickerSlot(slot)}
                        style={{
                          backgroundColor: '#ffffff',
                          borderWidth: 1,
                          borderColor: empty ? '#e1e2e8' : '#6f518e',
                          borderRadius: 10,
                          padding: 12,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#75777e', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                          {slot.label}
                        </Text>
                        <Text style={{ fontSize: 14, color: empty ? '#75777e' : '#191c1d', marginTop: 4, fontStyle: empty ? 'italic' : 'normal' }} numberOfLines={2}>
                          {display}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        <Button
          onPress={mode === 'manual' ? runAnalysis : runFromSurvey}
          loading={running}
          variant="primary"
        >
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
            <AIWarningBanner text="AI-generated interpretation. Verify before citing or publishing." />
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

      {/* Question picker sheet */}
      <SheetModal
        open={pickerSlot !== null}
        onClose={() => setPickerSlot(null)}
        title={pickerSlot ? `Pick: ${pickerSlot.label}` : ''}
        subtitle={
          pickerSlot?.kind === 'category'
            ? 'Showing select/text questions. Tap one to use it as the grouping variable.'
            : pickerSlot?.kind === 'multi-numeric'
            ? 'Tap to toggle. Pick one or more numeric questions as predictors.'
            : 'Showing numeric (Likert/number) questions.'
        }
        helpText={
          pickerSlot?.kind === 'category'
            ? 'Category questions split respondents into groups (e.g. condition, gender, age band).'
            : 'Numeric questions provide the scores the test will analyze. Likert items are treated as 1–N integers.'
        }
        footer={
          <Pressable onPress={() => setPickerSlot(null)} style={{ paddingVertical: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#1a2b48' }}>Done</Text>
          </Pressable>
        }
      >
        <View style={{ gap: 8 }}>
          {(() => {
            if (!pickerSlot) return null;
            const filter = pickerSlot.kind === 'category' ? isCategoryQ : isNumericQ;
            const items = questions
              .map((q, i) => ({ q, i, key: `q_${i}` }))
              .filter(({ q }) => filter(q));
            if (items.length === 0) {
              return <Muted>No matching questions in this survey.</Muted>;
            }
            const current = mapping[pickerSlot.key];
            return items.map(({ q, i, key }) => {
              const selected = pickerSlot.kind === 'multi-numeric'
                ? Array.isArray(current) && current.includes(key)
                : current === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    assignQuestion(pickerSlot, key);
                    if (pickerSlot.kind !== 'multi-numeric') setPickerSlot(null);
                  }}
                  style={{
                    backgroundColor: selected ? 'rgba(111,81,142,0.10)' : '#ffffff',
                    borderWidth: 1,
                    borderColor: selected ? '#6f518e' : '#e1e2e8',
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#6f518e', letterSpacing: 0.8 }}>Q{i + 1}</Text>
                    <Pill color={q.type === 'likert' || q.type === 'number' ? 'teal' : 'gray'}>{q.type}</Pill>
                    {selected && <Pill color="purple">✓</Pill>}
                  </View>
                  <Text style={{ fontSize: 14, color: '#191c1d', marginTop: 6 }} numberOfLines={3}>{q.text}</Text>
                </Pressable>
              );
            });
          })()}
        </View>
      </SheetModal>

      <AIConsentModal open={consentOpen} onClose={() => setConsentOpen(false)} />
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
