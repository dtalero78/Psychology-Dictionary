import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  HelpCircle,
  Microscope,
  Pencil,
  Sparkles,
} from 'lucide-react-native';
import { api, aiTimeout, unwrap } from '../../../src/api/client';
import { useAuth } from '../../../src/context/AuthContext';
import type { Project, StepResult } from '../../../src/types';
import { TutorCard, Body, Button, H1, H2, LabelCaps, Muted, Pill, Screen, StepProgress } from '../../../components/ui';
import { SheetModal } from '../../../components/SheetModal';
import { AIConsentModal } from '../../../components/AIConsentModal';
import { AIWarningBanner } from '../../../components/AIWarningBanner';

/**
 * Splits a tutor response into a leading "context" (explanation/preamble)
 * and the "content" (the actual material the user can edit), using the first
 * horizontal-rule separator (---, ___, ***) as the boundary.
 * Falls back to {context: '', content: text} when no separator or context is short.
 */
function splitContext(text: string): { context: string; content: string } {
  if (!text) return { context: '', content: '' };
  const hr = text.match(/^[ \t]*(?:-{3,}|_{3,}|\*{3,})[ \t]*$/m);
  if (hr && hr.index !== undefined) {
    const context = text.slice(0, hr.index).trim();
    const content = text.slice(hr.index + hr[0].length).trim();
    if (context.length > 20 && content.length > 20) {
      return { context, content };
    }
  }
  return { context: '', content: text };
}

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
    .replace(/^[ \t]*(?:-{3,}|_{3,}|\*{3,})[ \t]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parses numbered or "Option N" style options from a tutor response.
 * Tries multiple patterns: "1. ...", "Option 1: ...", "1) ...", numbered headings.
 * Strips preamble paragraphs before the first option.
 * Returns option texts if 2-5 are detected; otherwise empty (treated as free-form).
 */
function parseOptions(text: string): string[] {
  if (!text) return [];
  const stripped = stripMarkdown(text);
  const patterns: RegExp[] = [
    // "Option 1: ..." / "Option 1 — ..."
    /^\s*Option\s+(\d+)[:\.\)\s\-—]+\s*(.+?)(?=^\s*Option\s+\d+[:\.\)\s\-—]|\Z)/gims,
    // "1. ..." or "1) ..." at line start
    /^\s*(\d+)[\.\)]\s+(.+?)(?=^\s*\d+[\.\)]\s|\Z)/gms,
  ];
  for (const re of patterns) {
    const out: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(stripped)) !== null) {
      // m[2] is the option text content
      const piece = m[2].trim().replace(/\s+/g, ' ');
      // Trim trailing horizontal rule markers
      const cleaned = piece.replace(/\s*[-—_]{3,}\s*$/, '').trim();
      if (cleaned.length > 8 && cleaned.length < 600) out.push(cleaned);
    }
    if (out.length >= 2 && out.length <= 5) return out;
  }
  return [];
}

