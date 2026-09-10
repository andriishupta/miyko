import { DarkTheme, DefaultTheme } from 'expo-router';
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

import { Colors } from '@/constants/theme';

export type ThemeMode = keyof typeof Colors;

export function getPaperTheme(mode: ThemeMode) {
  const baseTheme = mode === 'dark' ? MD3DarkTheme : MD3LightTheme;
  const palette = Colors[mode];

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: palette.accent,
      onPrimary: palette.accentContrast,
      primaryContainer: palette.accentSoft,
      onPrimaryContainer: palette.text,
      secondary: palette.accent,
      onSecondary: palette.accentContrast,
      secondaryContainer: palette.backgroundSelected,
      onSecondaryContainer: palette.text,
      background: palette.background,
      surface: palette.backgroundElement,
      surfaceVariant: palette.backgroundSelected,
      onSurface: palette.text,
      onSurfaceVariant: palette.textSecondary,
      outline: palette.border,
      error: palette.danger,
      onError: palette.accentContrast,
    },
  };
}

export function getNavigationTheme(mode: ThemeMode) {
  const baseTheme = mode === 'dark' ? DarkTheme : DefaultTheme;
  const palette = Colors[mode];

  return {
    ...baseTheme,
    dark: mode === 'dark',
    colors: {
      ...baseTheme.colors,
      primary: palette.accent,
      background: palette.background,
      card: palette.background,
      text: palette.text,
      border: palette.border,
      notification: palette.accent,
    },
  };
}
