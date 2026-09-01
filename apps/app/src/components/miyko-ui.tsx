import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar as PaperAvatar, Button, Chip, IconButton as PaperIconButton, Surface as PaperSurface, Text as PaperText, TextInput as PaperTextInput } from 'react-native-paper';

import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SymbolName = 'house' | 'calendar' | 'gear' | 'mic' | 'message' | 'chevron' | 'cart' | 'person' | 'plus' | 'arrow';

const symbols = {
  house: { ios: 'house.fill', android: 'home', web: 'home' },
  calendar: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
  gear: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
  mic: { ios: 'mic.fill', android: 'mic', web: 'mic' },
  message: { ios: 'bubble.left.and.bubble.right.fill', android: 'chat', web: 'chat' },
  chevron: { ios: 'chevron.right', android: 'chevron_forward', web: 'chevron_forward' },
  cart: { ios: 'cart.fill', android: 'add_shopping_cart', web: 'add_shopping_cart' },
  person: { ios: 'person.fill', android: 'person', web: 'person' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  arrow: { ios: 'arrow.up.right', android: 'arrow_upward', web: 'arrow_upward' },
} as const;

export function AppIcon({ name, size = 20, color, ...props }: { name: SymbolName; size?: number; color?: string } & Omit<ComponentProps<typeof SymbolView>, 'name' | 'size' | 'tintColor'>) {
  return <SymbolView name={symbols[name]} size={size} tintColor={color} {...props} />;
}

export function MiykoText({ variant = 'body', color = 'text', style, ...props }: ComponentProps<typeof PaperText> & { variant?: 'hero' | 'title' | 'section' | 'body' | 'caption' | 'label'; color?: ThemeColor }) {
  const theme = useTheme();
  return <PaperText selectable variant={paperVariants[variant]} style={[{ color: theme[color] }, style]} {...props} />;
}

export function MiykoLogo({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  return <View style={styles.logoRow}><View style={[styles.logoMark, { backgroundColor: theme.accent }]}><MiykoText color="accentContrast" variant="label">M</MiykoText></View>{!compact && <MiykoText variant="section">MiyKo</MiykoText>}</View>;
}

export function Surface({ children, style, ...props }: ComponentProps<typeof PaperSurface>) {
  const theme = useTheme();
  return <PaperSurface {...props} mode="flat" style={[styles.surface, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, style]}>{children}</PaperSurface>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const theme = useTheme();
  return <View style={styles.sectionHeading}><MiykoText variant="section">{title}</MiykoText>{action && onAction && <Button mode="text" compact onPress={onAction} textColor={theme.accent} contentStyle={styles.sectionActionContent} labelStyle={styles.sectionActionLabel} uppercase={false}>{action}</Button>}<View style={[styles.headingRule, { backgroundColor: theme.border }]} /></View>;
}

export function PrimaryButton({ label, onPress, loading = false, icon }: { label: string; onPress: () => void; loading?: boolean; icon?: SymbolName }) {
  const theme = useTheme();
  return <Button accessibilityRole="button" mode="contained" onPress={onPress} disabled={loading} loading={loading} buttonColor={theme.accent} textColor={theme.accentContrast} icon={icon ? () => <AppIcon name={icon} size={18} color={theme.accentContrast} /> : undefined} contentStyle={styles.buttonContent} style={styles.primaryButton} labelStyle={styles.buttonLabel} uppercase={false}>{loading ? 'Opening…' : label}</Button>;
}

export function SecondaryButton({ label, onPress, icon }: { label: string; onPress: () => void; icon?: SymbolName }) {
  const theme = useTheme();
  return <Button accessibilityRole="button" mode="outlined" onPress={onPress} textColor={theme.accent} icon={icon ? () => <AppIcon name={icon} size={17} color={theme.accent} /> : undefined} contentStyle={styles.buttonContent} style={[styles.secondaryButton, { borderColor: theme.border }]} labelStyle={styles.buttonLabel} uppercase={false}>{label}</Button>;
}

export function IconButton({ name, label, onPress }: { name: SymbolName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return <PaperIconButton accessibilityLabel={label} icon={() => <AppIcon name={name} size={20} color={theme.text} />} iconColor={theme.text} containerColor={theme.backgroundElement} size={20} onPress={onPress} style={styles.iconButton} />;
}

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'accent' | 'warning' | 'success' }) {
  const theme = useTheme();
  const color = tone === 'accent' ? theme.accent : tone === 'warning' ? theme.warning : tone === 'success' ? theme.success : theme.textSecondary;
  return <Chip compact mode="flat" icon={() => <View style={[styles.pillDot, { backgroundColor: color }]} />} style={[styles.pill, { backgroundColor: tone === 'neutral' ? theme.backgroundSelected : theme.accentSoft }]} textStyle={[styles.pillText, { color }]}>{label}</Chip>;
}

export function Avatar({ initials, color }: { initials: string; color: string }) {
  const theme = useTheme();
  return <PaperAvatar.Text size={44} label={initials} color={theme.text} labelStyle={styles.avatarLabel} style={{ backgroundColor: color }} />;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  const theme = useTheme();
  return <Surface style={[styles.emptyState, { borderColor: theme.border }]}><View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSelected }]}><AppIcon name="calendar" size={22} color={theme.accent} /></View><MiykoText variant="section">{title}</MiykoText><MiykoText variant="body" color="textSecondary" style={styles.centerText}>{detail}</MiykoText></Surface>;
}

