import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import type { RegisterRequest } from '@miyko/contracts';

import { api, login as loginWithApi, refreshSession } from '@/api/client';
import { clearStoredSession, storeSession } from '@/api/session-storage';
import type { AppSession } from '@/api/types';

type AuthContextValue = {
  session: AppSession | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterRequest) => Promise<void>;
  refresh: () => Promise<AppSession | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshSession()
      .then((nextSession) => {
        setSession(nextSession);
        setStatus(nextSession ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        setSession(null);
        setStatus('unauthenticated');
      });
  }, []);

  async function login(email: string, password: string) {
    setError(null);
    const nextSession = await loginWithApi(email, password);
    await storeSession(nextSession);
    setSession(nextSession);
    setStatus('authenticated');
  }

  async function register(input: RegisterRequest) {
    setError(null);
    const response = await api.auth.register(input);
    const nextSession = { accessToken: response.accessToken, user: response.user, householdId: response.householdId };
    await storeSession(nextSession);
    setSession(nextSession);
    setStatus('authenticated');
  }

  async function refresh() {
    const nextSession = await refreshSession();
    if (nextSession) await storeSession(nextSession);
    setSession(nextSession);
    setStatus(nextSession ? 'authenticated' : 'unauthenticated');
    return nextSession;
  }

  async function logout() {
    try {
      if (session) await api.auth.logout();
    } finally {
      await clearStoredSession();
      setSession(null);
      setStatus('unauthenticated');
    }
  }

  const value = useMemo(() => ({ session, status, error, login, register, refresh, logout }), [session, status, error]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
