import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, unwrap } from '../../../src/api/client';
import type { Project, StepResult } from '../../../src/types';
import { TutorCard, Body, Button, H2, LabelCaps, Muted, Pill, Screen, StepProgress } from '../../../components/ui';

const STEPS = [
  { num: 1, section: 'Topic Discovery', title: 'Find your research topic', placeholder: 'Enter a keyword or topic (e.g., "social media anxiety")' },
  { num: 2, section: 'Research Question', title: 'Formulate your research question', placeholder: 'Describe your topic or paste the tutor suggestion from Step 1' },
  { num: 3, section: 'Hypothesis', title: 'State your hypothesis', placeholder: 'Paste your research question or describe what you expect to find' },
  { num: 4, section: 'Variables', title: 'Define your variables', placeholder: 'Describe your hypothesis and the constructs you want to measure' },
  { num: 5, section: 'Methodology', title: 'Choose your research design', placeholder: 'Describe your variables and any design constraints (time, participants available)' },
  { num: 6, section: 'Instrument', title: 'Select your measurement instrument', placeholder: 'Describe the variable you need to measure. Mention any preferred scales.' },
  { num: 7, section: 'Analysis Plan', title: 'Plan your statistical analysis', placeholder: 'Describe your variables and expected data type (scores, groups, etc.)' },
  { num: 8, section: 'Limitations', title: 'Acknowledge study limitations', placeholder: 'Paste a summary of your full study design for a limitations review' },
] as const;

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');

  useEffect(() => {
    fetchProject();
  }, [id]);

  async function fetchProject() {
    try {
      const res = await api.get(`/projects/${id}`);
      const p = unwrap<Project>(res);
      setProject(p);
      setActiveStep(p.current_step);
      const existing = p.steps_json[String(p.current_step)];
      if (existing) {
        setAiResponse(existing.ai_response);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  async function runStep() {
    if (!input.trim()) {
      Alert.alert('Input required', 'Please enter some text before running this step.');
      return;
    }
    setLoading(true);
    setAiResponse('');
    try {
      const res = await api.put(`/projects/${id}/steps/${activeStep}`, { data: { user_input: input } });
      const result = unwrap<StepResult>(res);
      setAiResponse(result.ai_response);
      await fetchProject();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  }

  function goToStep(step: number) {
    setActiveStep(step);
    setInput('');
    setAiResponse(project?.steps_json[String(step)]?.ai_response ?? '');
  }

  const stepInfo = STEPS.find((s) => s.num === activeStep)!;
  const isFinalStep = activeStep === 8;
  const previousStepData = activeStep > 1 ? project?.steps_json[String(activeStep - 1)] : null;
  const previousStepInfo = activeStep > 1 ? STEPS[activeStep - 2] : null;
  const nextStepLabel = activeStep < 8 ? STEPS[activeStep].section : 'Generate APA Paper';

  return (
    <Screen>
      <View className="bg-surface-lowest border-b border-outline-soft px-4 pt-3 pb-3 flex-row items-center">
        <Pressable onPress={() => router.back()} className="w-16">
          <Text className="font-sans-medium text-body-md text-navy">‹ Back</Text>
        </Pressable>
        <Text className="flex-1 text-center font-serif text-headline-md text-ink" numberOfLines={1}>
          {project?.title ?? '…'}
        </Text>
        <View className="flex-row gap-3 items-center w-16 justify-end">
          <Pressable onPress={() => router.push(`/(app)/analysis/${id}`)}>
            <Text className="font-sans-semibold text-label-sm text-navy">Stats</Text>
          </Pressable>
          <Pressable onPress={() => router.push(`/(app)/document/${id}`)}>
            <Text className="font-sans-semibold text-label-sm text-navy">Report</Text>
          </Pressable>
        </View>
      </View>

      <View className="px-4 py-3 bg-surface-lowest border-b border-outline-soft gap-2">
        <View className="flex-row items-center justify-between">
          <LabelCaps className="text-navy">Step {activeStep} of 8</LabelCaps>
          <Text className="font-serif text-headline-md text-navy">{stepInfo.section}</Text>
        </View>
        <StepProgress current={activeStep} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
        <View>
          <H2>{stepInfo.title}</H2>
          <Muted className="mt-1">Your tutor will help you refine this step.</Muted>
        </View>

        {previousStepData && previousStepInfo && (
          <View className="bg-surface-low rounded p-4 border border-outline-soft">
            <LabelCaps className="text-navy mb-2">
              From Step {previousStepInfo.num}: {previousStepInfo.section}
            </LabelCaps>
            <Text className="font-serif text-body-lg italic text-ink" numberOfLines={4}>
              {previousStepData.ai_response}
            </Text>
          </View>
        )}

        <View className="gap-2">
          <LabelCaps>Your input</LabelCaps>
          <TextInput
            className="bg-surface-lowest border border-outline-soft rounded p-4 font-sans text-body-md text-ink min-h-32"
            placeholder={stepInfo.placeholder}
            placeholderTextColor="#75777e"
            value={input}
            onChangeText={setInput}
            multiline
            textAlignVertical="top"
          />
        </View>

        <Button onPress={runStep} loading={loading} variant="primary">
          ✦ Generate
        </Button>

        {!!aiResponse && (
          <TutorCard label="TUTOR">
            <Text className="font-sans text-body-lg text-ink leading-7">{aiResponse}</Text>
            <View className="flex-row gap-2 mt-4 flex-wrap">
              <Pill color="purple">PICO ✓</Pill>
              <Pill color="purple">Measurable ✓</Pill>
            </View>
          </TutorCard>
        )}

        {!!aiResponse && activeStep < 8 && (
          <Button onPress={() => goToStep(activeStep + 1)} variant="primary">
            Next Step: {nextStepLabel} →
          </Button>
        )}

        {!!aiResponse && isFinalStep && (
          <Button onPress={() => router.push(`/(app)/document/${id}`)} variant="success">
            🎓 Generate APA Paper →
          </Button>
        )}

        {activeStep > 1 && (
          <Pressable onPress={() => goToStep(activeStep - 1)} className="items-center py-2">
            <Text className="font-sans text-label-sm text-ink-muted">Back to Step {activeStep - 1}</Text>
          </Pressable>
        )}
      </ScrollView>

      {loading && (
        <View className="absolute inset-0 bg-ink/10 items-center justify-center">
          <View className="bg-surface-lowest rounded-lg p-6 items-center gap-3">
            <ActivityIndicator color="#6f518e" size="large" />
            <Body className="text-purple font-sans-semibold">Thinking…</Body>
          </View>
        </View>
      )}
    </Screen>
  );
}
