import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Divider } from 'react-native-paper';
import { View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { ApiProvider, ApiProviderAccountsResponse } from '@/api/types';
import { Field, MiykoText, PrimaryButton, SecondaryButton, StatusPill, Surface } from '@/components/miyko-ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ProviderManagementProps = {
  allowBind?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
};

export function ProviderManagement({ allowBind = false, onComplete, onSkip }: ProviderManagementProps) {
  const theme = useTheme();
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

  async function connectProvider(provider: ApiProvider) {
    const account = accountsByProvider.get(provider.slug);
    if (!login.trim() || !password || activeSlug) {
      setError('Enter the provider login and password.');
      return;
    }

    setActiveSlug(provider.slug);
    setError(null);
    setMessage(null);
    try {
      if (account && account.status !== 'active') {
        await api.providers.reauthorize(provider.slug, { login: login.trim(), password });
      } else {
        await api.providers.connect(provider.slug, { login: login.trim(), password });
      }
      await api.providers.bind(provider.slug);
      setLogin('');
      setPassword('');
      await load();
      onComplete?.();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : `Could not connect ${provider.name}.`);
    } finally {
      setActiveSlug(null);
    }
  }

  async function bindProvider(provider: ApiProvider) {
    if (activeSlug) return;
    setActiveSlug(provider.slug);
    setError(null);
    setMessage(null);
    try {
      await api.providers.bind(provider.slug);
      setMessage(`${provider.name} is connected to this household.`);
      onComplete?.();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : `Could not connect ${provider.name} to this household.`);
    } finally {
      setActiveSlug(null);
    }
  }

  async function disconnectProvider(provider: ApiProvider) {
    if (activeSlug) return;
    setActiveSlug(provider.slug);
    setError(null);
    setMessage(null);
    try {
      await api.providers.disconnect(provider.slug);
      await load();
      setMessage(`${provider.name} has been disconnected.`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : `Could not disconnect ${provider.name}.`);
    } finally {
      setActiveSlug(null);
    }
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
                {!onSkip && <SecondaryButton label="Disconnect" onPress={() => void disconnectProvider(provider)} />}
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
      {onSkip && <SecondaryButton label="Skip for now" onPress={onSkip} />}
    </View>
  );
}
