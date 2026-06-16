import { Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';

/**
 * Persistent disclaimer banner shown on every screen that displays AI-generated
 * content (wizard step output, statistical interpretation, APA draft).
 *
 * Required by App Store reviewers for AI apps in domains adjacent to
 * professional advice (psychology, health, legal, financial). Mitigates
 * rejections under Guideline 1.4 (medical advice) and 5.1.2(i).
 */
export function AIWarningBanner({
  text = 'AI-generated. Verify before publishing. Not clinical advice.',
}: {
  text?: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: 'rgba(196,167,125,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(196,167,125,0.40)',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        marginVertical: 8,
      }}
      accessibilityRole="alert"
      accessibilityLabel={text}
    >
      <Sparkles size={14} color="#8a6f3f" strokeWidth={2} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, fontSize: 12, lineHeight: 16, color: '#8a6f3f', fontWeight: '500' }}>
        {text}
      </Text>
    </View>
  );
}
