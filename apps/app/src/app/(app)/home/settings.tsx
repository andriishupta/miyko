import { Stack, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiykoText, ScreenScroll, SectionTitle, Surface, SecondaryButton } from '@/components/miyko-ui';
import { MemoryStatus } from '@/components/memory-status';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SettingsScreen() {
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: 'Settings', headerLargeTitle: true }} />
      <ScreenScroll bottomInset={insets.bottom + 112}>
        <MiykoText variant="body" color="textSecondary">Manage the connections and services used by your household workflows.</MiykoText>
        <View style={{ gap: Spacing.two }}><SectionTitle title="Appearance" /><Surface><View style={{ gap: 3 }}><MiykoText variant="body">Theme</MiykoText><MiykoText variant="caption" color="textSecondary">Following device setting · currently {scheme === 'dark' ? 'Dark' : 'Light'}</MiykoText></View></Surface></View>
        <View style={{ gap: Spacing.two }}><SectionTitle title="Store providers" /><Surface><MiykoText variant="body" color="textSecondary">Connect an existing store account to use it for this household.</MiykoText><SecondaryButton label="Manage store providers" icon="cart" onPress={() => router.push('/home/providers')} /></Surface></View>
        <View style={{ gap: Spacing.two }}><SectionTitle title="Memory" /><MemoryStatus /></View>
        <View style={{ gap: Spacing.two }}><SectionTitle title="About MiyKo" /><Surface><MiykoText variant="section">Food loop</MiykoText><MiykoText variant="body" color="textSecondary">Household, dashboard and delivery data are provided by the API.</MiykoText><MiykoText variant="caption" color="textSecondary">Version 0.1</MiykoText></Surface></View>
      </ScreenScroll>
    </>
  );
}
