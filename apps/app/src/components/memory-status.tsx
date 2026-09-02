import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native-paper';

import { api, ApiError } from '@/api/client';
import type { ApiMemoryInitializationStatus } from '@/api/types';
import { MiykoText, PrimaryButton, StatusPill, Surface } from '@/components/miyko-ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const statusLabels: Record<ApiMemoryInitializationStatus['status'], string> = {
  pending: 'Pending',
  processing: 'In progress',
  completed: 'Ready',
  failed: 'Needs attention',
  waiting_for_provider: 'Waiting for provider',
};

export function MemoryStatus() {
  const theme = useTheme();
  const [status, setStatus] = useState<ApiMemoryInitializationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await api.memory.status());
    } catch (cause) {
      setStatus(null);
      setError(cause instanceof ApiError ? cause.message : 'Memory status is not available.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Surface>
      <MiykoText variant="section">Memory initialization</MiykoText>
      {loading && <ActivityIndicator color={theme.accent} />}
      {!loading && status && <>
        <StatusPill label={statusLabels[status.status]} tone={status.status === 'completed' ? 'success' : status.status === 'failed' ? 'warning' : 'accent'} />
        <MiykoText variant="body" color="textSecondary">{status.status === 'completed' ? 'MiyKo has initialized the available household context.' : 'MiyKo will initialize memory after household and provider access are ready.'}</MiykoText>
        {status.lastError && <MiykoText variant="caption" color="danger">{status.lastError}</MiykoText>}
        {error && <MiykoText variant="caption" color="textSecondary">{error}</MiykoText>}
        {error && <PrimaryButton label="Retry" onPress={() => void load()} />}
      </>}
      {!loading && !status && !error && <MiykoText variant="body" color="textSecondary">Memory initialization has not started yet.</MiykoText>}
      <MiykoText variant="caption" color="textSecondary" style={{ marginTop: Spacing.one }}>No inferred preferences are shown as confirmed facts.</MiykoText>
    </Surface>
  );
}
