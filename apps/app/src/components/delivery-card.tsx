import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon, MiykoText, StatusPill, Surface } from '@/components/miyko-ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function DeliveryCard({ title, date, status, total, onPress }: { title: string; date: string; status: string; total: string; onPress: () => void }) {
  const theme = useTheme();
  const tone = status === 'Approved' || status === 'Delivered' ? 'success' : status === 'Proposed' || status === 'Planned' || status === 'Scheduled' ? 'warning' : 'neutral';
  return <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}><Surface style={styles.card}><View style={[styles.icon, { backgroundColor: theme.accentSoft }]}><AppIcon name="cart" size={20} color={theme.accent} /></View><View style={{ flex: 1, gap: 3 }}><MiykoText variant="section">{title}</MiykoText><MiykoText variant="caption" color="textSecondary">{date}</MiykoText><StatusPill label={status} tone={tone} /></View><View style={styles.right}><MiykoText variant="label">{total}</MiykoText><AppIcon name="chevron" size={18} color={theme.textSecondary} /></View></Surface></Pressable>;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  icon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pressed: { opacity: 0.68 },
});
