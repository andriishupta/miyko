import { Stack } from 'expo-router';
import { View } from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Switch } from 'react-native-paper';

import { MiykoText, ScreenScroll, SectionTitle, Surface } from '@/components/miyko-ui';
import { Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState(true);
  const [followUp, setFollowUp] = useState(true);

  return (
    <>
      <Stack.Screen options={{ title: 'Settings', headerLargeTitle: true }} />
      <ScreenScroll bottomInset={insets.bottom + 112}>
        <MiykoText variant="body" color="textSecondary">Tune the local prototype experience. These preferences will sync once the API is connected.</MiykoText>
        <View style={{ gap: Spacing.two }}><SectionTitle title="Notifications" /><Surface><SettingRow title="Household updates" detail="Requests and proposal changes" value={notifications} onValueChange={setNotifications} /><SettingRow title="Food loop follow-up" detail="Ask before suggesting the next basket" value={followUp} onValueChange={setFollowUp} /></Surface></View>
        <View style={{ gap: Spacing.two }}><SectionTitle title="Appearance" /><Surface><View style={{ gap: 3 }}><MiykoText variant="body">Theme</MiykoText><MiykoText variant="caption" color="textSecondary">Following device setting · currently {scheme === 'dark' ? 'Dark' : 'Light'}</MiykoText></View></Surface></View>
        <View style={{ gap: Spacing.two }}><SectionTitle title="About MiyKo" /><Surface><MiykoText variant="section">Food loop prototype</MiykoText><MiykoText variant="body" color="textSecondary">Mock household, memory, delivery and feedback surfaces are ready for API integration.</MiykoText><MiykoText variant="caption" color="textSecondary">Version 0.1 · local data only</MiykoText></Surface></View>
      </ScreenScroll>
    </>
  );
}

function SettingRow({ title, detail, value, onValueChange }: { title: string; detail: string; value: boolean; onValueChange: (value: boolean) => void }) {
  const theme = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}><View style={{ flex: 1, gap: 3 }}><MiykoText variant="body">{title}</MiykoText><MiykoText variant="caption" color="textSecondary">{detail}</MiykoText></View><Switch value={value} onValueChange={onValueChange} color={theme.accent} /></View>;
}
