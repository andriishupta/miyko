import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Divider } from 'react-native-paper';
import { View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { ApiProvider, ApiProviderAccountsResponse } from '@/api/types';
import { Field, MiykoText, PrimaryButton, SecondaryButton, StatusPill, Surface } from '@/components/miyko-ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useOptionalProviderStatus } from '@/providers/provider-status-context';

type ProviderManagementProps = {
  allowBind?: boolean;
  onComplete?: () => void;
};

export function ProviderManagement({ allowBind = false, onComplete }: ProviderManagementProps) {
  const theme = useTheme();
  const providerStatus = useOptionalProviderStatus();
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [accounts, setAccounts] = useState<ApiProviderAccountsResponse['items']>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [providerItems, accountResponse] = await Promise.all([api.providers.list(), api.providers.accounts()]);
      setProviders(providerItems);
      setAccounts(accountResponse.items);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load store providers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const accountsByProvider = useMemo(() => new Map(accounts.map((account) => [account.provider.slug, account])), [accounts]);

  async function runProviderAction(provider: ApiProvider, action: () => Promise<void>, fallback: string, success?: string) {
    if (activeSlug) return false;
    setActiveSlug(provider.slug);
    setError(null);
    setMessage(null);
    try {
      await action();
      await providerStatus?.refresh();
      if (success) setMessage(success);
      return true;
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : fallback);
      return false;
    } finally {
      setActiveSlug(null);
    }
  }

  async function connectProvider(provider: ApiProvider) {
    const account = accountsByProvider.get(provider.slug);
    if (!login.trim() || !password || activeSlug) {
      setError('Enter the provider login and password.');
      return;
    }

    const completed = await runProviderAction(provider, async () => {
      if (account && account.status !== 'active') {
        await api.providers.reauthorize(provider.slug, { login: login.trim(), password });
      } else {
        await api.providers.connect(provider.slug, { login: login.trim(), password });
      }
      await api.providers.bind(provider.slug);
      setLogin('');
      setPassword('');
      await load();
    }, `Could not connect ${provider.name}.`);
    if (completed) onComplete?.();
  }

  async function bindProvider(provider: ApiProvider) {
    const completed = await runProviderAction(provider, async () => {
      await api.providers.bind(provider.slug);
    }, `Could not connect ${provider.name} to this household.`, `${provider.name} is connected to this household.`);
    if (completed) onComplete?.();
  }

  async function disconnectProvider(provider: ApiProvider) {
    await runProviderAction(provider, async () => {
      await api.providers.disconnect(provider.slug);
      await load();
    }, `Could not disconnect ${provider.name}.`, `${provider.name} has been disconnected.`);
  }

  return (
    <View style={{ gap: Spacing.three }}>
      {loading && <ActivityIndicator color={theme.accent} />}
      {error && <MiykoText variant="caption" color="danger">{error}</MiykoText>}
      {message && <MiykoText variant="caption" color="success">{message}</MiykoText>}
      {!loading && providers.length === 0 && <Surface><MiykoText variant="body" color="textSecondary">No store providers are available yet.</MiykoText></Surface>}
      {!loading && providers.map((provider) => {
        const account = accountsByProvider.get(provider.slug);
        const isBusy = activeSlug === provider.slug;
        const isConnected = account?.status === 'active';
        return (
          <Surface key={provider.id}>
            <View style={{ gap: Spacing.one }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two }}>
                <MiykoText variant="section" style={{ flex: 1 }}>{provider.name}</MiykoText>
                <StatusPill label={isConnected ? 'Connected' : account ? 'Reconnect required' : 'Available'} tone={isConnected ? 'success' : account ? 'warning' : 'neutral'} />
              </View>
              <MiykoText variant="caption" color="textSecondary">{provider.capabilities.join(' · ') || 'Store integration'}</MiykoText>
              {account?.accountLogin && <MiykoText variant="caption" color="textSecondary">Account: {account.accountLogin}</MiykoText>}
            </View>
            <Divider />
            {isConnected ? (
              <View style={{ gap: Spacing.two }}>
                <MiykoText variant="body" color="textSecondary">This provider account is ready to use.</MiykoText>
                {allowBind && <PrimaryButton label="Use in this household" loading={isBusy} onPress={() => void bindProvider(provider)} icon="cart" />}
                <SecondaryButton label="Disconnect" onPress={() => void disconnectProvider(provider)} />
              </View>
            ) : (
              <View style={{ gap: Spacing.two }}>
                <Field label="PROVIDER LOGIN" placeholder="Email or phone" value={login} onChangeText={setLogin} />
                <Field label="PROVIDER PASSWORD" placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
                <PrimaryButton label={account ? 'Reconnect provider' : 'Connect provider'} loading={isBusy} onPress={() => void connectProvider(provider)} icon="cart" />
              </View>
            )}
          </Surface>
        );
      })}
    </View>
  );
}
