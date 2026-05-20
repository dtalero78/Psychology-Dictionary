import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, Alert,
  SafeAreaView, TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { api, unwrap } from '../../../../src/api/client';

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

  const fetchPage = useCallback(async (pageOffset: number, replace: boolean) => {
    try {
      const res = await api.get(`/surveys/${id}/responses?offset=${pageOffset}&limit=${PAGE_SIZE}`);
      const page = unwrap<ResponsesPage>(res);
      setTotal(page.total);
      setResponses(prev => replace ? page.responses : [...prev, ...page.responses]);
      setOffset(pageOffset + page.responses.length);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [id]);

  useEffect(() => { fetchPage(0, true); }, [fetchPage]);

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
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardNum}>#{index + 1}</Text>
          <Text style={styles.cardDate}>{new Date(item.completed_at).toLocaleDateString()}</Text>
        </View>
        {entries.map(([key, value]) => (
          <View key={key} style={styles.answerRow}>
            <Text style={styles.answerKey}>{key.replace('q_', 'Q').toUpperCase()}</Text>
            <Text style={styles.answerVal}>{value}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Responses</Text>
        <Text style={styles.headerCount}>{total}</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.teal} size="large" /></View>
      ) : (
        <FlatList
          data={responses}
          keyExtractor={item => item.id}
          renderItem={renderResponse}
          contentContainerStyle={responses.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyTitle}>No responses yet</Text>
              <Text style={styles.emptySub}>Share the survey link to start collecting data.</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={C.teal} style={{ marginVertical: 16 }} /> : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const C = { teal: '#00BDB6', dark: '#133844', tint: '#D1F9F1', edge: '#8EE8D8', ink: '#232830', sub: '#546072', bg: '#f5f7f7', card: '#fff' };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.card, borderBottomWidth: 0.5, borderBottomColor: C.edge },
  backBtn: { width: 60 },
  backText: { color: C.teal, fontSize: 16 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: C.ink },
  headerCount: { width: 60, textAlign: 'right', fontSize: 15, fontWeight: '700', color: C.teal },
  list: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1, justifyContent: 'center', padding: 32 },
  empty: { alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: C.ink, marginBottom: 8 },
  emptySub: { fontSize: 15, color: C.sub, textAlign: 'center', lineHeight: 22 },
  card: { backgroundColor: C.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.edge },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: C.edge },
  cardNum: { fontSize: 13, fontWeight: '800', color: C.teal },
  cardDate: { fontSize: 12, color: C.sub },
  answerRow: { flexDirection: 'row', gap: 10, paddingVertical: 3, flexWrap: 'wrap' },
  answerKey: { fontSize: 11, fontWeight: '700', color: C.sub, width: 40 },
  answerVal: { fontSize: 14, color: C.ink, flex: 1 },
});