const STEPS = [
  {
    num: 1,
    section: 'Topic Discovery',
    title: 'Find your research topic',
    instruction: 'Enter a keyword. The tutor suggests 3 researchable topics.',
    placeholder: 'e.g. social media anxiety',
    highlight: 'topic',
    help: 'This step defines WHAT to study. Enter a broad keyword and the tutor proposes 3 research-ready topics — each scoped for a student project, with measurable variables and existing instruments. Pick the one that matches your interest.',
  },
  {
    num: 2,
    section: 'Research Question',
    title: 'Formulate your research question',
    instruction: 'Describe your topic. The tutor proposes 3 question framings.',
    placeholder: 'e.g. Pick option 2 / "How does TikTok use relate to anxiety in teens?"',
    highlight: 'research question',
    help: 'Translate your topic into a precise, testable empirical question. The tutor offers 3 framings — relationship ("Is X related to Y?"), difference ("Do groups differ on Z?"), and prediction ("Does W predict V?"). Pick the one that fits your study intent.',
  },
  {
    num: 3,
    section: 'Hypothesis',
    title: 'State your hypothesis',
    instruction: 'State what you expect. The tutor returns 3 testable hypotheses.',
    placeholder: 'e.g. I think more screen time leads to higher anxiety scores',
    highlight: 'hypothesis',
    help: 'A hypothesis is a falsifiable prediction. The tutor returns 3 framings: directional (predicts direction), alternative-direction (opposite prediction with theory), and non-directional (predicts an effect without direction). Pick the one with strongest theoretical support.',
  },
  {
    num: 4,
    section: 'Variables',
    title: 'Define your variables',
    instruction: 'List what you want to measure. The tutor returns 3 IV/DV schemes.',
    placeholder: 'e.g. screen time hours, GAD-7 anxiety scores, age, gender',
    highlight: 'variables',
    help: 'Operationalize your study. The tutor proposes 3 schemes — each defines IV (what you manipulate or predict from), DV (what you measure), and covariates. Schemes differ in measurement strategy (self-report vs behavioral vs mixed). Pick what\'s feasible for you.',
  },
  {
    num: 5,
    section: 'Methodology',
    title: 'Choose your research design',
    instruction: 'Describe constraints. The tutor proposes 3 study designs.',
    placeholder: 'e.g. 60 undergrad participants, 2 weeks, no lab equipment',
    highlight: 'research design',
    help: 'Choose how you\'ll collect data. The tutor proposes 3 design families — typically between-subjects experimental, within-subjects (pre/post), and cross-sectional correlational — with sample size estimates and main tradeoffs. Pick what your constraints allow.',
  },
  {
    num: 6,
    section: 'Instrument',
    title: 'Select your measurement instrument',
    instruction: 'Describe what you measure. The tutor picks 3 validated scales.',
    placeholder: 'e.g. I need to measure anxiety in young adults',
    highlight: 'measurement instrument',
    help: 'Pick the actual scale you\'ll use. The tutor suggests 3 instruments — usually 2 validated (GAD-7, PHQ-9, BFI, etc., with published reliability) and 1 custom option. Each includes item count, Cronbach\'s α, and an APA citation.',
  },
  {
    num: 7,
    section: 'Analysis Plan',
    title: 'Plan your statistical analysis',
    instruction: 'Describe your data. The tutor returns 3 statistical approaches.',
    placeholder: 'e.g. Comparing 2 groups, continuous DV, normal distribution',
    highlight: 'statistical analysis',
    help: 'Plan your statistical test BEFORE collecting data. The tutor proposes 3 approaches — usually a parametric option (t-test, ANOVA), a non-parametric alternative, and sometimes a Bayesian variant. Each lists assumptions, effect size, and required data format.',
  },
  {
    num: 8,
    section: 'Limitations',
    title: 'Acknowledge study limitations',
    instruction: 'Summarize your design. The tutor surfaces 3 validity threats.',
    placeholder: 'e.g. Summary of method, sample, instruments, and analysis from prior steps',
    highlight: 'limitations',
    help: 'Acknowledge threats to validity — strong papers do this honestly. The tutor proposes 3 framings: internal validity (selection bias, demand characteristics), external validity (generalizability), and methodological (instrument or design constraints). Pick the area most relevant.',
  },
] as const;

type ViewMode = 'timeline' | 'step';

