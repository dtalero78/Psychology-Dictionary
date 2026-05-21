import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, unwrap } from '../../../../src/api/client';
import { Card, H2, Muted, Screen } from '../../../../components/ui';

interface SurveyResponse {
  id: string;
  survey_id: string;
  answers_json: Record<string, string>;
  completed_at: string;
}

interface ResponsesPage {
  total: number;
  responses: SurveyResponse[];
}

const PAGE_SIZE = 50;

export default function ResponsesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const fetchPage = useCallback(
    async (pageOffset: number, replace: boolean) => {
      try {
        const res = await api.get(`/surveys/${id}/responses?offset=${pageOffset}&limit=${PAGE_SIZE}`);
        const page = unwrap<ResponsesPage>(res);
        setTotal(page.total);
        setResponses((prev) => (replace ? page.responses : [...prev, ...page.responses]));
        setOffset(pageOffset + page.responses.length);
      } catch (e: any) {
        Alert.alert('Error', e.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [id]
  );

  useEffect(() => {
    fetchPage(0, true);
  }, [fetchPage]);

  function onRefresh() {
    setRefreshing(true);
    setOffset(0);
    fetchPage(0, true);
  }

  function loadMore() {
    if (loadingMore || responses.length >= total) return;
    setLoadingMore(true);
    fetchPage(offset, false);
  }

  function renderResponse({ item, index }: { item: SurveyResponse; index: number }) {
    const entries = Object.entries(item.answers_json);
    return (
      <Card>
        <View className="flex-row justify-between mb-2.5 pb-2.5 border-b border-outline-soft">
          <Text className="font-sans-semibold text-label-caps text-purple">#{index + 1}</Text>
          <Muted className="text-label-sm">{new Date(item.completed_at).toLocaleDateString()}</Muted>
        </View>
        {entries.map(([key, value]) => (
          <View key={key} className="flex-row gap-2.5 py-1 flex-wrap">
            <Text className="font-sans-semibold text-label-caps text-ink-muted uppercase w-10">
              {key.replace('q_', 'Q')}
            </Text>
            <Text className="font-sans text-body-md text-ink flex-1">{value}</Text>
          </View>
        ))}
      </Card>
    );
  }

  return (
    <Screen>
      <View className="bg-surface-lowest border-b border-outline-soft px-4 py-3 flex-row items-center">
        <Pressable onPress={() => router.back()} className="w-16">
          <Text className="font-sans-medium text-body-md text-navy">‹ Back</Text>
        </Pressable>
        <Text className="flex-1 text-center font-serif text-headline-md text-ink">Responses</Text>
        <Text className="w-16 text-right font-sans-semibold text-body-md text-purple">{total}</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6f518e" size="large" />
        </View>
      ) : (
        <FlatList
          data={responses}
          keyExtractor={(item) => item.id}
          renderItem={renderResponse}
          contentContainerStyle={responses.length === 0 ? { flex: 1, justifyContent: 'center', padding: 32 } : { padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1a2b48" />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View className="items-center">
              <Text className="text-5xl mb-4">📭</Text>
              <H2 className="mb-2">No responses yet</H2>
              <Muted className="text-center">Share the survey link to start collecting data.</Muted>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#6f518e" style={{ marginVertical: 16 }} /> : null}
        />
      )}
    </Screen>
  );
}
