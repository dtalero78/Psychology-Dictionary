import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, unwrap } from '../../../../src/api/client';
import type { AnalysisResult } from '../../../../src/types';
import { Card, LabelCaps, Muted, Pill, Screen } from '../../../../components/ui';

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
    api
      .get(`/analysis/${id}`)
      .then((res) => setResult(unwrap<AnalysisResult>(res)))
      .catch((e) => Alert.alert('Error', e?.response?.data?.error ?? e.message))
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
    ]
      .filter(Boolean)
      .join('\n');
    await Share.share({ message: text });
  }

  if (loading) {
    return (
      <Screen>
        <Header onShare={undefined} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6f518e" size="large" />
        </View>
      </Screen>
    );
  }

  if (!result) return null;

  const sig = result.p_value < 0.05;
  const label = TEST_LABELS[result.test_type] ?? result.test_type.replace(/_/g, ' ');
  const date = (result as any).created_at
    ? new Date((result as any).created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  const extraStats = Object.entries(result.result_json).filter(
    ([k]) => !['statistic', 'p_value', 'effect_size', 'effect_label', 'ci_95', 'interpretation_apa'].includes(k)
  );

  return (
    <Screen>
      <Header onShare={shareResult} />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
        <View className="flex-row items-start">
          <View className="flex-1 mr-3">
            <Text className="font-serif text-headline-lg text-ink">{label}</Text>
            {date && <Muted className="text-label-sm mt-1">{date}</Muted>}
          </View>
          <Pill color={sig ? 'teal' : 'gray'}>{sig ? 'p < .05 ✓' : 'p ≥ .05'}</Pill>
        </View>

        <View>
          <LabelCaps className="mb-2">Statistics</LabelCaps>
          <View className="flex-row flex-wrap gap-px bg-outline-soft rounded overflow-hidden">
            <StatCell label="Statistic" value={result.statistic.toFixed(4)} />
            <StatCell
              label="p-value"
              value={result.p_value < 0.001 ? '< .001' : result.p_value.toFixed(4)}
              highlight={sig}
            />
            {result.effect_size != null && <StatCell label="Effect Size" value={result.effect_size.toFixed(4)} />}
            {result.effect_label && <StatCell label="Effect Label" value={result.effect_label} />}
            {result.ci_95 && <StatCell label="95% CI (lower)" value={result.ci_95[0].toFixed(4)} />}
            {result.ci_95 && <StatCell label="95% CI (upper)" value={result.ci_95[1].toFixed(4)} />}
            {extraStats.map(([k, v]) =>
              typeof v === 'number' ? <StatCell key={k} label={k.replace(/_/g, ' ')} value={(v as number).toFixed(4)} /> : null
            )}
          </View>
        </View>

        <View>
          <LabelCaps className="mb-2">APA Interpretation</LabelCaps>
          <Card className="border-l-4 border-l-purple">
            <Text className="font-serif text-body-lg italic text-ink leading-7">{result.interpretation_apa}</Text>
          </Card>
        </View>

        <View className={`rounded p-3.5 ${sig ? 'bg-teal/10' : 'bg-surface-high'}`}>
          <Text className="font-sans text-label-sm text-ink leading-5">
            {sig
              ? 'This result is statistically significant at p < .05. The null hypothesis can be rejected.'
              : 'This result is not statistically significant (p ≥ .05). There is insufficient evidence to reject the null hypothesis.'}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Header({ onShare }: { onShare?: () => void }) {
  return (
    <View className="bg-surface-lowest border-b border-outline-soft px-4 py-3 flex-row items-center">
      <Pressable onPress={() => router.back()} className="w-16">
        <Text className="font-sans-medium text-body-md text-navy">‹ Back</Text>
      </Pressable>
      <Text className="flex-1 text-center font-serif text-headline-md text-ink">Analysis Result</Text>
      <View className="w-16 items-end">
        {onShare && (
          <Pressable onPress={onShare}>
            <Text className="font-sans-semibold text-label-sm text-navy">Share</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function StatCell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View className="flex-1 min-w-[45%] bg-surface-lowest p-3.5">
      <Text className="font-sans-semibold text-label-caps text-ink-muted uppercase mb-1.5">{label}</Text>
      <Text className={`font-mono text-headline-md ${highlight ? 'text-purple' : 'text-ink'}`}>{value}</Text>
    </View>
  );
}
