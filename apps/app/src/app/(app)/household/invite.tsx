import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'react-native';

import { Field, MiykoText, PrimaryButton, ScreenScroll, SecondaryButton, Surface } from '@/components/miyko-ui';
import { Spacing } from '@/constants/theme';

export default function InviteMemberScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <>
      <Stack.Screen options={{ title: 'Invite member' }} />
      <ScreenScroll bottomInset={insets.bottom + 112}>
        <View style={{ gap: Spacing.two }}><MiykoText variant="title">Bring your household in.</MiykoText><MiykoText variant="body" color="textSecondary">Invite someone to add meal ideas, preferences and changes to the shared plan.</MiykoText></View>
        {sent ? <Surface><MiykoText variant="section">Invite ready</MiykoText><MiykoText variant="body" color="textSecondary">A mock invitation for {email || 'your household member'} is ready. No email was sent.</MiykoText><SecondaryButton label="Invite another person" onPress={() => { setSent(false); setEmail(''); }} /></Surface> : <Surface><Field label="EMAIL OR PHONE" placeholder="maria@example.com" value={email} onChangeText={setEmail} /><MiykoText variant="caption" color="textSecondary">They will join as an adult member and can contribute to plans.</MiykoText><PrimaryButton label="Create mock invite" onPress={() => setSent(true)} /></Surface>}
        <SecondaryButton label="Back to household" onPress={() => router.back()} />
      </ScreenScroll>
    </>
  );
}
