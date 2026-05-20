import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, SafeAreaView, ActivityIndicator, Share, Clipboard,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { api, unwrap } from '../../../src/api/client';
import type { Survey } from '../../../src/types';

export default function SurveyDetailScreen() {
  const { id, projectId } = useLocalSearchParams<{ id: string; projectId: string }>();
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

  useEffect(() => { fetchSurvey(); }, [fetchSurvey]);

  async function copyLink() {
    if (!survey) return;
    Clipboard.setString(survey.survey_url);
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
        text: 'Close', style: 'destructive', onPress: async () => {
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
        text: 'Delete', style: 'destructive', onPress: async () => {
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
      <SafeAreaView style={styles.container}>
        <View style={styles.center}><ActivityIndicator color={C.teal} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (!survey) return null;

  const isActive = survey.status === 'active';
  const qCount = survey.config_json.questions?.length ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{survey.title}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status badge */}
        <View style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusClosed]}>
          <Text style={[styles.statusText, isActive ? styles.statusTextActive : styles.statusTextClosed]}>
            {isActive ? '● Active' : '✕ Closed'}
          </Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{responseCount}</Text>
            <Text style={styles.statLabel}>Responses</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxMid]}>
            <Text style={styles.statNum}>{qCount}</Text>
            <Text style={styles.statLabel}>Questions</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{survey.config_json.estimated_minutes ?? '—'}</Text>
            <Text style={styles.statLabel}>Min. est.</Text>
          </View>
        </View>

        {/* QR code */}
        {isActive && (
          <View style={styles.qrCard}>
            <Text style={styles.qrLabel}>Scan to open survey</Text>
            <View style={styles.qrBox}>
              <QRCode value={survey.survey_url} size={180} color={C.dark} backgroundColor="#fff" />
            </View>
            <Text style={styles.urlText} numberOfLines={2}>{survey.survey_url}</Text>

            <View style={styles.shareRow}>
              <TouchableOpacity style={styles.shareBtn} onPress={copyLink}>
                <Text style={styles.shareBtnText}>Copy Link</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.shareBtn, styles.shareBtnPrimary]} onPress={shareLink}>
                <Text style={[styles.shareBtnText, styles.shareBtnTextPrimary]}>Share…</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Responses button */}
        {responseCount > 0 && (
          <TouchableOpacity
            style={styles.responsesBtn}
            onPress={() => router.push(`/(app)/survey/${id}/responses`)}
          >
            <Text style={styles.responsesBtnText}>View {responseCount} Response{responseCount !== 1 ? 's' : ''} →</Text>
          </TouchableOpacity>
        )}

        {/* Actions */}
        <View style={styles.actionsSection}>
          {isActive && (
            <TouchableOpacity style={styles.actionBtn} onPress={closeSurvey} disabled={closing}>
              {closing
                ? <ActivityIndicator color={C.teal} />
                : <Text style={styles.actionBtnText}>Close Survey</Text>}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={deleteSurvey}>
            <Text style={[styles.actionBtnText, styles.actionBtnTextDanger]}>Delete Survey</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.createdAt}>Created {new Date(survey.created_at).toLocaleDateString()}</Text>
      </ScrollView>
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
  content: { padding: 20, gap: 16 },

  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statusActive: { backgroundColor: C.tint, borderColor: C.teal },
  statusClosed: { backgroundColor: '#f5f5f5', borderColor: '#ccc' },
  statusText: { fontSize: 13, fontWeight: '700' },
  statusTextActive: { color: C.dark },
  statusTextClosed: { color: '#888' },

  statsRow: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.edge, overflow: 'hidden' },
  statBox: { flex: 1, paddingVertical: 18, alignItems: 'center' },
  statBoxMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.edge },
  statNum: { fontSize: 26, fontWeight: '800', color: C.dark },
  statLabel: { fontSize: 11, color: C.sub, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },

  qrCard: { backgroundColor: C.card, borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: C.edge },
  qrLabel: { fontSize: 13, fontWeight: '700', color: C.sub, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 },
  qrBox: { padding: 16, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: C.edge },
  urlText: { marginTop: 14, fontSize: 12, color: C.sub, textAlign: 'center', paddingHorizontal: 8 },
  shareRow: { flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' },
  shareBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: C.teal, alignItems: 'center' },
  shareBtnPrimary: { backgroundColor: C.teal, borderColor: C.teal },
  shareBtnText: { fontSize: 15, fontWeight: '700', color: C.teal },
  shareBtnTextPrimary: { color: '#fff' },

  responsesBtn: { backgroundColor: C.dark, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  responsesBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  actionsSection: { gap: 10 },
  actionBtn: { borderWidth: 1.5, borderColor: C.edge, borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: C.card },
  actionBtnDanger: { borderColor: '#ffcccc', backgroundColor: '#fff5f5' },
  actionBtnText: { fontSize: 15, fontWeight: '600', color: C.sub },
  actionBtnTextDanger: { color: '#c0392b' },

  createdAt: { textAlign: 'center', fontSize: 12, color: C.sub },
});
