import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'react-native';

import { MiykoLogo, MiykoText, PrimaryButton, ScreenScroll, Surface } from '@/components/miyko-ui';
import { Spacing } from '@/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  function handleLogin() {
    if (loading) return;
    setLoading(true);
    setTimeout(() => router.replace('/home'), 450);
  }

  return (
    <ScreenScroll bottomInset={insets.bottom + Spacing.four} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingTop: insets.top + Spacing.four }}>
      <View style={{ gap: Spacing.five }}>
        <MiykoLogo />
        <View style={{ gap: Spacing.two }}>
          <MiykoText variant="hero">Food planning that remembers.</MiykoText>
          <MiykoText variant="body" color="textSecondary">One shared space for what your household wants to eat, buy and repeat.</MiykoText>
        </View>
        <Surface>
          <MiykoText variant="section">Welcome back, Andrii</MiykoText>
          <MiykoText variant="body" color="textSecondary">This prototype opens with local mock data. You can explore the full food loop without an account.</MiykoText>
          <PrimaryButton label="Continue as Andrii" onPress={handleLogin} loading={loading} />
        </Surface>
        <MiykoText variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>Mock sign-in · API connection will be added later</MiykoText>
      </View>
    </ScreenScroll>
  );
}
