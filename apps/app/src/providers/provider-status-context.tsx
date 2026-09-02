import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, ApiError } from '@/api/client';
import type { ApiProviderAccountsResponse } from '@/api/types';

type ProviderStatusContextValue = {
  accounts: ApiProviderAccountsResponse['items'];
  connected: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const ProviderStatusContext = createContext<ProviderStatusContextValue | null>(null);

export function ProviderStatusProvider({ children }: PropsWithChildren) {
  const [accounts, setAccounts] = useState<ProviderStatusContextValue['accounts']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.providers.accounts();
      setAccounts(response.items);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Could not load provider status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ accounts, connected: accounts.some((account) => account.status === 'active'), loading, error, refresh }), [accounts, loading, error, refresh]);
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
