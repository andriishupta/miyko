import { Redirect } from 'expo-router';

import { useAuth } from '@/auth/auth-context';
import AppTabs from '@/components/app-tabs';
import { ProviderStatusProvider } from '@/providers/provider-status-context';

export default function AppLayout() {
  const { status, session } = useAuth();
  if (status === 'loading') return null;
  if (status === 'unauthenticated') return <Redirect href="/" />;
  if (!session?.householdId) return <Redirect href="/onboarding" />;
  return <ProviderStatusProvider><AppTabs /></ProviderStatusProvider>;
}
