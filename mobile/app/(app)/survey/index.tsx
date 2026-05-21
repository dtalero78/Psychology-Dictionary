import { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, unwrap } from '../../../src/api/client';
import type { Survey } from '../../../src/types';
import { Body, Button, Card, H2, Muted, Pill, Screen } from '../../../components/ui';

export default function SurveyListScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSurveys = useCallback(async () => {
    try {
      const res = await api.get(`/surveys/by-project/${projectId}`);
      setSurveys(unwrap<Survey[]>(res));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  return (
    <Screen>
      <View className="bg-surface-lowest border-b border-outline-soft px-4 py-3 flex-row items-center">
        <Pressable onPress={() => router.back()} className="w-16">
          <Text className="font-sans-medium text-body-md text-navy">‹ Back</Text>
        </Pressable>
        <Text className="flex-1 text-center font-serif text-headline-md text-ink">Surveys</Text>
        <View className="w-16" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6f518e" size="large" />
        </View>
      ) : (
        <FlatList
          data={surveys}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchSurveys();
              }}
              tintColor="#1a2b48"
            />
          }
          contentContainerStyle={surveys.length === 0 ? { flex: 1, justifyContent: 'center', padding: 32 } : { padding: 16, gap: 12, paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="items-center">
              <Text className="text-5xl mb-4">📋</Text>
              <H2 className="mb-2">No surveys yet</H2>
              <Muted className="text-center">Create your first survey to start collecting participant data.</Muted>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/(app)/survey/${item.id}?projectId=${projectId}`)}>
              <Card className="active:opacity-80">
                <View className="flex-row justify-between items-start gap-2 mb-1.5">
                  <Text className="flex-1 font-serif text-headline-md text-ink" numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Pill color={item.status === 'active' ? 'teal' : 'gray'}>{item.status}</Pill>
                </View>
                <Muted className="text-label-sm">
                  {item.config_json.questions?.length ?? 0} questions · Created {new Date(item.created_at).toLocaleDateString()}
                </Muted>
              </Card>
            </Pressable>
          )}
        />
      )}

      <View className="absolute bottom-6 left-5 right-5">
        <Button
          onPress={() => router.push(`/(app)/survey/create?projectId=${projectId}`)}
          variant="primary"
          style={{ shadowColor: '#1a2b48', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}
        >
          + New Survey
        </Button>
      </View>
    </Screen>
  );
}
