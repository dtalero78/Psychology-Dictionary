import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Link, router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../../src/context/AuthContext';
import { Body, Button, Divider, H1, Input, LabelCaps, Muted, Screen } from '../../components/ui';

export default function LoginScreen() {
  const { login, loginWithApple } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Required', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(app)/(tabs)');
    } catch (e: any) {
      Alert.alert('Login failed', e?.response?.data?.error ?? e.message ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleLogin() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });
      await loginWithApple(credential.identityToken!, credential.authorizationCode!);
      router.replace('/(app)/(tabs)');
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple Sign In failed', e.message);
      }
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-1 justify-center px-7">
          <View className="mb-8 items-center">
            {/* Brand mark — same marble bust used in the icon / splash / outro
                so the brand identity carries across every surface. */}
            <Image
              source={require('../../assets/bust.png')}
              style={{ width: 132, height: 174, marginBottom: 16 }}
              resizeMode="contain"
              accessibilityLabel="Psychology Dictionary Lab"
            />
            <H1 className="text-center">Psychology Dictionary Lab</H1>
            <Body className="text-purple font-sans-semibold text-headline-md mt-1 text-center">Research Tutor</Body>
            <Muted className="mt-3 text-center">Excellence in academic research, at your fingertips.</Muted>
          </View>

          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={16}
            style={{ width: '100%', height: 52, marginBottom: 24 }}
            onPress={handleAppleLogin}
          />

          <Divider label="OR EMAIL" className="mb-5" />

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
              <Input placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry />
            </View>
          </View>

          <Button onPress={handleLogin} loading={loading}>
            Sign In
          </Button>

          <Link href="/(auth)/register" className="text-center text-navy font-sans-semibold mt-5">
            New researcher? Create an account
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
