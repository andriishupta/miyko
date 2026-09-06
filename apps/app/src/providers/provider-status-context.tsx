import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, ApiError } from '@/api/client';
import type { ApiProviderConnectionsResponse } from '@/api/types';

type ProviderStatusContextValue = {
  connections: ApiProviderConnectionsResponse['items'];
  connected: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const ProviderStatusContext = createContext<ProviderStatusContextValue | null>(null);

export function ProviderStatusProvider({ children }: PropsWithChildren) {
  const [connections, setConnections] = useState<ProviderStatusContextValue['connections']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.providers.connections();
      setConnections(response.items);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load provider status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ connections, connected: connections.some((connection) => connection.status === 'active'), loading, error, refresh }), [connections, loading, error, refresh]);
  return <ProviderStatusContext.Provider value={value}>{children}</ProviderStatusContext.Provider>;
}

export function useProviderStatus() {
  const context = useContext(ProviderStatusContext);
  if (!context) throw new Error('useProviderStatus must be used inside ProviderStatusProvider');
  return context;
}

export function useOptionalProviderStatus() {
  return useContext(ProviderStatusContext);
}
