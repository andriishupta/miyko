import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Switch } from 'react-native-paper';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiykoText, ScreenScroll, SectionTitle, Surface, SecondaryButton } from '@/components/miyko-ui';
import { MemoryStatus } from '@/components/memory-status';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  function updateNotifications(value: boolean) {
    setSettings((current) => ({ ...current, notificationsEnabled: value }));
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Settings', headerLargeTitle: true }} />
      <ScreenScroll bottomInset={insets.bottom + 112}>
        <MiykoText variant="body" color="textSecondary">These preferences are local to this app for the MVP.</MiykoText>
        <View style={{ gap: Spacing.two }}><SectionTitle title="Notifications" /><Surface><SettingRow title="Household updates" detail="Requests and proposal changes" value={settings.notificationsEnabled} onValueChange={updateNotifications} /></Surface></View>
        <View style={{ gap: Spacing.two }}><SectionTitle title="Planning" /><Surface><MiykoText variant="body">Planning window</MiykoText><MiykoText variant="caption" color="textSecondary">MiyKo plans approximately {settings.preferredPlanningDays} days ahead.</MiykoText></Surface></View>
        <View style={{ gap: Spacing.two }}><SectionTitle title="Appearance" /><Surface><View style={{ gap: 3 }}><MiykoText variant="body">Theme</MiykoText><MiykoText variant="caption" color="textSecondary">Following device setting · currently {scheme === 'dark' ? 'Dark' : 'Light'}</MiykoText></View></Surface></View>
        <View style={{ gap: Spacing.two }}><SectionTitle title="Store providers" /><Surface><MiykoText variant="body" color="textSecondary">Connect an existing store account to use it for this household.</MiykoText><SecondaryButton label="Manage store providers" icon="cart" onPress={() => router.push('/home/providers')} /></Surface></View>
        <View style={{ gap: Spacing.two }}><SectionTitle title="Memory" /><MemoryStatus /></View>
        <View style={{ gap: Spacing.two }}><SectionTitle title="About MiyKo" /><Surface><MiykoText variant="section">Food loop</MiykoText><MiykoText variant="body" color="textSecondary">Household, dashboard and delivery data are provided by the API.</MiykoText><MiykoText variant="caption" color="textSecondary">Version 0.1</MiykoText></Surface></View>
      </ScreenScroll>
    </>
  );
}

type AppSettings = {
  notificationsEnabled: boolean;
  preferredPlanningDays: number;
};

const DEFAULT_SETTINGS: AppSettings = {
  notificationsEnabled: true,
  preferredPlanningDays: 7,
};

function SettingRow({ title, detail, value, onValueChange }: { title: string; detail: string; value: boolean; onValueChange: (value: boolean) => void }) {
  const theme = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}><View style={{ flex: 1, gap: 3 }}><MiykoText variant="body">{title}</MiykoText><MiykoText variant="caption" color="textSecondary">{detail}</MiykoText></View><Switch value={value} onValueChange={onValueChange} color={theme.accent} /></View>;
}
