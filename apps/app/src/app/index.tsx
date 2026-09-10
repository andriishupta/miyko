import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native-paper';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { Field, MiykoLogo, MiykoText, PrimaryButton, ScreenScroll, SecondaryButton, Surface } from '@/components/miyko-ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { status, session, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('owner@miyko.local');
  const [password, setPassword] = useState('miyko-demo-password');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session) router.replace(session.householdId ? '/home' : '/onboarding');
  }, [router, session, status]);

  async function handleSubmit() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === 'register') {
        await register({ email: email.trim(), password, firstName: firstName.trim(), lastName: lastName.trim() });
      } else {
        await login(email.trim(), password);
      }
      router.replace('/home');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading') {
    return <ScreenScroll contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={theme.accent} /></ScreenScroll>;
  }

  return (
    <ScreenScroll contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ gap: Spacing.five }}>
        <MiykoLogo />
        <View style={{ gap: Spacing.two }}>
          <MiykoText variant="hero">Food planning that remembers.</MiykoText>
          <MiykoText variant="body" color="textSecondary">One shared space for what your household wants to eat, buy and repeat.</MiykoText>
        </View>
        <Surface>
          <MiykoText variant="section">{mode === 'login' ? 'Sign in to MiyKo' : 'Create your MiyKo account'}</MiykoText>
          <MiykoText variant="body" color="textSecondary">{mode === 'login' ? 'Your household, requests and shared shopping plan in one place.' : 'Create an account first, then choose a household.'}</MiykoText>
          {mode === 'register' && <><Field label="FIRST NAME" placeholder="First name" value={firstName} onChangeText={setFirstName} /><Field label="LAST NAME" placeholder="Last name" value={lastName} onChangeText={setLastName} /></>}
    <Field label="EMAIL" placeholder="you@example.com" value={email} onChangeText={setEmail} />
          <Field label="PASSWORD" placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
          {error && <MiykoText variant="caption" color="danger">{error}</MiykoText>}
          <PrimaryButton label={mode === 'login' ? 'Sign in' : 'Create account'} onPress={handleSubmit} loading={loading} />
        </Surface>
        <SecondaryButton label={mode === 'login' ? 'Create an account' : 'I already have an account'} onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }} />
        {mode === 'login' && <MiykoText variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>Demo account is prefilled for you.</MiykoText>}
      </View>
    </ScreenScroll>
  );
}
