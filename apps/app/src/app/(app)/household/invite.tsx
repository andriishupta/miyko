import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { ApiInvitationCreateResponse } from '@/api/types';
import { Field, MiykoText, PrimaryButton, ScreenScroll, SecondaryButton, Surface } from '@/components/miyko-ui';
import { Spacing } from '@/constants/theme';

export default function InviteMemberScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [invitation, setInvitation] = useState<ApiInvitationCreateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createInvite() {
    if (!email.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      setInvitation(await api.household.invite(email.trim()));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not create invitation.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Invite member' }} />
      <ScreenScroll>
        <View style={{ gap: Spacing.two }}><MiykoText variant="title">Bring your household in.</MiykoText><MiykoText variant="body" color="textSecondary">Invite someone to add ideas and help with shared shopping decisions.</MiykoText></View>
        {invitation ? <Surface><MiykoText variant="section">Invitation created</MiykoText><MiykoText variant="body" color="textSecondary">A member invitation was created for {invitation.invitation.inviteeEmail ?? email}.</MiykoText><SecondaryButton label="Invite another person" onPress={() => { setInvitation(null); setEmail(''); }} /></Surface> : <Surface><Field label="EMAIL" placeholder="maria@example.com" value={email} onChangeText={setEmail} /><MiykoText variant="caption" color="textSecondary">They will join as a household member.</MiykoText>{error && <MiykoText variant="caption" color="danger">{error}</MiykoText>}<PrimaryButton label="Create invitation" onPress={createInvite} loading={loading} /></Surface>}
        <SecondaryButton label="Back to household" onPress={() => router.back()} />
      </ScreenScroll>
    </>
  );
}
