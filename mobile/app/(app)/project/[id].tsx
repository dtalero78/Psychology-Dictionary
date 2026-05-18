import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, unwrap } from '../../../src/api/client';
import type { Project, StepResult } from '../../../src/types';

const STEPS = [
  { num: 1, title: 'Topic', placeholder: 'Enter a keyword or topic (e.g., "social media anxiety")' },
  { num: 2, title: 'Research Question', placeholder: 'Describe your topic or paste the AI suggestion from Step 1' },
  { num: 3, title: 'Hypothesis', placeholder: 'Paste your research question or describe what you expect to find' },
  { num: 4, title: 'Variables', placeholder: 'Describe your hypothesis and the constructs you want to measure' },
  { num: 5, title: 'Method', placeholder: 'Describe your variables and any design constraints (time, participants available)' },
  { num: 6, title: 'Instrument', placeholder: 'Describe the variable you need to measure. Mention any preferred scales.' },
  { num: 7, title: 'Analysis Plan', placeholder: 'Describe your variables and expected data type (scores, groups, etc.)' },
  { num: 8, title: 'Limitations', placeholder: 'Paste a summary of your full study design for a limitations review' },
];

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
      Alert.alert('AI Error', e?.response?.data?.error ?? e.message);
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.projectTitle} numberOfLines={1}>{project?.title ?? '…'}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stepNav} contentContainerStyle={styles.stepNavContent}>
        {STEPS.map((s) => {
          const done = project?.steps_json[String(s.num)];
          const active = s.num === activeStep;
          return (
            <TouchableOpacity key={s.num} style={[styles.stepPill, active && styles.stepPillActive, done && !active && styles.stepPillDone]} onPress={() => goToStep(s.num)}>
              <Text style={[styles.stepPillText, active && styles.stepPillTextActive]}>{done ? '✓' : s.num}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.body} contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.stepLabel}>Step {activeStep} of 8</Text>
        <Text style={styles.stepTitle}>{stepInfo.title}</Text>

        <TextInput
          style={styles.textInput}
          multiline
          numberOfLines={5}
          placeholder={stepInfo.placeholder}
          value={input}
          onChangeText={setInput}
          textAlignVertical="top"
        />

        <TouchableOpacity style={[styles.runBtn, loading && styles.runBtnDisabled]} onPress={runStep} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.runBtnText}>Generate with AI ✦</Text>}
        </TouchableOpacity>

        {!!aiResponse && (
          <View style={styles.responseCard}>
            <Text style={styles.responseLabel}>AI Response</Text>
            <Text style={styles.responseText}>{aiResponse}</Text>
            {activeStep < 8 && (
              <TouchableOpacity style={styles.nextBtn} onPress={() => goToStep(activeStep + 1)}>
                <Text style={styles.nextBtnText}>Next Step →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0', backgroundColor: '#fff' },
  backBtn: { width: 60 },
  backText: { color: '#0070c9', fontSize: 17 },
  projectTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#1d1d1f' },
  stepNav: { backgroundColor: '#fff', borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' },
  stepNavContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  stepPill: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  stepPillActive: { backgroundColor: '#0070c9' },
  stepPillDone: { backgroundColor: '#e8f5e9' },
  stepPillText: { fontSize: 14, fontWeight: '700', color: '#666' },
  stepPillTextActive: { color: '#fff' },
  body: { flex: 1 },
  stepLabel: { fontSize: 13, color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  stepTitle: { fontSize: 22, fontWeight: '700', color: '#1d1d1f', marginBottom: 16 },
  textInput: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#e0e0e0', padding: 14, fontSize: 15, lineHeight: 22, minHeight: 120, marginBottom: 12 },
  runBtn: { backgroundColor: '#0070c9', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 20 },
  runBtnDisabled: { backgroundColor: '#aaa' },
  runBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  responseCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderLeftWidth: 3, borderLeftColor: '#0070c9' },
  responseLabel: { fontSize: 12, color: '#0070c9', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  responseText: { fontSize: 15, color: '#1d1d1f', lineHeight: 24 },
  nextBtn: { marginTop: 16, backgroundColor: '#e8f4fd', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  nextBtnText: { color: '#0070c9', fontSize: 15, fontWeight: '700' },
});
