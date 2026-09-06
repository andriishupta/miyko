import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Divider } from 'react-native-paper';
import { View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { ApiProvider, ApiProviderConnectionsResponse } from '@/api/types';
import { Field, MiykoText, PrimaryButton, SecondaryButton, StatusPill, Surface } from '@/components/miyko-ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useOptionalProviderStatus } from '@/providers/provider-status-context';

type ProviderManagementProps = {
  onComplete?: () => void;
};

export function ProviderManagement({ onComplete }: ProviderManagementProps) {
  const theme = useTheme();
  const providerStatus = useOptionalProviderStatus();
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [connections, setConnections] = useState<ApiProviderConnectionsResponse['items']>([]);
  const [isOwner, setIsOwner] = useState(false);
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
      const [providerItems, connectionResponse, household] = await Promise.all([api.providers.list(), api.providers.connections(), api.household.summary()]);
      setProviders(providerItems);
      setConnections(connectionResponse.items);
      setIsOwner(household.currentMember.role === 'owner');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load store providers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const connectionsByProvider = useMemo(() => new Map(connections.map((connection) => [connection.provider.slug, connection])), [connections]);

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
    const connection = connectionsByProvider.get(provider.slug);
    if (!login.trim() || !password || activeSlug) {
      setError('Enter the provider login and password.');
      return;
    }

    const completed = await runProviderAction(provider, async () => {
      if (connection && connection.status !== 'active') {
        await api.providers.reauthorize(provider.slug, { login: login.trim(), password });
      } else {
        await api.providers.connect(provider.slug, { login: login.trim(), password });
      }
      setLogin('');
      setPassword('');
      await load();
    }, `Could not connect ${provider.name}.`);
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
        const connection = connectionsByProvider.get(provider.slug);
        const isBusy = activeSlug === provider.slug;
        const isConnected = connection?.status === 'active';
        return (
          <Surface key={provider.id}>
            <View style={{ gap: Spacing.one }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two }}>
                <MiykoText variant="section" style={{ flex: 1 }}>{provider.name}</MiykoText>
                <StatusPill label={isConnected ? 'Connected' : connection ? 'Reconnect required' : 'Available'} tone={isConnected ? 'success' : connection ? 'warning' : 'neutral'} />
              </View>
              <MiykoText variant="caption" color="textSecondary">{provider.capabilities.join(' · ') || 'Store integration'}</MiykoText>
            </View>
            <Divider />
            {isConnected ? (
              <View style={{ gap: Spacing.two }}>
                <MiykoText variant="body" color="textSecondary">This provider is ready for the household.</MiykoText>
                {isOwner && <SecondaryButton label="Disconnect" onPress={() => void disconnectProvider(provider)} />}
              </View>
            ) : !isOwner ? (
              <MiykoText variant="body" color="textSecondary">The household owner must connect this provider.</MiykoText>
            ) : (
              <View style={{ gap: Spacing.two }}>
                <Field label="PROVIDER LOGIN" placeholder="Email or phone" value={login} onChangeText={setLogin} />
                <Field label="PROVIDER PASSWORD" placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
                <PrimaryButton label={connection ? 'Reconnect provider' : 'Connect provider'} loading={isBusy} onPress={() => void connectProvider(provider)} icon="cart" />
              </View>
            )}
          </Surface>
        );
      })}
    </View>
  );
}
