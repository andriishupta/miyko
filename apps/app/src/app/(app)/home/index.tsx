import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FAB } from 'react-native-paper';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError } from '@/api/client';
import type { ApiDashboard, ApiDelivery } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { AppIcon, EmptyState, IconButton, MiykoText, PrimaryButton, ScreenScroll, SectionTitle, StatusPill, Surface } from '@/components/miyko-ui';
import { Radius, Spacing } from '@/constants/theme';
import { formatMoney, formatSchedule } from '@/api/presenters';
import { useTheme } from '@/hooks/use-theme';

function dateKey(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function dayLabel(date: string, offset: number) {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(`${date}T12:00:00`));
}

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [selectedDate, setSelectedDate] = useState(dateKey(0));
  const [dashboard, setDashboard] = useState<ApiDashboard | null>(null);
  const [deliveries, setDeliveries] = useState<ApiDelivery[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deliveriesError, setDeliveriesError] = useState<string | null>(null);
  const [audioState, setAudioState] = useState<'idle' | 'unavailable'>('idle');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setDashboardLoading(true);
    setError(null);
    api.dashboard.get(selectedDate)
      .then((nextDashboard) => { if (active) setDashboard(nextDashboard); })
      .catch((cause) => { if (active) setError(cause instanceof ApiError ? cause.message : 'Could not load dashboard.'); })
      .finally(() => { if (active) setDashboardLoading(false); });
    return () => { active = false; };
  }, [retryKey, selectedDate]);

  useEffect(() => {
    let active = true;
    setDeliveriesError(null);
    api.deliveries.all()
      .then((nextDeliveries) => { if (active) setDeliveries(nextDeliveries); })
      .catch((cause) => { if (active) setDeliveriesError(cause instanceof ApiError ? cause.message : 'Could not load deliveries.'); })
      .finally(() => { if (active) setDeliveriesLoading(false); });
    return () => { active = false; };
  }, []);

  const plannerDays = useMemo(() => Array.from({ length: 4 }, (_, offset) => ({ date: dateKey(offset), label: dayLabel(dateKey(offset), offset) })), []);
  const userName = session?.user.displayName || session?.user.email || 'there';

  if (dashboardLoading && !dashboard) {
    return <ScreenScroll bottomInset={insets.bottom + 112} contentContainerStyle={styles.centered}><ActivityIndicator color={theme.accent} /></ScreenScroll>;
  }

  if (!dashboard) {
    return <ScreenScroll bottomInset={insets.bottom + 112}><Surface><MiykoText variant="section">Dashboard unavailable</MiykoText><MiykoText variant="body" color="textSecondary">{error ?? 'The API did not return dashboard data.'}</MiykoText><PrimaryButton label="Try again" onPress={() => setRetryKey((value) => value + 1)} /></Surface></ScreenScroll>;
  }

  const events = dashboard.upcomingEvents;
  const latest = dashboard.latestDelivery;
  const pendingApprovals = dashboard.householdSummary.pendingApprovals;

  return (
    <>
      <Stack.Screen options={{ title: 'Home', headerLargeTitle: true, headerRight: () => <IconButton name="gear" label="Open settings" onPress={() => router.push('/home/settings')} /> }} />
      <ScreenScroll bottomInset={insets.bottom + 112}>
        <View style={styles.greetingRow}>
          <View style={{ flex: 1, gap: 4 }}><MiykoText variant="caption" color="textSecondary">Good morning, {userName}</MiykoText><MiykoText variant="title">Let&apos;s make food easy.</MiykoText></View>
          <Pressable onPress={() => router.push('/household')} style={({ pressed }) => [styles.householdButton, { backgroundColor: theme.accentSoft }, pressed && styles.pressed]}><MiykoText variant="label" color="accent">{dashboard.household.name.slice(0, 2).toUpperCase()}</MiykoText></Pressable>
        </View>

        <Surface style={styles.summaryCard}>
          <View style={styles.summaryHeader}><View style={{ flex: 1, gap: 3 }}><MiykoText variant="caption" color="textSecondary">NEXT FOOD PLAN</MiykoText><MiykoText variant="section">{dashboard.planning.title ?? 'No active meal plan'}</MiykoText></View><StatusPill label={pendingApprovals ? `${pendingApprovals} review` : dashboard.planning.status} tone={pendingApprovals ? 'warning' : 'accent'} /></View>
          <MiykoText variant="body" color="textSecondary">{dashboard.householdSummary.memberCount} household members · {dashboard.householdSummary.connectedShoppingAccounts} shopping account{dashboard.householdSummary.connectedShoppingAccounts === 1 ? '' : 's'} connected.</MiykoText>
          {latest && <View style={styles.summaryFooter}><View style={styles.meta}><AppIcon name="cart" size={16} color={theme.textSecondary} /><MiykoText variant="caption" color="textSecondary">Latest {formatMoney(latest.total, latest.currency)}</MiykoText></View><Pressable onPress={() => router.push(`/home/delivery/${latest.id}`)} hitSlop={8}><MiykoText variant="label" color="accent">View delivery →</MiykoText></Pressable></View>}
        </Surface>

        <View style={styles.audioBlock}><MiykoText variant="caption" color="textSecondary">HAVE AN IDEA?</MiykoText><FAB accessibilityLabel="Audio input is not connected" icon={() => <AppIcon name="mic" size={30} color={theme.accentContrast} />} color={theme.accentContrast} customSize={84} mode="elevated" style={[styles.audioButton, { backgroundColor: theme.accent }]} onPress={() => setAudioState('unavailable')} /><MiykoText variant="section">Record an audio idea</MiykoText><MiykoText variant="caption" color="textSecondary" style={styles.centerText}>{audioState === 'unavailable' ? 'Audio capture is not wired in the app yet.' : 'The API endpoint is ready for an audio file upload.'}</MiykoText><Pressable onPress={() => router.push('/home/chat')} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}><View style={styles.chatLink}><MiykoText variant="label" color="accent">Or open chat</MiykoText><AppIcon name="message" size={14} color={theme.accent} /></View></Pressable></View>

        <View style={styles.sectionGap}><SectionTitle title="This week" /><View style={styles.daysRow}>{plannerDays.map((day) => { const isSelected = day.date === selectedDate; return <Pressable key={day.date} onPress={() => setSelectedDate(day.date)} style={({ pressed }) => [styles.dayButton, { backgroundColor: isSelected ? theme.accent : theme.backgroundElement, borderColor: isSelected ? theme.accent : theme.border }, pressed && styles.pressed]}><MiykoText variant="caption" color={isSelected ? 'accentContrast' : 'textSecondary'}>{day.label}</MiykoText><MiykoText variant="label" color={isSelected ? 'accentContrast' : 'text'}>{day.date.slice(8)}</MiykoText></Pressable>; })}</View></View>

        <View style={styles.sectionGap}><View style={styles.sectionHeading}><MiykoText variant="section">Plan for {selectedDate === dateKey(0) ? 'today' : selectedDate}</MiykoText><MiykoText variant="caption" color="textSecondary">{events.length} events</MiykoText></View>{events.length === 0 ? <EmptyState title="Nothing planned yet" detail="There are no events for this date." /> : events.map((event) => <MealCard key={event.id} event={event} />)}</View>

        <View style={styles.sectionGap}><SectionTitle title="Upcoming deliveries" action="See all" onAction={() => router.push('/home/deliveries')} />{deliveriesLoading ? <ActivityIndicator color={theme.accent} /> : deliveriesError ? <MiykoText variant="caption" color="danger">{deliveriesError}</MiykoText> : deliveries.length === 0 ? <EmptyState title="No deliveries yet" detail="The API has not returned any grocery deliveries." /> : deliveries.slice(0, 2).map((delivery) => <DeliverySummaryCard key={delivery.id} delivery={delivery} onPress={() => router.push(`/home/delivery/${delivery.id}`)} />)}</View>
      </ScreenScroll>
    </>
  );
}

