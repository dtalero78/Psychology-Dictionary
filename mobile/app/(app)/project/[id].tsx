import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, unwrap } from '../../../src/api/client';
import type { Project, StepResult } from '../../../src/types';
import { TutorCard, Body, Button, H2, LabelCaps, Muted, Pill, Screen, StepProgress } from '../../../components/ui';

function stripMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/(?<![*\w])\*([^*\n]+)\*(?!\w)/g, '$1')
    .replace(/(?<![_\w])_([^_\n]+)_(?!\w)/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, (m) => m.trim() + ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parses numbered options (1. ..., 2. ...) from a markdown-stripped tutor response.
 * Returns the option texts if 2-5 are detected; otherwise empty (treated as free-form).
 */
function parseOptions(text: string): string[] {
  if (!text) return [];
  const stripped = stripMarkdown(text);
  // Match each "1. ..." block up to the next "N. " or end of string.
  const re = /^\s*\d+\.\s+(.+?)(?=^\s*\d+\.\s|\Z)/gms;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const piece = m[1].trim().replace(/\s+/g, ' ');
    if (piece.length > 8) out.push(piece);
  }
  return out.length >= 2 && out.length <= 5 ? out : [];
}

const STEPS = [
  {
    num: 1,
    section: 'Topic Discovery',
    title: 'Find your research topic',
    instruction: 'Type a keyword (anxiety, sleep, memory, etc.). The tutor will suggest research-ready topics you can pick from.',
    placeholder: 'e.g. social media anxiety',
  },
  {
    num: 2,
    section: 'Research Question',
    title: 'Formulate your research question',
    instruction: 'Pick a topic the tutor suggested in Step 1, or describe one yourself. The tutor will rewrite it as a clear research question.',
    placeholder: 'e.g. Pick option 2 / "How does TikTok use relate to anxiety in teens?"',
  },
  {
    num: 3,
    section: 'Hypothesis',
    title: 'State your hypothesis',
    instruction: 'Describe what you expect to find. The tutor will sharpen it into a testable hypothesis with direction and operational terms.',
    placeholder: 'e.g. I think more screen time leads to higher anxiety scores',
  },
  {
    num: 4,
    section: 'Variables',
    title: 'Define your variables',
    instruction: 'Tell the tutor what you want to measure. It will identify your independent, dependent, and control variables.',
    placeholder: 'e.g. screen time hours, GAD-7 anxiety scores, age, gender',
  },
  {
    num: 5,
    section: 'Methodology',
    title: 'Choose your research design',
    instruction: 'Describe your constraints (time, participants available, budget). The tutor will suggest the best experimental, correlational, or quasi-experimental design.',
    placeholder: 'e.g. 60 undergrad participants, 2 weeks, no lab equipment',
  },
  {
    num: 6,
    section: 'Instrument',
    title: 'Select your measurement instrument',
    instruction: 'Describe what you need to measure. The tutor will pick a validated scale (GAD-7, PHQ-9, BFI, etc.) from its bank of 50+.',
    placeholder: 'e.g. I need to measure anxiety in young adults',
  },
  {
    num: 7,
    section: 'Analysis Plan',
    title: 'Plan your statistical analysis',
    instruction: 'Describe your variables, groups, and data type. The tutor will recommend the appropriate statistical test and effect size.',
    placeholder: 'e.g. Comparing 2 groups, continuous DV, normal distribution',
  },
  {
    num: 8,
    section: 'Limitations',
    title: 'Acknowledge study limitations',
    instruction: 'Paste a summary of your full study design. The tutor will spot threats to internal and external validity you should address in your discussion.',
    placeholder: 'e.g. Summary of method, sample, instruments, and analysis from prior steps',
  },
] as const;

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  // In-session selections per step (Step N → chosen option text).
  // Persisted on Next-step tap via PUT (extends step_data with `selected_text`).
  const [selections, setSelections] = useState<Record<number, string>>({});

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
        setAiResponse(stripMarkdown(existing.ai_response));
      }
      // Rehydrate selections from any persisted user_input.selected_text fields.
      const rehydrated: Record<number, string> = {};
      for (const [stepKey, data] of Object.entries(p.steps_json ?? {})) {
        const sel = (data as any)?.user_input?.selected_text;
        if (typeof sel === 'string' && sel.trim()) {
          rehydrated[Number(stepKey)] = sel;
        }
      }
      if (Object.keys(rehydrated).length > 0) setSelections(rehydrated);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  function selectOption(text: string) {
    setSelections((prev) => ({ ...prev, [activeStep]: text }));
  }

  async function runStep() {
    if (!input.trim()) {
      Alert.alert('Input required', 'Please enter some text before running this step.');
      return;
    }
    setLoading(true);
    setAiResponse('');
    // Re-running this step invalidates any prior selection.
    setSelections((prev) => {
      const next = { ...prev };
      delete next[activeStep];
      return next;
    });
    try {
      const res = await api.put(`/projects/${id}/steps/${activeStep}`, { data: { user_input: input } });
      const result = unwrap<StepResult>(res);
      setAiResponse(stripMarkdown(result.ai_response));
      await fetchProject();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? e.message);
    } finally {
      setLoading(false);
    }
  }

  async function persistSelection(stepNum: number, selected: string) {
    // Save the user's chosen option alongside the existing user_input + ai_response.
    // Sends the full payload so the backend keeps user_input.text intact.
    const existing = project?.steps_json[String(stepNum)];
    const existingInput = (existing as any)?.user_input ?? {};
    const existingText = typeof existingInput === 'string' ? existingInput : existingInput.text ?? '';
    try {
      await api.put(`/projects/${id}/steps/${stepNum}/select`, {
        data: { user_input: { text: existingText, selected_text: selected } },
      });
    } catch {
      // If the dedicated /select endpoint doesn't exist server-side, fall back to a
      // no-op — selection still lives in client state until the user re-runs the step.
    }
  }

  function goToStep(step: number) {
    // Persist current step's selection before navigating away.
    const currentSelection = selections[activeStep];
    if (currentSelection) {
      void persistSelection(activeStep, currentSelection);
    }
    setActiveStep(step);
    setInput('');
    setAiResponse(stripMarkdown(project?.steps_json[String(step)]?.ai_response ?? ''));
  }

  const stepInfo = STEPS.find((s) => s.num === activeStep)!;
  const isFinalStep = activeStep === 8;
  const previousStepData = activeStep > 1 ? project?.steps_json[String(activeStep - 1)] : null;
  const previousStepInfo = activeStep > 1 ? STEPS[activeStep - 2] : null;
  const previousSelection = activeStep > 1 ? selections[activeStep - 1] : undefined;
  const nextStepLabel = activeStep < 8 ? STEPS[activeStep].section : 'Generate APA Paper';

  // Detect selectable options in the tutor response (numbered list with 2-5 items).
  const tutorOptions = parseOptions(aiResponse);
  const isSelectable = tutorOptions.length > 0;
  const currentSelection = selections[activeStep];

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
          <Muted className="mt-2">{stepInfo.instruction}</Muted>
        </View>

        {previousStepData && previousStepInfo && (
          <View className="bg-surface-low rounded p-4 border border-outline-soft">
            <LabelCaps className="text-navy mb-2">
              {previousSelection
                ? `You chose in Step ${previousStepInfo.num}: ${previousStepInfo.section}`
                : `Tutor's response from Step ${previousStepInfo.num}: ${previousStepInfo.section}`}
            </LabelCaps>
            <Text className="font-serif text-body-lg italic text-ink">
              {previousSelection ?? stripMarkdown(previousStepData.ai_response)}
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

        {!!aiResponse && isSelectable && (
          <TutorCard label="PICK ONE">
            <Text style={{ fontSize: 14, color: '#44474d', marginBottom: 12 }}>
              Tap the option you want to use. You can re-Generate if you don't like any.
            </Text>
            <View style={{ gap: 10 }}>
              {tutorOptions.map((opt, i) => {
                const isSelected = currentSelection === opt;
                return (
                  <Pressable
                    key={i}
                    onPress={() => selectOption(opt)}
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      borderWidth: isSelected ? 2 : 1,
                      borderColor: isSelected ? '#6f518e' : '#c5c6ce',
                      backgroundColor: isSelected ? 'rgba(111,81,142,0.08)' : '#ffffff',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 2,
                          borderColor: isSelected ? '#6f518e' : '#c5c6ce',
                          backgroundColor: isSelected ? '#6f518e' : 'transparent',
                          marginTop: 2,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isSelected && <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>}
                      </View>
                      <Text style={{ flex: 1, fontSize: 15, lineHeight: 22, color: '#191c1d' }}>{opt}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </TutorCard>
        )}

        {!!aiResponse && !isSelectable && (
          <TutorCard label="TUTOR">
            <TextInput
              multiline
              value={aiResponse}
              onChangeText={setAiResponse}
              selectionColor="#6f518e"
              style={{
                fontSize: 17,
                lineHeight: 26,
                color: '#191c1d',
                minHeight: 80,
                textAlignVertical: 'top',
                padding: 0,
              }}
            />
          </TutorCard>
        )}

        {!!aiResponse && activeStep < 8 && (
          <Button
            onPress={() => goToStep(activeStep + 1)}
            variant="primary"
            disabled={isSelectable && !currentSelection}
          >
            {isSelectable && !currentSelection ? 'Pick an option to continue' : `Next Step: ${nextStepLabel} →`}
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
