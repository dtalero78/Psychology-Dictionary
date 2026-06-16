import { ReactNode, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { HelpCircle, X } from 'lucide-react-native';
import { theme } from './ui';

/**
 * Bottom sheet that sizes to its content (max ~85% of screen).
 * Renders as a transparent modal with a dimmed backdrop. Tap backdrop or
 * X icon to close. KeyboardAvoidingView ensures inputs are not hidden by
 * the keyboard — needed for the "New Project" / "Edit name" sheets where
 * the user types into a TextInput inside the sheet.
 */
export function SheetModal({
  open,
  onClose,
  title,
  subtitle,
  helpText,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  helpText?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { C } = theme;
  const [showHelp, setShowHelp] = useState(false);
  // Reset help visibility each time sheet opens.
  useEffect(() => {
    if (!open) setShowHelp(false);
  }, [open]);
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        // 'padding' is the iOS-correct mode here: KAV adds bottom padding
        // equal to the keyboard height, which shifts our flex-end sheet up
        // by exactly the right amount. Android handles keyboard reposition
        // natively via windowSoftInputMode, so we leave behavior undefined.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        {/* Backdrop (closes on tap). Inside KAV so it covers the padded
            area too — otherwise a strip of keyboard would show through. */}
        <Pressable
          onPress={onClose}
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(20,20,30,0.45)' }]}
        />

        {/* Sheet at bottom */}
        <View
          style={{
            backgroundColor: C.surfaceLowest,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '85%',
            paddingBottom: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.12,
            shadowRadius: 16,
            elevation: 16,
          }}
        >
            {/* Drag handle */}
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
              <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: C.outlineSoft }} />
            </View>

            {/* Header */}
            <View
              style={{
                paddingHorizontal: 20,
                paddingTop: 8,
                paddingBottom: 12,
                flexDirection: 'row',
                alignItems: 'flex-start',
              }}
            >
              <View style={{ flex: 1 }}>
                {title ? (
                  <Text style={{ fontSize: 20, fontWeight: '700', color: C.ink, lineHeight: 26 }}>{title}</Text>
                ) : null}
                {subtitle ? (
                  <Text style={{ fontSize: 14, color: C.inkMuted, marginTop: 4, lineHeight: 20 }}>{subtitle}</Text>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginLeft: 12 }}>
                {helpText ? (
                  <Pressable
                    onPress={() => setShowHelp((v) => !v)}
                    hitSlop={10}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: showHelp ? 'rgba(111,81,142,0.18)' : C.surfaceLow,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <HelpCircle size={18} color={showHelp ? C.purple : C.inkMuted} strokeWidth={2} />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: C.surfaceLow,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={18} color={C.inkMuted} strokeWidth={2} />
                </Pressable>
              </View>
            </View>

            {/* Help tooltip — slides in below header when ? tapped */}
            {showHelp && helpText ? (
              <View
                style={{
                  marginHorizontal: 20,
                  marginBottom: 4,
                  backgroundColor: 'rgba(111,81,142,0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(111,81,142,0.30)',
                  borderRadius: 10,
                  padding: 12,
                  flexDirection: 'row',
                  gap: 10,
                }}
              >
                <HelpCircle size={16} color={C.purple} strokeWidth={2} style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, fontSize: 13, lineHeight: 19, color: C.ink }}>{helpText}</Text>
              </View>
            ) : null}

            {/* Body */}
            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: footer ? 12 : 20 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>

            {/* Footer */}
            {footer ? (
              <View
                style={{
                  paddingHorizontal: 20,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: C.outlineSoft,
                }}
              >
                {footer}
              </View>
            ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
