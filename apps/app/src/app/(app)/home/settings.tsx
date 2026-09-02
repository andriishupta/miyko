import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Switch } from 'react-native-paper';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError } from '@/api/client';
import type { ApiSettings } from '@/api/types';
import { MiykoText, ScreenScroll, SectionTitle, Surface, SecondaryButton } from '@/components/miyko-ui';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [settings, setSettings] = useState<ApiSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.settings.get()
      .then(setSettings)
      .catch((cause) => setError(cause instanceof ApiError ? cause.message : 'Could not load settings.'));
  }, []);

  async function updateNotifications(value: boolean) {
    if (!settings) return;
    setError(null);
    const previous = settings.notificationsEnabled;
    setSettings({ ...settings, notificationsEnabled: value });
    try {
      const updated = await api.settings.update({ notificationsEnabled: value });
      setSettings(updated);
    } catch (cause) {
      setSettings({ ...settings, notificationsEnabled: previous });
      setError(cause instanceof ApiError ? cause.message : 'Could not update settings.');
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Settings', headerLargeTitle: true }} />
      <ScreenScroll bottomInset={insets.bottom + 112}>
        <MiykoText variant="body" color="textSecondary">These preferences are loaded and saved through the MiyKo API.</MiykoText>
        {error && <MiykoText variant="caption" color="danger">{error}</MiykoText>}
        {!settings ? <ActivityIndicator color={theme.accent} /> : <>
          <View style={{ gap: Spacing.two }}><SectionTitle title="Notifications" /><Surface><SettingRow title="Household updates" detail="Requests and proposal changes" value={settings.notificationsEnabled} onValueChange={updateNotifications} /></Surface></View>
          <View style={{ gap: Spacing.two }}><SectionTitle title="Planning" /><Surface><MiykoText variant="body">Planning window</MiykoText><MiykoText variant="caption" color="textSecondary">MiyKo plans approximately {settings.preferredPlanningDays} days ahead.</MiykoText></Surface></View>
          <View style={{ gap: Spacing.two }}><SectionTitle title="Appearance" /><Surface><View style={{ gap: 3 }}><MiykoText variant="body">Theme</MiykoText><MiykoText variant="caption" color="textSecondary">Following device setting · currently {scheme === 'dark' ? 'Dark' : 'Light'}</MiykoText></View></Surface></View>
          <View style={{ gap: Spacing.two }}><SectionTitle title="Store providers" /><Surface><MiykoText variant="body" color="textSecondary">Connect an existing store account to use it for this household.</MiykoText><SecondaryButton label="Manage store providers" icon="cart" onPress={() => router.push('/home/providers')} /></Surface></View>
          <View style={{ gap: Spacing.two }}><SectionTitle title="About MiyKo" /><Surface><MiykoText variant="section">Food loop</MiykoText><MiykoText variant="body" color="textSecondary">Household, dashboard and delivery data are provided by the API.</MiykoText><MiykoText variant="caption" color="textSecondary">Version 0.1</MiykoText></Surface></View>
        </>}
      </ScreenScroll>
    </>
  );
}

function SettingRow({ title, detail, value, onValueChange }: { title: string; detail: string; value: boolean; onValueChange: (value: boolean) => void }) {
  const theme = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}><View style={{ flex: 1, gap: 3 }}><MiykoText variant="body">{title}</MiykoText><MiykoText variant="caption" color="textSecondary">{detail}</MiykoText></View><Switch value={value} onValueChange={onValueChange} color={theme.accent} /></View>;
}
