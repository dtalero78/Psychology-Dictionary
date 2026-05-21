import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  SafeAreaView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';

// Academic Intelligence tokens — hardcoded for guaranteed iOS render.
// Mirrors mobile/tailwind.config.js so screen-level className continues to work.
const C = {
  navy: '#1a2b48',
  navyDeep: '#031632',
  purple: '#6f518e',
  purpleSoft: '#dcb8fd',
  gold: '#cca730',
  goldDeep: '#735c00',
  teal: '#0d7866',
  tealDeep: '#075a4c',
  surface: '#f8f9fa',
  surfaceLowest: '#ffffff',
  surfaceLow: '#f3f4f5',
  surfaceHigh: '#e7e8e9',
  ink: '#191c1d',
  inkMuted: '#44474d',
  inkSubtle: '#75777e',
  outlineSoft: '#c5c6ce',
  danger: '#ba1a1a',
};

const F = {
  serif: 'SourceSerif4_600SemiBold',
  serifBold: 'SourceSerif4_700Bold',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
};

type Variant = 'primary' | 'ghost' | 'success' | 'gold';

type WithClass<T> = T & { className?: string };

export function Screen({ children, style, className }: WithClass<{ children: ReactNode; style?: StyleProp<ViewStyle> }>) {
  return <SafeAreaView className={className} style={[s.screen, style]}>{children}</SafeAreaView>;
}

export function Card({ children, style, className, ...props }: WithClass<ViewProps & { style?: StyleProp<ViewStyle> }>) {
  return (
    <View className={className} style={[s.card, style]} {...props}>
      {children}
    </View>
  );
}

export function TutorCard({ children, label = 'TUTOR', style, className }: WithClass<{ children: ReactNode; label?: string; style?: StyleProp<ViewStyle> }>) {
  return (
    <View className={className} style={[s.tutorCard, style]}>
      <Text style={s.tutorLabel}>✦ {label}</Text>
      {children}
    </View>
  );
}

export function Pill({ children, color = 'navy', style, className }: WithClass<{ children: ReactNode; color?: 'navy' | 'purple' | 'gold' | 'teal' | 'gray'; style?: StyleProp<ViewStyle> }>) {
  const pillStyle = pillVariants[color];
  return (
    <View className={className} style={[s.pillBase, pillStyle.bg, style]}>
      <Text style={[s.pillText, pillStyle.text]}>{children}</Text>
    </View>
  );
}

export function H1({ children, style, className, ...props }: WithClass<TextProps & { style?: StyleProp<TextStyle> }>) {
  return (
    <Text className={className} style={[s.h1, style]} {...props}>
      {children}
    </Text>
  );
}

export function H2({ children, style, className, ...props }: WithClass<TextProps & { style?: StyleProp<TextStyle> }>) {
  return (
    <Text className={className} style={[s.h2, style]} {...props}>
      {children}
    </Text>
  );
}

export function H3({ children, style, className, ...props }: WithClass<TextProps & { style?: StyleProp<TextStyle> }>) {
  return (
    <Text className={className} style={[s.h3, style]} {...props}>
      {children}
    </Text>
  );
}

export function Body({ children, style, className, ...props }: WithClass<TextProps & { style?: StyleProp<TextStyle> }>) {
  return (
    <Text className={className} style={[s.body, style]} {...props}>
      {children}
    </Text>
  );
}

export function Muted({ children, style, className, ...props }: WithClass<TextProps & { style?: StyleProp<TextStyle> }>) {
  return (
    <Text className={className} style={[s.muted, style]} {...props}>
      {children}
    </Text>
  );
}

export function LabelCaps({ children, style, className, ...props }: WithClass<TextProps & { style?: StyleProp<TextStyle> }>) {
  return (
    <Text className={className} style={[s.labelCaps, style]} {...props}>
      {children}
    </Text>
  );
}

type ButtonProps = PressableProps & {
  children: ReactNode;
  variant?: Variant;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  className?: string;
};

export function Button({ children, variant = 'primary', loading, disabled, style, className, ...props }: ButtonProps) {
  const v = buttonVariants[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      disabled={isDisabled}
      className={className}
      style={[s.btnBase, v.btn, isDisabled && s.btnDisabled, style]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' || variant === 'gold' ? C.navy : '#fff'} />
      ) : (
        <Text style={[s.btnLabel, v.label]}>{children}</Text>
      )}
    </Pressable>
  );
}

export function Input({ style, className, ...props }: TextInputProps & { className?: string; style?: StyleProp<TextStyle> }) {
  return <TextInput placeholderTextColor={C.inkSubtle} className={className} style={[s.input, style]} {...props} />;
}

