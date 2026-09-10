import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { MiykoText, ScreenScroll, SectionTitle, SecondaryButton, Surface } from '@/components/miyko-ui';
import { MemoryStatus } from '@/components/memory-status';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SettingsScreen() {
  const scheme = useColorScheme();
  const { session, logout } = useAuth();
  return (
    <>
      <Stack.Screen options={{ title: 'Settings', headerLargeTitle: false }} />
      <ScreenScroll contentContainerStyle={styles.content}>
        <MiykoText variant="body" color="textSecondary">Keep your household space and food plans in one place.</MiykoText>
        <View style={{ gap: Spacing.two }}><SectionTitle title="Appearance" /><Surface><View style={{ gap: 3 }}><MiykoText variant="body">Theme</MiykoText><MiykoText variant="caption" color="textSecondary">Following device setting · currently {scheme === 'dark' ? 'Dark' : 'Light'}</MiykoText></View></Surface></View>
        <View style={{ gap: Spacing.two }}><SectionTitle title="Personalization" /><MemoryStatus /></View>
        <View style={{ gap: Spacing.two }}><SectionTitle title="About MiyKo" /><Surface><MiykoText variant="section">Food planning for your household</MiykoText><MiykoText variant="body" color="textSecondary">MiyKo helps your household plan meals and shopping together.</MiykoText><MiykoText variant="caption" color="textSecondary">Version 0.1</MiykoText></Surface></View>
        <View style={{ gap: Spacing.two }}><SectionTitle title="Account" /><Surface><MiykoText variant="body" color="textSecondary">Signed in as {session?.user.email ?? 'your account'}.</MiykoText><SecondaryButton label="Sign out" onPress={() => void logout()} /></Surface></View>
      </ScreenScroll>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
});