function MealCard({ event }: { event: ApiDashboard['upcomingEvents'][number] }) {
  const theme = useTheme();
  return <Surface style={styles.mealCard}><View style={[styles.eventDot, { backgroundColor: theme.accent }]} /><View style={{ flex: 1, gap: 3 }}><MiykoText variant="section">{event.title}</MiykoText><MiykoText variant="body" color="textSecondary">{event.type}</MiykoText><MiykoText variant="caption" color="textSecondary">{formatSchedule(event.scheduledFor)}</MiykoText></View></Surface>;
}

function DeliverySummaryCard({ delivery, onPress }: { delivery: ApiDelivery; onPress: () => void }) {
  const theme = useTheme();
  const status = delivery.status === 'scheduled' ? 'Scheduled' : delivery.status === 'delivered' ? 'Delivered' : delivery.status === 'cancelled' ? 'Cancelled' : 'Pending';
  return <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}><Surface style={styles.deliveryCard}><View style={[styles.deliveryIcon, { backgroundColor: theme.accentSoft }]}><AppIcon name="cart" size={20} color={theme.accent} /></View><View style={{ flex: 1, gap: 3 }}><MiykoText variant="section">Grocery delivery</MiykoText><MiykoText variant="caption" color="textSecondary">{delivery.scheduledFrom ? formatSchedule(delivery.scheduledFrom) : 'Schedule unavailable'}</MiykoText><StatusPill label={status} tone={delivery.status === 'scheduled' ? 'warning' : delivery.status === 'delivered' ? 'success' : 'neutral'} /></View><View style={styles.right}><AppIcon name="chevron" size={18} color={theme.textSecondary} /></View></Surface></Pressable>;
}

const styles = StyleSheet.create({
  centered: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  householdButton: { width: 46, height: 46, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  summaryCard: { gap: Spacing.three },
  summaryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  summaryFooter: { paddingTop: Spacing.two, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  audioBlock: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  audioButton: { width: 84, height: 84, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  chatLink: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sectionGap: { gap: Spacing.two },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  daysRow: { flexDirection: 'row', gap: Spacing.two },
  dayButton: { flex: 1, minHeight: 64, borderWidth: 1, borderRadius: Radius.small, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', gap: 3 },
  mealCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  eventDot: { width: 10, height: 10, borderRadius: Radius.pill },
  deliveryCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  deliveryIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pressed: { opacity: 0.68 },
});