export default function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [activeStep, setActiveStep] = useState(1);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  // In-session selections per step (Step N → chosen option text).
  // Persisted on Next-step tap via PUT (extends step_data with `selected_text`).
  const [selections, setSelections] = useState<Record<number, string>>({});
  // Bottom-sheet state
  const [tutorSheetOpen, setTutorSheetOpen] = useState(false);
  const [recapSheetStep, setRecapSheetStep] = useState<number | null>(null);
  const [previewSheetStep, setPreviewSheetStep] = useState<number | null>(null);
  // When true, the tutor sheet shows the response as freely editable text
  // even if numbered options are present. Used by "Edit this step" flows.
  const [forceEditMode, setForceEditMode] = useState(false);
  // AI consent modal — shown the first time the user taps Generate without
  // an ai_consent_at on file, or when the backend returns 403 AI_CONSENT_REQUIRED.
  const { hasAiConsent } = useAuth();
  const [consentOpen, setConsentOpen] = useState(false);

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
    // Apple Guideline 5.1.2(i): require explicit consent BEFORE the first
    // call. If no consent on file, surface the modal and let the user opt in;
    // the modal calls runStep again on grant.
    if (!hasAiConsent) {
      setConsentOpen(true);
      return;
    }
    setLoading(true);
    setAiResponse('');
    setForceEditMode(false);
    // Re-running this step invalidates any prior selection.
    setSelections((prev) => {
      const next = { ...prev };
      delete next[activeStep];
      return next;
    });
    try {
      const res = await api.put(`/projects/${id}/steps/${activeStep}`, { data: { user_input: input } }, aiTimeout(120000));
      const result = unwrap<StepResult>(res);
      setAiResponse(stripMarkdown(result.ai_response));
      setTutorSheetOpen(true);
      await fetchProject();
    } catch (e: any) {
      // Race: server says consent missing even though we thought we had it.
      // Re-open the modal so the user can re-grant.
      if (e?.response?.status === 403 && e?.response?.data?.detail === 'AI_CONSENT_REQUIRED') {
        setConsentOpen(true);
        return;
      }
      Alert.alert('Error', e?.response?.data?.error ?? e?.response?.data?.detail ?? e.message);
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
  // forceEditMode (from "Edit this step") bypasses options to show free-text editor.
  const tutorOptions = parseOptions(aiResponse);
  const isSelectable = tutorOptions.length > 0 && !forceEditMode;
  const currentSelection = selections[activeStep];

  function openStep(stepNum: number) {
    setActiveStep(stepNum);
    setInput('');
    setAiResponse(stripMarkdown(project?.steps_json[String(stepNum)]?.ai_response ?? ''));
    setViewMode('step');
  }

  // Opens a step AND immediately jumps to the tutor sheet for editing the response.
  // Forces editable mode so user edits freely instead of re-picking from options.
  function openStepForEdit(stepNum: number) {
    const sel = selections[stepNum];
    const fallback = project?.steps_json[String(stepNum)]?.ai_response;
    setPreviewSheetStep(null);
    setRecapSheetStep(null);
    setActiveStep(stepNum);
    setInput('');
    setAiResponse(sel ?? (fallback ? stripMarkdown(fallback) : ''));
    setForceEditMode(true);
    setViewMode('step');
    setTutorSheetOpen(true);
  }

  if (viewMode === 'timeline') {
    const currentProjectStep = project?.current_step ?? 1;
    return (
      <Screen>
        <View className="bg-surface-lowest border-b border-outline-soft px-4 pt-3 pb-3 flex-row items-center">
          <Pressable onPress={() => router.back()} className="w-20 flex-row items-center">
            <ChevronLeft size={18} color="#1a2b48" strokeWidth={2.4} />
            <Text className="font-sans-medium text-body-md text-navy ml-1">Projects</Text>
          </Pressable>
          <View className="flex-1" />
          <View className="w-20" />
        </View>

        <View className="px-4 py-2 bg-surface-lowest border-b border-outline-soft flex-row gap-5 justify-center">
          <Pressable onPress={() => router.push({ pathname: '/(app)/survey', params: { projectId: id } })} className="py-1 flex-row items-center gap-1.5">
            <ClipboardList size={16} color="#1a2b48" strokeWidth={2} />
            <Text className="font-sans-semibold text-label-sm text-navy">Surveys</Text>
          </Pressable>
          <Pressable onPress={() => router.push(`/(app)/analysis/${id}`)} className="py-1 flex-row items-center gap-1.5">
            <BarChart3 size={16} color="#1a2b48" strokeWidth={2} />
            <Text className="font-sans-semibold text-label-sm text-navy">Stats</Text>
          </Pressable>
          <Pressable onPress={() => router.push(`/(app)/document/${id}`)} className="py-1 flex-row items-center gap-1.5">
            <FileText size={16} color="#1a2b48" strokeWidth={2} />
            <Text className="font-sans-semibold text-label-sm text-navy">Report</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 120 }}>
          <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: 'rgba(111,81,142,0.10)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Microscope size={32} color="#6f518e" strokeWidth={1.8} />
          </View>
          <H1>{project?.title ?? '…'}</H1>
          <Muted className="mt-1">
            Updated {project ? new Date(project.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
          </Muted>

          <View style={{ marginTop: 32 }}>
            {STEPS.map((step, idx) => {
              const isDone = step.num < currentProjectStep;
              const isActive = step.num === currentProjectStep;
              const isLast = idx === STEPS.length - 1;
              const stepData = project?.steps_json[String(step.num)];
              const selection = selections[step.num];
              const preview = selection ?? (stepData ? stripMarkdown(stepData.ai_response).split('\n')[0] : '');
              const canTap = isDone || isActive;

              return (
                <Pressable
                  key={step.num}
                  onPress={() => {
                    if (!canTap) return;
                    if (isDone) {
                      setPreviewSheetStep(step.num);
                    } else {
                      openStep(step.num);
                    }
                  }}
                  disabled={!canTap}
                  style={{ flexDirection: 'row', minHeight: isLast ? 'auto' : 88 }}
                >
                  {/* Left column: icon + connecting line */}
                  <View style={{ width: 32, alignItems: 'center' }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        borderWidth: 2,
                        borderColor: isDone ? '#0d7866' : isActive ? '#6f518e' : '#c5c6ce',
                        backgroundColor: isDone ? '#0d7866' : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isDone && <Check size={16} color="#fff" strokeWidth={3} />}
                      {isActive && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#6f518e' }} />}
                    </View>
                    {!isLast && (
                      <View style={{ flex: 1, width: 2, marginTop: 4, marginBottom: 4, backgroundColor: isDone ? '#0d7866' : '#e7e8e9' }} />
                    )}
                  </View>

                  {/* Right column: content */}
                  <View style={{ flex: 1, marginLeft: 16, paddingBottom: 24, opacity: canTap ? 1 : 0.55 }}>
                    <Text style={{ fontWeight: '600', fontSize: 17, color: isActive ? '#6f518e' : '#191c1d' }}>
                      Step {step.num}: {step.section}
                    </Text>
                    {isDone && preview ? (
                      <Text style={{ fontSize: 14, color: '#44474d', marginTop: 4, lineHeight: 20 }} numberOfLines={2}>
                        {preview}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 14, color: '#44474d', marginTop: 4, lineHeight: 20 }} numberOfLines={2}>
                        {step.instruction}
                      </Text>
                    )}
                    {isActive && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                        <Text style={{ fontSize: 13, color: '#6f518e', fontWeight: '600' }}>Continue</Text>
                        <ChevronRight size={14} color="#6f518e" strokeWidth={2.4} style={{ marginLeft: 2 }} />
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View className="absolute bottom-6 left-5 right-5">
          <Button onPress={() => openStep(currentProjectStep)} variant="primary">
            {currentProjectStep === 1 && !project?.steps_json[String(1)]
              ? 'Start Step 1: Topic Discovery'
              : `Continue Step ${currentProjectStep}: ${STEPS[currentProjectStep - 1].section}`}
          </Button>
        </View>

        {/* Timeline preview sheet (tap a completed step) */}
        {previewSheetStep !== null && (() => {
          const stepNum = previewSheetStep;
          const info = STEPS[stepNum - 1];
          const data = project?.steps_json[String(stepNum)];
          const sel = selections[stepNum];
          const raw = sel ?? (data ? stripMarkdown(data.ai_response) : '');
          const { context, content } = splitContext(raw);
          return (
            <SheetModal
              open={previewSheetStep !== null}
              onClose={() => setPreviewSheetStep(null)}
              title={`Step ${stepNum}: ${info.section}`}
              helpText="Quick view of what's saved for this step. Tap 'Edit this step' to revise the response or pick a different option."
              footer={
                <Button onPress={() => openStepForEdit(stepNum)} variant="primary">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pencil size={16} color="#fff" strokeWidth={2} />
                    <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>Edit this step</Text>
                  </View>
                </Button>
              }
            >
              {context ? (
                <View
                  style={{
                    backgroundColor: 'rgba(111,81,142,0.06)',
                    borderWidth: 1,
                    borderColor: 'rgba(111,81,142,0.25)',
                    borderRadius: 10,
                    padding: 14,
                    flexDirection: 'row',
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <Sparkles size={18} color="#6f518e" strokeWidth={2} fill="#cca730" style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, color: '#44474d', fontStyle: 'italic' }}>
                    {context}
                  </Text>
                </View>
              ) : null}
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#1a2b48', letterSpacing: 0.6, marginBottom: 6 }}>
                {sel ? 'YOUR CHOICE' : 'TUTOR DRAFT'}
              </Text>
              <View
                style={{
                  padding: 14,
                  backgroundColor: '#ffffff',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#c5c6ce',
                }}
              >
                <Text style={{ fontSize: 16, lineHeight: 24, color: '#191c1d' }}>{content || raw}</Text>
              </View>
            </SheetModal>
          );
        })()}
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="bg-surface-lowest border-b border-outline-soft px-4 pt-3 pb-3 flex-row items-center">
        <Pressable onPress={() => setViewMode('timeline')} className="w-24 flex-row items-center">
          <ChevronLeft size={18} color="#1a2b48" strokeWidth={2.4} />
          <Text className="font-sans-medium text-body-md text-navy ml-1">Overview</Text>
        </Pressable>
        <Text className="flex-1 text-center font-serif text-headline-md text-ink" numberOfLines={1}>
          {project?.title ?? '…'}
        </Text>
        <View className="w-20" />
      </View>

      <View className="px-4 pt-3 pb-2.5 bg-surface-lowest border-b border-outline-soft">
        <StepProgress current={activeStep} />
        <Text className="font-sans-semibold text-label-caps text-ink-muted uppercase mt-2 text-center">
          {stepInfo.section} · {activeStep}/8
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>
        <View>
          <H2>
            {(() => {
              const parts = stepInfo.title.split(new RegExp(`(${stepInfo.highlight})`, 'i'));
              return parts.map((part, i) =>
                part.toLowerCase() === stepInfo.highlight.toLowerCase() ? (
                  <Text key={i} style={{ color: '#cca730', fontStyle: 'italic' }}>{part}</Text>
                ) : (
                  part
                )
              );
            })()}
          </H2>
          <View
            style={{
              marginTop: 12,
              backgroundColor: 'rgba(111,81,142,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(111,81,142,0.30)',
              borderRadius: 10,
              padding: 12,
              flexDirection: 'row',
              gap: 10,
            }}
          >
            <HelpCircle size={16} color="#6f518e" strokeWidth={2} style={{ marginTop: 2 }} />
            <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: '#191c1d' }}>
              {stepInfo.help}
            </Text>
          </View>
          <Muted className="mt-3">{stepInfo.instruction}</Muted>
        </View>

        {previousStepData && previousStepInfo && (
          <Pressable
            onPress={() => setRecapSheetStep(previousStepInfo.num)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#edeeef' : '#f3f4f5',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderWidth: 1,
              borderColor: '#c5c6ce',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            })}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1a2b48', letterSpacing: 0.6 }}>
              {previousStepInfo.num}.
            </Text>
            <Text style={{ flex: 1, fontSize: 13, color: '#44474d' }} numberOfLines={1}>
              {previousSelection ?? stripMarkdown(previousStepData.ai_response)}
            </Text>
            <ChevronDown size={16} color="#44474d" strokeWidth={2} />
          </Pressable>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Sparkles size={18} color="#fff" strokeWidth={2} fill="#cca730" />
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>Generate</Text>
          </View>
        </Button>

        {!!aiResponse && (currentSelection || !isSelectable) && (
          <Pressable
            onPress={() => setTutorSheetOpen(true)}
            style={{
              backgroundColor: 'rgba(111,81,142,0.07)',
              borderWidth: 1,
              borderColor: 'rgba(111,81,142,0.35)',
              borderRadius: 12,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Sparkles size={18} color="#6f518e" strokeWidth={2} fill="#cca730" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#6f518e', letterSpacing: 0.6, marginBottom: 3 }}>
                {currentSelection ? 'YOU CHOSE' : 'TUTOR RESPONSE'}
              </Text>
              <Text style={{ fontSize: 14, color: '#191c1d' }} numberOfLines={2}>
                {currentSelection ?? aiResponse}
              </Text>
            </View>
            <Pencil size={16} color="#6f518e" strokeWidth={2} />
          </Pressable>
        )}

        {!!aiResponse && isSelectable && !currentSelection && (
          <Button onPress={() => setTutorSheetOpen(true)} variant="ghost">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Sparkles size={16} color="#6f518e" strokeWidth={2} />
              <Text style={{ color: '#6f518e', fontSize: 16, fontWeight: '600' }}>Pick an option to continue</Text>
            </View>
          </Button>
        )}

        {!!aiResponse && (!isSelectable || currentSelection) && activeStep < 8 && (
          <Button onPress={() => goToStep(activeStep + 1)} variant="primary">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>Next Step: {nextStepLabel}</Text>
              <ChevronRight size={18} color="#fff" strokeWidth={2.4} />
            </View>
          </Button>
        )}

        {!!aiResponse && (!isSelectable || currentSelection) && isFinalStep && (
          <Button onPress={() => router.push(`/(app)/document/${id}`)} variant="success">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <GraduationCap size={20} color="#fff" strokeWidth={1.8} />
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>Generate APA Paper</Text>
              <ChevronRight size={18} color="#fff" strokeWidth={2.4} />
            </View>
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

      {/* Tutor response sheet */}
      <SheetModal
        open={tutorSheetOpen}
        onClose={() => setTutorSheetOpen(false)}
        title={isSelectable ? 'Pick one' : 'Edit response'}
        subtitle={undefined}
        helpText={
          isSelectable
            ? 'The tutor proposed 3 alternatives. Tap one to use it as your answer for this step. Switch to "Edit freely" if you want to write your own.'
            : 'Edit the tutor\'s draft freely. Your changes become the answer for this step. Switch to "Pick from options" if the response had 3 alternatives to choose from.'
        }
        footer={
          <Button
            onPress={() => setTutorSheetOpen(false)}
            variant="primary"
            disabled={isSelectable && !currentSelection}
          >
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>
              {isSelectable
                ? currentSelection
                  ? 'Apply this choice'
                  : 'Pick one to apply'
                : 'Apply edits'}
            </Text>
          </Button>
        }
      >
        {/* AI-generated disclaimer — Guideline 1.4 / 5.1.2(i) */}
        <AIWarningBanner />

        {/* Mode toggle when both Pick One and Edit are available */}
        {tutorOptions.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: '#edeeef',
              borderRadius: 10,
              padding: 3,
              marginBottom: 14,
            }}
          >
            <Pressable
              onPress={() => setForceEditMode(true)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: forceEditMode ? '#ffffff' : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: forceEditMode ? '#1a2b48' : '#75777e' }}>
                Edit freely
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setForceEditMode(false)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 8,
                backgroundColor: !forceEditMode ? '#ffffff' : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: !forceEditMode ? '#1a2b48' : '#75777e' }}>
                Pick from options
              </Text>
            </Pressable>
          </View>
        )}
        {isSelectable ? (
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
                      {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                    </View>
                    <Text style={{ flex: 1, fontSize: 15, lineHeight: 22, color: '#191c1d' }}>{opt}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (() => {
          const { context, content } = splitContext(aiResponse);
          return (
            <View style={{ gap: 14 }}>
              {context ? (
                <View
                  style={{
                    backgroundColor: 'rgba(111,81,142,0.06)',
                    borderWidth: 1,
                    borderColor: 'rgba(111,81,142,0.25)',
                    borderRadius: 10,
                    padding: 14,
                    flexDirection: 'row',
                    gap: 10,
                  }}
                >
                  <Sparkles size={18} color="#6f518e" strokeWidth={2} fill="#cca730" style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, color: '#44474d', fontStyle: 'italic' }}>
                    {context}
                  </Text>
                </View>
              ) : null}
              <View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#1a2b48', letterSpacing: 0.6, marginBottom: 6 }}>
                  YOUR DRAFT — EDIT FREELY
                </Text>
                <TextInput
                  multiline
                  value={content}
                  onChangeText={(t) => setAiResponse(context ? `${context}\n\n---\n\n${t}` : t)}
                  selectionColor="#6f518e"
                  style={{
                    fontSize: 16,
                    lineHeight: 24,
                    color: '#191c1d',
                    minHeight: 180,
                    textAlignVertical: 'top',
                    padding: 14,
                    backgroundColor: '#ffffff',
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: '#c5c6ce',
                  }}
                />
              </View>
            </View>
          );
        })()}
      </SheetModal>

      {/* Previous-step recap sheet */}
      {recapSheetStep !== null && (() => {
        const stepNum = recapSheetStep;
        const info = STEPS[stepNum - 1];
        const data = project?.steps_json[String(stepNum)];
        const sel = selections[stepNum];
        const raw = sel ?? (data ? stripMarkdown(data.ai_response) : '');
        const { context, content } = splitContext(raw);
        return (
          <SheetModal
            open={recapSheetStep !== null}
            onClose={() => setRecapSheetStep(null)}
            title={`Step ${stepNum}: ${info.section}`}
            helpText="Reference of what you decided in the previous step. Use it as context while you work on the current step. Tap 'Edit this step' to revise it."
            footer={
              <Button onPress={() => openStepForEdit(stepNum)} variant="ghost">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Pencil size={16} color="#6f518e" strokeWidth={2} />
                  <Text style={{ color: '#6f518e', fontSize: 16, fontWeight: '600' }}>Edit this step</Text>
                </View>
              </Button>
            }
          >
            {context ? (
              <View
                style={{
                  backgroundColor: 'rgba(111,81,142,0.06)',
                  borderWidth: 1,
                  borderColor: 'rgba(111,81,142,0.25)',
                  borderRadius: 10,
                  padding: 14,
                  flexDirection: 'row',
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <Sparkles size={18} color="#6f518e" strokeWidth={2} fill="#cca730" style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, color: '#44474d', fontStyle: 'italic' }}>
                  {context}
                </Text>
              </View>
            ) : null}
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#1a2b48', letterSpacing: 0.6, marginBottom: 6 }}>
              {sel ? 'YOUR CHOICE' : 'TUTOR DRAFT'}
            </Text>
            <View
              style={{
                padding: 14,
                backgroundColor: '#ffffff',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: '#c5c6ce',
              }}
            >
              <Text style={{ fontSize: 16, lineHeight: 24, color: '#191c1d' }}>{content || raw}</Text>
            </View>
          </SheetModal>
        );
      })()}

      {/* AI consent modal — Apple Guideline 5.1.2(i) */}
      <AIConsentModal
        open={consentOpen}
        onClose={() => setConsentOpen(false)}
        onGranted={() => {
          // After grant the user has to tap Generate again. We deliberately
          // do NOT auto-retry to avoid forcing a Claude call right after
          // consent in case the user wants to re-read their input first.
        }}
      />
    </Screen>
  );
}
