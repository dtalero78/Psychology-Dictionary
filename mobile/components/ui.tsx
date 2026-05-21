import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  SafeAreaView,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewProps,
} from 'react-native';

type Variant = 'primary' | 'ghost' | 'success' | 'gold';

const variantClasses: Record<Variant, { btn: string; label: string }> = {
  primary: { btn: 'bg-navy-deep active:bg-navy', label: 'text-white' },
  ghost: { btn: 'bg-purple/10 border border-purple', label: 'text-purple' },
  success: { btn: 'bg-teal active:bg-teal-deep', label: 'text-white' },
  gold: { btn: 'bg-gold/10 border border-gold', label: 'text-gold-deep' },
};

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <SafeAreaView className={`flex-1 bg-surface ${className}`}>{children}</SafeAreaView>;
}

export function Card({ children, className = '', ...props }: ViewProps & { className?: string }) {
  return (
    <View className={`bg-surface-lowest rounded border border-outline-soft p-4 ${className}`} {...props}>
      {children}
    </View>
  );
}

export function TutorCard({ children, label = 'TUTOR', className = '' }: { children: ReactNode; label?: string; className?: string }) {
  return (
    <View className={`bg-purple/5 border border-purple/40 rounded p-4 ${className}`}>
      <Text className="font-sans-semibold text-label-caps text-purple uppercase mb-2">✦ {label}</Text>
      {children}
    </View>
  );
}

export function Pill({ children, color = 'navy', className = '' }: { children: ReactNode; color?: 'navy' | 'purple' | 'gold' | 'teal' | 'gray'; className?: string }) {
  const colorMap = {
    navy: 'bg-navy text-white',
    purple: 'bg-purple/15 text-purple',
    gold: 'bg-gold/20 text-gold-deep',
    teal: 'bg-teal/15 text-teal',
    gray: 'bg-surface-high text-ink-muted',
  };
  return (
    <View className={`self-start rounded-full px-2 py-1 ${colorMap[color].split(' ')[0]} ${className}`}>
      <Text className={`font-sans-semibold text-label-caps uppercase ${colorMap[color].split(' ')[1]}`}>{children}</Text>
    </View>
  );
}

export function H1({ children, className = '', ...props }: TextProps & { className?: string }) {
  return (
    <Text className={`font-serif-bold text-display-lg text-ink ${className}`} {...props}>
      {children}
    </Text>
  );
}

export function H2({ children, className = '', ...props }: TextProps & { className?: string }) {
  return (
    <Text className={`font-serif text-headline-lg text-ink ${className}`} {...props}>
      {children}
    </Text>
  );
}

export function H3({ children, className = '', ...props }: TextProps & { className?: string }) {
  return (
    <Text className={`font-serif text-headline-md text-ink ${className}`} {...props}>
      {children}
    </Text>
  );
}

export function Body({ children, className = '', ...props }: TextProps & { className?: string }) {
  return (
    <Text className={`font-sans text-body-md text-ink ${className}`} {...props}>
      {children}
    </Text>
  );
}

export function Muted({ children, className = '', ...props }: TextProps & { className?: string }) {
  return (
    <Text className={`font-sans text-body-md text-ink-muted ${className}`} {...props}>
      {children}
    </Text>
  );
}

export function LabelCaps({ children, className = '', ...props }: TextProps & { className?: string }) {
  return (
    <Text className={`font-sans-semibold text-label-caps text-ink-muted uppercase ${className}`} {...props}>
      {children}
    </Text>
  );
}

type ButtonProps = PressableProps & {
  children: ReactNode;
  variant?: Variant;
  loading?: boolean;
  className?: string;
};

export function Button({ children, variant = 'primary', loading, disabled, className = '', ...props }: ButtonProps) {
  const v = variantClasses[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      disabled={isDisabled}
      className={`rounded-lg py-3.5 px-5 items-center justify-center ${v.btn} ${isDisabled ? 'opacity-50' : ''} ${className}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' || variant === 'gold' ? '#1a2b48' : '#fff'} />
      ) : (
        <Text className={`font-sans-semibold text-body-lg ${v.label}`}>{children}</Text>
      )}
    </Pressable>
  );
}

export function Input({ className = '', ...props }: TextInputProps & { className?: string }) {
  return (
    <TextInput
      placeholderTextColor="#75777e"
      className={`bg-surface-lowest border border-outline-soft rounded px-4 py-3.5 text-body-lg text-ink font-sans ${className}`}
      {...props}
    />
  );
}

export function StepProgress({ current, total = 8 }: { current: number; total?: number }) {
  return (
    <View className="flex-row gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const isCompleted = step < current;
        const isActive = step === current;
        return (
          <View
            key={step}
            className={`flex-1 h-1.5 rounded-full ${
              isCompleted ? 'bg-navy' : isActive ? 'bg-purple' : 'bg-surface-high'
            }`}
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
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="font-sans-semibold text-label-caps text-navy uppercase">
          Step {step} of {total}
        </Text>
        <Text className="font-serif text-headline-md text-navy">{section}</Text>
      </View>
      <StepProgress current={step} total={total} />
      <H2 className="mt-2">{title}</H2>
      {subtitle ? <Muted>{subtitle}</Muted> : null}
    </View>
  );
}

export function Divider({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <View className={`flex-row items-center ${className}`}>
      <View className="flex-1 h-px bg-outline-soft" />
      {label ? <Text className="font-sans text-label-sm text-ink-muted mx-3">{label}</Text> : null}
      {label ? <View className="flex-1 h-px bg-outline-soft" /> : null}
    </View>
  );
}
