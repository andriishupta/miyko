import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/auth/auth-context';
import { ProviderStatusProvider } from '@/providers/provider-status-context';

export default function AppLayout() {
  const { status, session } = useAuth();
  if (status === 'loading') return null;
  if (status === 'unauthenticated') return <Redirect href="/" />;
  if (!session?.householdId) return <Redirect href="/onboarding" />;
  return <ProviderStatusProvider><Stack screenOptions={{ headerShown: false }} /></ProviderStatusProvider>;
}
