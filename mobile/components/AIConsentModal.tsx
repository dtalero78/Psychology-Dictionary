import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Sparkles, Shield, FileText, X } from 'lucide-react-native';
import { SheetModal } from './SheetModal';
import { Button } from './ui';
import { useAuth } from '../src/context/AuthContext';
import { useState } from 'react';

/**
 * Explicit opt-in for Anthropic Claude processing.
 *
 * Required by App Store Review Guideline 5.1.2(i) revised Nov 2025:
 *  - Must NAME the third-party AI explicitly ("Anthropic Claude")
 *  - Must state the PURPOSE of data transmission
 *  - Must state RETENTION / training policy
 *  - Must be ACTIVE consent (button click), not bundled with ToS acceptance
 *  - Must be REVOCABLE while non-AI features remain usable
 *
 * Shown automatically the first time the user taps any Generate/Run button,
 * triggered by a 403 with detail="AI_CONSENT_REQUIRED" from the backend, OR
 * via the toggle in Settings.
 */
export function AIConsentModal({
  open,
  onClose,
  onGranted,
}: {
  open: boolean;
  onClose: () => void;
  onGranted?: () => void;
}) {
  const { setAiConsent } = useAuth();
  const [busy, setBusy] = useState(false);

  async function grant() {
    setBusy(true);
    try {
      await setAiConsent(true);
      onGranted?.();
      onClose();
    } catch (e: any) {
      Alert.alert(
        'Could not save consent',
        e?.response?.data?.error ?? e?.response?.data?.detail ?? e.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SheetModal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="AI-powered research assistance"
      subtitle="Required disclosure before any data is shared with our AI provider."
      footer={
        <View style={{ gap: 8 }}>
          <Button onPress={grant} variant="primary" loading={busy}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
              I agree — enable AI features
            </Text>
          </Button>
          <Button onPress={onClose} variant="ghost">
            <Text style={{ color: '#1a2b48', fontSize: 15, fontWeight: '600' }}>
              Not now
            </Text>
          </Button>
        </View>
      }
    >
      <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
        <BlockRow
          icon={<Sparkles size={18} color="#6f518e" strokeWidth={2} />}
          title="What gets sent"
          body="Your research design inputs (research question, hypothesis, method, instruments, analysis plan) and aggregated statistical results are sent to Anthropic — the company that builds the Claude language model — to generate guided suggestions, APA-style interpretations, and full APA 7th edition paper drafts."
        />
        <BlockRow
          icon={<Shield size={18} color="#6f518e" strokeWidth={2} />}
          title="What is NOT sent"
          body={
            'Survey participant responses (individual rows) are never sent to Anthropic. Only the aggregate statistic that you compute on the backend (e.g. r, p, effect size) is forwarded. Your password, email, and account identifiers are never sent. We do not collect or send advertising identifiers.'
          }
        />
        <BlockRow
          icon={<FileText size={18} color="#6f518e" strokeWidth={2} />}
          title="How Anthropic handles it"
          body="Under our enterprise agreement with Anthropic, inputs you send are not used to train their models and are processed under zero-data-retention terms. Full details: anthropic.com/legal/commercial-terms."
        />

        <View
          style={{
            marginTop: 14,
            backgroundColor: 'rgba(196,167,125,0.10)',
            borderWidth: 1,
            borderColor: 'rgba(196,167,125,0.40)',
            borderRadius: 12,
            padding: 14,
          }}
        >
          <Text style={{ fontSize: 13, lineHeight: 19, color: '#191c1d' }}>
            <Text style={{ fontWeight: '700' }}>You can revoke this consent at any time</Text> from
            Settings → AI features. The rest of the app — projects, surveys, statistical analysis,
            participant responses — keeps working without AI.
          </Text>
        </View>

        <View
          style={{
            marginTop: 14,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 24,
          }}
        >
          <Pressable
            onPress={() => Linking.openURL('https://api.psychologydictionary.app/privacy')}
            hitSlop={10}
          >
            <Text
              style={{
                color: '#6f518e',
                fontSize: 13,
                fontWeight: '600',
                textDecorationLine: 'underline',
              }}
            >
              Privacy Policy
            </Text>
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL('https://api.psychologydictionary.app/terms')}
            hitSlop={10}
          >
            <Text
              style={{
                color: '#6f518e',
                fontSize: 13,
                fontWeight: '600',
                textDecorationLine: 'underline',
              }}
            >
              Terms of Service
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SheetModal>
  );
}

function BlockRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 14, marginBottom: 18 }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: 'rgba(111,81,142,0.10)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#191c1d', marginBottom: 4 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 13, lineHeight: 19, color: '#5b5d63' }}>{body}</Text>
      </View>
    </View>
  );
}
