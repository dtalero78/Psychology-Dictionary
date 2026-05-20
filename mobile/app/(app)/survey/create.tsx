import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, unwrap } from '../../../src/api/client';
import type { Survey, SurveyQuestion } from '../../../src/types';

type QuestionType = SurveyQuestion['type'];

function emptyQuestion(): SurveyQuestion {
  return { text: '', type: 'likert', scale: 5, anchor_low: 'Strongly Disagree', anchor_high: 'Strongly Agree', required: true };
}

export default function CreateSurveyScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [questions, setQuestions] = useState<SurveyQuestion[]>([emptyQuestion()]);
  const [saving, setSaving] = useState(false);

  function updateQuestion(idx: number, patch: Partial<SurveyQuestion>) {
    setQuestions(qs => qs.map((q, i) => i === idx ? { ...q, ...patch } : q));
  }

  function addQuestion() {
    setQuestions(qs => [...qs, emptyQuestion()]);
  }

  function removeQuestion(idx: number) {
    if (questions.length === 1) return;
    setQuestions(qs => qs.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!title.trim()) { Alert.alert('Required', 'Please add a survey title.'); return; }
    if (questions.some(q => !q.text.trim())) { Alert.alert('Required', 'All questions need text.'); return; }

    setSaving(true);
    try {
      const config_json: Record<string, unknown> = { questions };
      if (description.trim()) config_json.description = description.trim();
      if (estimatedMinutes.trim()) config_json.estimated_minutes = Number(estimatedMinutes);

      const res = await api.post('/surveys', {
        project_id: projectId,
        title: title.trim(),
        config_json,
      });
      const survey = unwrap<Survey>(res);
      router.replace(`/(app)/survey/${survey.id}?projectId=${projectId}`);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error ?? e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Survey</Text>
        <TouchableOpacity onPress={save} disabled={saving} style={styles.saveBtn}>
          {saving ? <ActivityIndicator color="#00BDB6" size="small" /> : <Text style={styles.saveText}>Create</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Basic info */}
        <Text style={styles.sectionTitle}>Survey Details</Text>
        <TextInput style={styles.input} placeholder="Survey title *" value={title} onChangeText={setTitle} />
        <TextInput
          style={[styles.input, styles.inputMulti]}
          placeholder="Description (optional)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
        <TextInput
          style={styles.input}
          placeholder="Estimated minutes (optional)"
          value={estimatedMinutes}
          onChangeText={setEstimatedMinutes}
          keyboardType="number-pad"
        />

        {/* Questions */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Questions</Text>
        {questions.map((q, idx) => (
          <View key={idx} style={styles.questionCard}>
            <View style={styles.qHeader}>
              <Text style={styles.qNum}>Q{idx + 1}</Text>
              <View style={styles.typeRow}>
                {(['likert', 'text', 'select', 'number'] as QuestionType[]).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, q.type === t && styles.typeChipActive]}
                    onPress={() => updateQuestion(idx, { type: t })}
                  >
                    <Text style={[styles.typeChipText, q.type === t && styles.typeChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {questions.length > 1 && (
                <TouchableOpacity onPress={() => removeQuestion(idx)} style={styles.removeBtn}>
                  <Text style={styles.removeBtnText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <TextInput
              style={[styles.input, { marginBottom: 8 }]}
              placeholder="Question text *"
              value={q.text}
              onChangeText={t => updateQuestion(idx, { text: t })}
              multiline
            />

            {/* Type-specific options */}
            {q.type === 'likert' && (
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.half]}
                  placeholder="Scale (1–10)"
                  value={String(q.scale ?? 5)}
                  onChangeText={v => updateQuestion(idx, { scale: Math.max(2, Math.min(10, Number(v) || 5)) })}
                  keyboardType="number-pad"
                />
                <TextInput
                  style={[styles.input, styles.half]}
                  placeholder="Low anchor"
                  value={q.anchor_low ?? ''}
                  onChangeText={v => updateQuestion(idx, { anchor_low: v })}
                />
                <TextInput
                  style={[styles.input, styles.half]}
                  placeholder="High anchor"
                  value={q.anchor_high ?? ''}
                  onChangeText={v => updateQuestion(idx, { anchor_high: v })}
                />
              </View>
            )}

            {q.type === 'select' && (
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="Options, one per line"
                value={(q.options ?? []).join('\n')}
                onChangeText={v => updateQuestion(idx, { options: v.split('\n').filter(Boolean) })}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            )}

            {q.type === 'number' && (
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.half]}
                  placeholder="Min"
                  value={q.min != null ? String(q.min) : ''}
                  onChangeText={v => updateQuestion(idx, { min: v ? Number(v) : undefined })}
                  keyboardType="number-pad"
                />
                <TextInput
                  style={[styles.input, styles.half]}
                  placeholder="Max"
                  value={q.max != null ? String(q.max) : ''}
                  onChangeText={v => updateQuestion(idx, { max: v ? Number(v) : undefined })}
                  keyboardType="number-pad"
                />
              </View>
            )}

            <View style={styles.requiredRow}>
              <TouchableOpacity
                style={[styles.reqChip, q.required && styles.reqChipActive]}
                onPress={() => updateQuestion(idx, { required: !q.required })}
              >
                <Text style={[styles.reqChipText, q.required && styles.reqChipTextActive]}>
                  {q.required ? '★ Required' : '☆ Optional'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={addQuestion}>
          <Text style={styles.addBtnText}>+ Add Question</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const C = { teal: '#00BDB6', dark: '#133844', tint: '#D1F9F1', edge: '#8EE8D8', ink: '#232830', sub: '#546072', bg: '#f5f7f7', card: '#fff' };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.card, borderBottomWidth: 0.5, borderBottomColor: C.edge },
  backBtn: { width: 70 },
  backText: { color: C.teal, fontSize: 16 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: C.ink },
  saveBtn: { width: 70, alignItems: 'flex-end' },
  saveText: { color: C.teal, fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  input: { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.edge, padding: 12, fontSize: 15, color: C.ink, marginBottom: 8 },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  questionCard: { backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.edge },
  qHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  qNum: { fontSize: 13, fontWeight: '800', color: C.teal, width: 24 },
  typeRow: { flex: 1, flexDirection: 'row', gap: 4 },
  typeChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: C.edge, backgroundColor: C.tint },
  typeChipActive: { backgroundColor: C.teal, borderColor: C.teal },
  typeChipText: { fontSize: 11, fontWeight: '600', color: C.dark },
  typeChipTextActive: { color: '#fff' },
  removeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fee', alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { fontSize: 12, color: '#c0392b', fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  half: { flex: 1, minWidth: 100 },
  requiredRow: { marginTop: 4 },
  reqChip: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: C.edge, backgroundColor: C.tint },
  reqChipActive: { backgroundColor: C.dark, borderColor: C.dark },
  reqChipText: { fontSize: 12, fontWeight: '600', color: C.sub },
  reqChipTextActive: { color: '#fff' },
  addBtn: { borderWidth: 1.5, borderColor: C.teal, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  addBtnText: { color: C.teal, fontSize: 15, fontWeight: '700' },
});
