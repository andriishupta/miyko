import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';

import { MiykoLogo, MiykoText } from '@/components/miyko-ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const theme = useTheme();

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <View style={[styles.tabBar, { backgroundColor: theme.backgroundElement, boxShadow: `0 4px 20px ${theme.text}20` }]}>
          <MiykoLogo compact />
          <TabTrigger name="home" href="/home" asChild><TabButton>Home</TabButton></TabTrigger>
          <TabTrigger name="household" href="/household" asChild><TabButton>Household</TabButton></TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();
  return <Pressable {...props} style={({ pressed }) => [styles.tabButton, { backgroundColor: isFocused ? theme.accentSoft : 'transparent' }, pressed && styles.pressed]}><MiykoText variant="label" color={isFocused ? 'accent' : 'textSecondary'}>{children}</MiykoText></Pressable>;
}

const styles = StyleSheet.create({
  tabBar: { position: 'absolute', bottom: Spacing.three, left: Spacing.two, right: Spacing.two, alignSelf: 'center', width: '92%', maxWidth: MaxContentWidth, flexDirection: 'row', alignItems: 'center', gap: Spacing.one, padding: Spacing.two, borderRadius: 999 },
  tabButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: 999 },
  pressed: { opacity: 0.7 },
});
