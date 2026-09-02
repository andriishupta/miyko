import { Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { AuthProvider } from '@/auth/auth-context';
import { getNavigationTheme, getPaperTheme, type ThemeMode } from '@/constants/paper-theme';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const mode: ThemeMode = colorScheme === 'dark' ? 'dark' : 'light';
  const paperTheme = getPaperTheme(mode);

  return (
    <AuthProvider>
      <ThemeProvider value={getNavigationTheme(mode)}>
        <PaperProvider theme={paperTheme}>
          <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(app)" options={{ headerShown: false }} />
          </Stack>
        </PaperProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
