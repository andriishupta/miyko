/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/** Brand orange sampled from the Silpo repeat-order asset gradient. */
export const Brand = {
  orange: '#F1842A',
} as const;

export const Colors = {
  light: {
    text: '#241A15',
    background: '#FFF9F5',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#FFF0E6',
    textSecondary: '#77675E',
    border: '#EADFD8',
    accent: Brand.orange,
    accentSoft: '#FFE2D2',
    accentContrast: '#FFFFFF',
    warning: '#A64B13',
    success: '#31724C',
    danger: '#B94D45',
  },
  dark: {
    text: '#FFF7F2',
    background: '#17110D',
    backgroundElement: '#241A15',
    backgroundSelected: '#3A2519',
    textSecondary: '#C8B1A5',
    border: '#4A3327',
    accent: Brand.orange,
    accentSoft: '#4B2D1F',
    accentContrast: '#2A160C',
    warning: '#FFB169',
    success: '#98D8A9',
    danger: '#FF9387',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Radius = {
  small: 12,
  medium: 18,
  large: 28,
  pill: 999,
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
