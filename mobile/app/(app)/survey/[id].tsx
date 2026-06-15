import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, router } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { api, unwrap } from '../../../src/api/client';
import type { Survey } from '../../../src/types';
import { Card, LabelCaps, Muted, Pill, Screen } from '../../../components/ui';

export default function SurveyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string; projectId: string }>();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [responseCount, setResponseCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);

  const fetchSurvey = useCallback(async () => {
    try {
      const [sRes, rRes] = await Promise.all([
        api.get(`/surveys/${id}`),
        api.get(`/surveys/${id}/responses?limit=1`),
      ]);
      setSurvey(unwrap<Survey>(sRes));
      setResponseCount(unwrap<{ total: number; responses: unknown[] }>(rRes).total);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSurvey();
  }, [fetchSurvey]);

  async function copyLink() {
    if (!survey) return;
    await Clipboard.setStringAsync(survey.survey_url);
    Alert.alert('Copied', 'Survey link copied to clipboard.');
  }

  async function shareLink() {
    if (!survey) return;
    await Share.share({ message: `${survey.title}\n${survey.survey_url}` });
  }

  async function closeSurvey() {
    Alert.alert('Close survey?', 'Participants will no longer be able to submit responses.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Close',
        style: 'destructive',
        onPress: async () => {
          setClosing(true);
          try {
            await api.put(`/surveys/${id}/close`);
            await fetchSurvey();
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? e.message);
          } finally {
            setClosing(false);
          }
        },
      },
    ]);
  }

  async function deleteSurvey() {
    Alert.alert('Delete survey?', 'All responses will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/surveys/${id}`);
            router.back();
          } catch (e: any) {
            Alert.alert('Error', e?.response?.data?.error ?? e.message);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6f518e" size="large" />
        </View>
      </Screen>
    );
  }

  if (!survey) return null;

  const isActive = survey.status === 'active';
  const qCount = survey.config_json.questions?.length ?? 0;

  return (
    <Screen>
      <View className="bg-surface-lowest border-b border-outline-soft px-4 py-3 flex-row items-center">
        <Pressable onPress={() => router.back()} className="w-16">
          <Text className="font-sans-medium text-body-md text-navy">‹ Back</Text>
        </Pressable>
        <Text className="flex-1 text-center font-serif text-headline-md text-ink" numberOfLines={1}>
          {survey.title}
        </Text>
        <View className="w-16" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Pill color={isActive ? 'teal' : 'gray'}>{isActive ? '● Active' : '✕ Closed'}</Pill>

        <View className="flex-row bg-surface-lowest rounded border border-outline-soft overflow-hidden">
          <View className="flex-1 py-5 items-center">
            <Text className="font-serif-bold text-display-lg text-navy">{responseCount}</Text>
            <LabelCaps className="mt-0.5">Responses</LabelCaps>
          </View>
          <View className="flex-1 py-5 items-center border-l border-r border-outline-soft">
            <Text className="font-serif-bold text-display-lg text-navy">{qCount}</Text>
            <LabelCaps className="mt-0.5">Questions</LabelCaps>
          </View>
          <View className="flex-1 py-5 items-center">
            <Text className="font-serif-bold text-display-lg text-navy">{survey.config_json.estimated_minutes ?? '—'}</Text>
            <LabelCaps className="mt-0.5">Min. est.</LabelCaps>
          </View>
        </View>

        {isActive && (
          <Card className="items-center p-6">
            <LabelCaps className="mb-4">Scan to open survey</LabelCaps>
            <View className="p-4 rounded bg-white border border-outline-soft">
              <QRCode value={survey.survey_url} size={180} color="#1a2b48" backgroundColor="#fff" />
            </View>
            <Muted className="mt-4 text-label-sm text-center px-2" numberOfLines={2}>
              {survey.survey_url}
            </Muted>

            <View className="flex-row gap-2.5 mt-4 w-full">
              <Pressable onPress={copyLink} className="flex-1 py-3 rounded border-2 border-navy items-center active:bg-navy/5">
                <Text className="font-sans-semibold text-body-md text-navy">Copy Link</Text>
              </Pressable>
              <Pressable onPress={shareLink} className="flex-1 py-3 rounded bg-navy-deep items-center active:bg-navy">
                <Text className="font-sans-semibold text-body-md text-white">Share…</Text>
              </Pressable>
            </View>
          </Card>
        )}

        {responseCount > 0 && (
          <Pressable
            onPress={() => router.push(`/(app)/survey/${id}/responses`)}
            className="bg-purple rounded-lg py-4 items-center active:bg-purple/80"
          >
            <Text className="font-sans-semibold text-body-lg text-white">
              View {responseCount} Response{responseCount !== 1 ? 's' : ''} →
            </Text>
          </Pressable>
        )}

        <View className="gap-2.5">
          {isActive && (
            <Pressable
              onPress={closeSurvey}
              disabled={closing}
              className="border border-outline-soft rounded py-3.5 items-center bg-surface-lowest active:bg-surface-low"
            >
              {closing ? (
                <ActivityIndicator color="#6f518e" />
              ) : (
                <Text className="font-sans-semibold text-body-md text-ink-muted">Close Survey</Text>
              )}
            </Pressable>
          )}
          <Pressable
            onPress={deleteSurvey}
            className="border border-danger/40 rounded py-3.5 items-center bg-danger/5 active:bg-danger/10"
          >
            <Text className="font-sans-semibold text-body-md text-danger">Delete Survey</Text>
          </Pressable>
        </View>

        <Muted className="text-center text-label-sm">Created {new Date(survey.created_at).toLocaleDateString()}</Muted>
      </ScrollView>
    </Screen>
  );
}
