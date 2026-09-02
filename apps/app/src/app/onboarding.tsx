import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'react-native';

import { api, ApiError } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { Field, MiykoLogo, MiykoText, PrimaryButton, ScreenScroll, SecondaryButton, Surface } from '@/components/miyko-ui';
import { ProviderManagement } from '@/components/provider-management';
import { Spacing } from '@/constants/theme';

type OnboardingChoice = 'create' | 'join' | null;

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { status, session, refresh, logout } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [membershipEstablished, setMembershipEstablished] = useState(false);
  const [choice, setChoice] = useState<OnboardingChoice>(null);
  const [householdName, setHouseholdName] = useState('');
  const [invitationId, setInvitationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createHousehold() {
    if (!householdName.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      await api.onboarding.createHousehold(householdName.trim());
      setMembershipEstablished(true);
      const nextSession = await refresh();
      if (!nextSession?.householdId) throw new Error('The household was created, but no membership was returned.');
      setStep(2);
    } catch (cause) {
      setMembershipEstablished(false);
      setError(cause instanceof ApiError ? cause.message : 'Could not create household.');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'loading') return null;
  if (status === 'unauthenticated') return <Redirect href="/" />;
  if (session?.householdId && !membershipEstablished) return <Redirect href="/home" />;

  async function joinHousehold() {
    if (!invitationId.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      await api.invitations.accept(invitationId.trim());
      setMembershipEstablished(true);
      const nextSession = await refresh();
      if (!nextSession?.householdId) throw new Error('The invitation was accepted, but no household membership was returned.');
      setStep(2);
    } catch (cause) {
      setMembershipEstablished(false);
      setError(cause instanceof ApiError ? cause.message : 'Could not join household.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenScroll bottomInset={insets.bottom + Spacing.four} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingTop: insets.top + Spacing.four }}>
      <View style={{ gap: Spacing.five }}>
        <MiykoLogo />
        <View style={{ gap: Spacing.two }}><MiykoText variant="caption" color="accent">STEP {step} OF 2</MiykoText><MiykoText variant="hero">{step === 1 ? 'Set up your household.' : 'Connect a provider.'}</MiykoText><MiykoText variant="body" color="textSecondary">{step === 1 ? 'Your account is ready. Choose how you want to get started with MiyKo.' : 'Connect at least one provider to start workflows.'}</MiykoText></View>
        {step === 1 && <>
          <Surface><MiykoText variant="section">Choose an option</MiykoText><SecondaryButton label="Create household" icon="house" onPress={() => { setChoice('create'); setError(null); }} /><SecondaryButton label="Join household" icon="person" onPress={() => { setChoice('join'); setError(null); }} /></Surface>
          {choice === 'create' && <Surface><MiykoText variant="section">Create household</MiykoText><MiykoText variant="body" color="textSecondary">Create the shared space for workflows and approvals.</MiykoText><Field label="HOUSEHOLD NAME" placeholder="e.g. Petrenko family" value={householdName} onChangeText={setHouseholdName} />{error && <MiykoText variant="caption" color="danger">{error}</MiykoText>}<PrimaryButton label="Create household" loading={loading} onPress={() => void createHousehold()} /></Surface>}
          {choice === 'join' && <Surface><MiykoText variant="section">Join household</MiykoText><MiykoText variant="body" color="textSecondary">Enter the invitation ID. This calls the authenticated invitation acceptance route and then refreshes your session.</MiykoText><Field label="INVITATION ID" placeholder="Invitation UUID" value={invitationId} onChangeText={setInvitationId} />{error && <MiykoText variant="caption" color="danger">{error}</MiykoText>}<PrimaryButton label="Join household" loading={loading} onPress={() => void joinHousehold()} /></Surface>}
        </>}
        {step === 2 && <Surface><MiykoText variant="section">Connect a store provider</MiykoText><MiykoText variant="body" color="textSecondary">Connect Silpo to start workflows. Provider credentials are sent to the API and are not stored in the app.</MiykoText><ProviderManagement allowBind onComplete={() => router.replace('/home')} /></Surface>}
        <SecondaryButton label="Sign out" onPress={logout} />
      </View>
    </ScreenScroll>
  );
}
