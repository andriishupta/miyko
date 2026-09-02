import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AppSession } from '@/api/types';

const SESSION_KEY = 'miyko.session';

async function readValue() {
  if (Platform.OS === 'web') {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(SESSION_KEY);
  }

  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function getStoredSession(): Promise<AppSession | null> {
  const raw = await readValue();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AppSession;
  } catch {
    await clearStoredSession();
    return null;
  }
}

export async function storeSession(session: AppSession) {
  const value = JSON.stringify(session);
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SESSION_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(SESSION_KEY, value);
}

export async function clearStoredSession() {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(SESSION_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(SESSION_KEY);
}
