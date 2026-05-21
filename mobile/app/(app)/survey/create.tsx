import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, unwrap } from '../../../src/api/client';
import type { Survey, SurveyQuestion } from '../../../src/types';
import { Card, LabelCaps, Screen } from '../../../components/ui';

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
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }

  function addQuestion() {
    setQuestions((qs) => [...qs, emptyQuestion()]);
  }

  function removeQuestion(idx: number) {
    if (questions.length === 1) return;
    setQuestions((qs) => qs.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!title.trim()) {
      Alert.alert('Required', 'Please add a survey title.');
      return;
    }
    if (questions.some((q) => !q.text.trim())) {
      Alert.alert('Required', 'All questions need text.');
      return;
    }

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

  const inputClass = 'bg-surface-lowest border border-outline-soft rounded p-3 font-sans text-body-md text-ink';

  return (
    <Screen>
      <View className="bg-surface-lowest border-b border-outline-soft px-4 py-3 flex-row items-center">
        <Pressable onPress={() => router.back()} className="w-20">
          <Text className="font-sans-medium text-body-md text-navy">‹ Cancel</Text>
        </Pressable>
        <Text className="flex-1 text-center font-serif text-headline-md text-ink">New Survey</Text>
        <Pressable onPress={save} disabled={saving} className="w-20 items-end">
          {saving ? (
            <ActivityIndicator color="#1a2b48" size="small" />
          ) : (
            <Text className="font-sans-semibold text-body-md text-navy">Create</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }} keyboardShouldPersistTaps="handled">
        <LabelCaps>Survey Details</LabelCaps>
        <TextInput className={inputClass} placeholder="Survey title *" placeholderTextColor="#75777e" value={title} onChangeText={setTitle} />
        <TextInput
          className={`${inputClass} min-h-20`}
          placeholder="Description (optional)"
          placeholderTextColor="#75777e"
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
        />
        <TextInput
          className={inputClass}
          placeholder="Estimated minutes (optional)"
          placeholderTextColor="#75777e"
          value={estimatedMinutes}
          onChangeText={setEstimatedMinutes}
          keyboardType="number-pad"
        />

        <LabelCaps className="mt-4">Questions</LabelCaps>

        {questions.map((q, idx) => (
          <Card key={idx}>
            <View className="flex-row items-center gap-2 mb-3">
              <Text className="font-sans-semibold text-label-caps text-purple w-6">Q{idx + 1}</Text>
              <View className="flex-1 flex-row gap-1">
                {(['likert', 'text', 'select', 'number'] as QuestionType[]).map((t) => {
                  const active = q.type === t;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => updateQuestion(idx, { type: t })}
                      className={`px-2 py-1 rounded-sm border ${active ? 'bg-navy border-navy' : 'bg-surface-low border-outline-soft'}`}
                    >
                      <Text className={`font-sans-semibold text-label-caps ${active ? 'text-white' : 'text-ink-muted'}`}>
                        {t}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {questions.length > 1 && (
                <Pressable
                  onPress={() => removeQuestion(idx)}
                  className="w-7 h-7 rounded-full bg-danger/10 items-center justify-center"
                >
                  <Text className="font-sans-semibold text-label-sm text-danger">✕</Text>
                </Pressable>
              )}
            </View>

            <TextInput
              className={`${inputClass} mb-2`}
              placeholder="Question text *"
              placeholderTextColor="#75777e"
              value={q.text}
              onChangeText={(t) => updateQuestion(idx, { text: t })}
              multiline
            />

            {q.type === 'likert' && (
              <View className="flex-row flex-wrap gap-2">
                <TextInput
                  className={`${inputClass} flex-1 min-w-[100px]`}
                  placeholder="Scale (1–10)"
                  placeholderTextColor="#75777e"
                  value={String(q.scale ?? 5)}
                  onChangeText={(v) => updateQuestion(idx, { scale: Math.max(2, Math.min(10, Number(v) || 5)) })}
                  keyboardType="number-pad"
                />
                <TextInput
                  className={`${inputClass} flex-1 min-w-[100px]`}
                  placeholder="Low anchor"
                  placeholderTextColor="#75777e"
                  value={q.anchor_low ?? ''}
                  onChangeText={(v) => updateQuestion(idx, { anchor_low: v })}
                />
                <TextInput
                  className={`${inputClass} flex-1 min-w-[100px]`}
                  placeholder="High anchor"
                  placeholderTextColor="#75777e"
                  value={q.anchor_high ?? ''}
                  onChangeText={(v) => updateQuestion(idx, { anchor_high: v })}
                />
              </View>
            )}

            {q.type === 'select' && (
              <TextInput
                className={`${inputClass} min-h-20`}
                placeholder="Options, one per line"
                placeholderTextColor="#75777e"
                value={(q.options ?? []).join('\n')}
                onChangeText={(v) => updateQuestion(idx, { options: v.split('\n').filter(Boolean) })}
                multiline
                textAlignVertical="top"
              />
            )}

            {q.type === 'number' && (
              <View className="flex-row gap-2">
                <TextInput
                  className={`${inputClass} flex-1 min-w-[100px]`}
                  placeholder="Min"
                  placeholderTextColor="#75777e"
                  value={q.min != null ? String(q.min) : ''}
                  onChangeText={(v) => updateQuestion(idx, { min: v ? Number(v) : undefined })}
                  keyboardType="number-pad"
                />
                <TextInput
                  className={`${inputClass} flex-1 min-w-[100px]`}
                  placeholder="Max"
                  placeholderTextColor="#75777e"
                  value={q.max != null ? String(q.max) : ''}
                  onChangeText={(v) => updateQuestion(idx, { max: v ? Number(v) : undefined })}
                  keyboardType="number-pad"
                />
              </View>
            )}

            <Pressable
              onPress={() => updateQuestion(idx, { required: !q.required })}
              className={`self-start px-2.5 py-1 rounded-sm border mt-2 ${q.required ? 'bg-navy border-navy' : 'bg-surface-low border-outline-soft'}`}
            >
              <Text className={`font-sans-semibold text-label-caps ${q.required ? 'text-white' : 'text-ink-muted'}`}>
                {q.required ? '★ Required' : '☆ Optional'}
              </Text>
            </Pressable>
          </Card>
        ))}

        <Pressable
          onPress={addQuestion}
          className="border-2 border-dashed border-purple rounded py-3.5 items-center mt-1 active:bg-purple/5"
        >
          <Text className="font-sans-semibold text-body-md text-purple">+ Add Question</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