export function Field({ label, placeholder, value, onChangeText }: { label: string; placeholder: string; value: string; onChangeText: (value: string) => void }) {
  const theme = useTheme();
  return <PaperTextInput mode="outlined" label={label} value={value} onChangeText={onChangeText} placeholder={placeholder} textColor={theme.text} outlineColor={theme.border} activeOutlineColor={theme.accent} style={styles.input} />;
}

export function ScreenScroll({ children, bottomInset = 32, contentContainerStyle, ...props }: ComponentProps<typeof ScrollView> & { bottomInset?: number }) {
  return <ScrollView {...props} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.screenContent, { paddingBottom: bottomInset }, contentContainerStyle]}>{children}</ScrollView>;
}

const styles = StyleSheet.create({
  screenContent: { padding: Spacing.four, gap: Spacing.four },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  logoMark: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderCurve: 'continuous' },
  hero: { fontSize: 36, lineHeight: 40, fontWeight: '700', letterSpacing: -1 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
  section: { fontSize: 19, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '500' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  surface: { borderWidth: 1, borderRadius: Radius.medium, borderCurve: 'continuous', padding: Spacing.three, gap: Spacing.two },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headingRule: { height: 1, flex: 1, opacity: 0.65 },
  sectionActionContent: { paddingHorizontal: 0 },
  sectionActionLabel: { fontSize: 13, fontWeight: '700' },
  buttonContent: { minHeight: 52 },
  primaryButton: { borderRadius: Radius.pill, borderCurve: 'continuous' },
  secondaryButton: { borderRadius: Radius.pill, borderCurve: 'continuous' },
  buttonLabel: { fontSize: 14, fontWeight: '700' },
  iconButton: { margin: 0, borderRadius: Radius.pill },
  pill: { alignSelf: 'flex-start', borderRadius: Radius.pill },
  pillText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  pillDot: { width: 7, height: 7, borderRadius: Radius.pill },
  avatarLabel: { fontSize: 14, fontWeight: '700' },
  emptyState: { alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.five, borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.medium },
  emptyIcon: { width: 48, height: 48, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  input: { fontSize: 16 },
});

const paperVariants = { hero: 'displaySmall', title: 'headlineMedium', section: 'titleLarge', body: 'bodyLarge', caption: 'bodySmall', label: 'labelLarge' } as const;