export function StepProgress({ current, total = 8 }: { current: number; total?: number }) {
  return (
    <View style={s.stepProgress}>
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isCompleted = step < current;
        const isActive = step === current;
        return (
          <View
            key={step}
            style={[s.stepBar, isCompleted ? s.stepDone : isActive ? s.stepActive : s.stepPending]}
          />
        );
      })}
    </View>
  );
}

export function StepHeader({
  step,
  total = 8,
  section,
  title,
  subtitle,
}: {
  step: number;
  total?: number;
  section: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[s.labelCaps, { color: C.navy }]}>
          Step {step} of {total}
        </Text>
        <Text style={[s.h3, { color: C.navy }]}>{section}</Text>
      </View>
      <StepProgress current={step} total={total} />
      <H2 style={{ marginTop: 8 }}>{title}</H2>
      {subtitle ? <Muted>{subtitle}</Muted> : null}
    </View>
  );
}

export function Divider({ label, style, className }: WithClass<{ label?: string; style?: StyleProp<ViewStyle> }>) {
  return (
    <View className={className} style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      <View style={{ flex: 1, height: 1, backgroundColor: C.outlineSoft }} />
      {label ? <Text style={[s.dividerLabel]}>{label}</Text> : null}
      {label ? <View style={{ flex: 1, height: 1, backgroundColor: C.outlineSoft }} /> : null}
    </View>
  );
}

// Re-export theme tokens for screens that need direct access
export const theme = { C, F };

const pillVariants = {
  navy: { bg: { backgroundColor: C.navy }, text: { color: '#fff' } },
  purple: { bg: { backgroundColor: 'rgba(111,81,142,0.15)' }, text: { color: C.purple } },
  gold: { bg: { backgroundColor: 'rgba(204,167,48,0.20)' }, text: { color: C.goldDeep } },
  teal: { bg: { backgroundColor: 'rgba(13,120,102,0.15)' }, text: { color: C.teal } },
  gray: { bg: { backgroundColor: C.surfaceHigh }, text: { color: C.inkMuted } },
};

const buttonVariants = {
  primary: { btn: { backgroundColor: C.navyDeep }, label: { color: '#fff' } },
  ghost: { btn: { backgroundColor: 'rgba(111,81,142,0.10)', borderWidth: 1, borderColor: C.purple }, label: { color: C.purple } },
  success: { btn: { backgroundColor: C.teal }, label: { color: '#fff' } },
  gold: { btn: { backgroundColor: 'rgba(204,167,48,0.10)', borderWidth: 1, borderColor: C.gold }, label: { color: C.goldDeep } },
};

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.surface },

  card: {
    backgroundColor: C.surfaceLowest,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.outlineSoft,
    padding: 16,
  },

  tutorCard: {
    backgroundColor: 'rgba(111,81,142,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(111,81,142,0.40)',
    borderRadius: 8,
    padding: 16,
  },
  tutorLabel: {
    fontFamily: F.sansSemibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: C.purple,
    textTransform: 'uppercase',
    marginBottom: 8,
  },

  pillBase: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  pillText: {
    fontFamily: F.sansSemibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  h1: {
    fontFamily: F.serifBold,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -0.68,
    color: C.ink,
  },
  h2: {
    fontFamily: F.serif,
    fontSize: 28,
    lineHeight: 34,
    color: C.ink,
  },
  h3: {
    fontFamily: F.serif,
    fontSize: 20,
    lineHeight: 28,
    color: C.ink,
  },
  body: {
    fontFamily: F.sans,
    fontSize: 15,
    lineHeight: 22,
    color: C.ink,
  },
  muted: {
    fontFamily: F.sans,
    fontSize: 15,
    lineHeight: 22,
    color: C.inkMuted,
  },
  labelCaps: {
    fontFamily: F.sansSemibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    color: C.inkMuted,
    textTransform: 'uppercase',
  },

  btnBase: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnLabel: {
    fontFamily: F.sansSemibold,
    fontSize: 17,
    lineHeight: 26,
  },

  input: {
    backgroundColor: C.surfaceLowest,
    borderWidth: 1,
    borderColor: C.outlineSoft,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: F.sans,
    fontSize: 17,
    lineHeight: 26,
    color: C.ink,
  },

  stepProgress: { flexDirection: 'row', gap: 6 },
  stepBar: { flex: 1, height: 6, borderRadius: 9999 },
  stepDone: { backgroundColor: C.navy },
  stepActive: { backgroundColor: C.purple },
  stepPending: { backgroundColor: C.surfaceHigh },

  dividerLabel: {
    fontFamily: F.sans,
    fontSize: 13,
    lineHeight: 18,
    color: C.inkMuted,
    marginHorizontal: 12,
  },
});
