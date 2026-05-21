import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { Body, Button, H1, Input, LabelCaps, Muted, Screen } from '../../components/ui';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!email || !password) {
      Alert.alert('Required', 'Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await register(email.trim().toLowerCase(), password);
      router.replace('/(app)/(tabs)');
    } catch (e: any) {
      Alert.alert('Registration failed', e?.response?.data?.error ?? e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-1 justify-center px-7">
          <View className="mb-10 items-center">
            <H1 className="text-center">Create your account</H1>
            <Body className="text-purple font-sans-semibold text-headline-md mt-1 text-center">Psychology Dictionary Lab</Body>
            <Muted className="mt-3 text-center">Free tier includes 1 project and 50 survey responses.</Muted>
          </View>

          <View className="gap-3 mb-5">
            <View className="gap-1.5">
              <LabelCaps>Email</LabelCaps>
              <Input
                placeholder="researcher@university.edu"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View className="gap-1.5">
              <LabelCaps>Password</LabelCaps>
              <Input placeholder="Minimum 8 characters" value={password} onChangeText={setPassword} secureTextEntry />
            </View>
          </View>

          <Button onPress={handleRegister} loading={loading}>
            Create Account
          </Button>

          <Link href="/(auth)/login" className="text-center text-navy font-sans-semibold mt-5">
            Already have an account? Sign in
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
