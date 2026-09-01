import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FAB } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, EmptyState, IconButton, MiykoText, ScreenScroll, SectionTitle, StatusPill, Surface } from '@/components/miyko-ui';
import { Radius, Spacing } from '@/constants/theme';
import { DeliveryCard } from '@/components/delivery-card';
import { deliveries, household, plannerDays } from '@/data/mock-data';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedDay, setSelectedDay] = useState('today');
  const [audioState, setAudioState] = useState<'idle' | 'recording' | 'saved'>('idle');
  const selectedPlannerDay = plannerDays.find((day) => day.id === selectedDay) ?? plannerDays[0];

  function recordAudio() {
    if (audioState === 'recording') return;
    setAudioState('recording');
    setTimeout(() => setAudioState('saved'), 900);
    setTimeout(() => setAudioState('idle'), 2500);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Home', headerLargeTitle: true, headerRight: () => <IconButton name="gear" label="Open settings" onPress={() => router.push('/home/settings')} /> }} />
      <ScreenScroll bottomInset={insets.bottom + 112}>
        <View style={styles.greetingRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <MiykoText variant="caption" color="textSecondary">Good morning, Andrii</MiykoText>
            <MiykoText variant="title">Let&apos;s make food easy.</MiykoText>
          </View>
          <Pressable onPress={() => router.push('/household')} style={({ pressed }) => [styles.householdButton, { backgroundColor: theme.accentSoft }, pressed && styles.pressed]}><MiykoText variant="label" color="accent">{household.initials}</MiykoText></Pressable>
        </View>

        <Surface style={styles.summaryCard}>
          <View style={styles.summaryHeader}><View style={{ flex: 1, gap: 3 }}><MiykoText variant="caption" color="textSecondary">YOUR NEXT MEAL</MiykoText><MiykoText variant="section">Carbonara dinner</MiykoText></View><StatusPill label="Today" tone="accent" /></View>
          <MiykoText variant="body" color="textSecondary">Ingredients are ready for 5 portions across two days.</MiykoText>
          <View style={styles.summaryFooter}><View style={styles.meta}><AppIcon name="person" size={16} color={theme.textSecondary} /><MiykoText variant="caption" color="textSecondary">3 people</MiykoText></View><Pressable onPress={() => router.push('/home/delivery/carbonara')} hitSlop={8}><MiykoText variant="label" color="accent">View delivery →</MiykoText></Pressable></View>
        </Surface>

        <View style={styles.audioBlock}>
          <MiykoText variant="caption" color="textSecondary">HAVE AN IDEA?</MiykoText>
          <FAB accessibilityLabel="Record a food intention" icon={() => <AppIcon name="mic" size={30} color={theme.accentContrast} />} loading={audioState === 'recording'} disabled={audioState === 'recording'} color={theme.accentContrast} customSize={84} mode="elevated" style={[styles.audioButton, { backgroundColor: theme.accent }]} onPress={recordAudio} />
          <MiykoText variant="section">{audioState === 'recording' ? 'Listening…' : audioState === 'saved' ? 'Saved to your intentions' : 'Record an audio idea'}</MiykoText>
          <MiykoText variant="caption" color="textSecondary" style={styles.centerText}>{audioState === 'idle' ? 'Tell MiyKo what you want to eat next.' : 'Mock voice input — the real flow comes later.'}</MiykoText>
          <Pressable onPress={() => router.push('/home/chat')} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}><View style={styles.chatLink}><MiykoText variant="label" color="accent">Or open chat</MiykoText><AppIcon name="message" size={14} color={theme.accent} /></View></Pressable>
        </View>

        <View style={styles.sectionGap}><SectionTitle title="This week" /><View style={styles.daysRow}>{plannerDays.map((day) => { const isSelected = day.id === selectedDay; return <Pressable key={day.id} onPress={() => setSelectedDay(day.id)} style={({ pressed }) => [styles.dayButton, { backgroundColor: isSelected ? theme.accent : theme.backgroundElement, borderColor: isSelected ? theme.accent : theme.border }, pressed && styles.pressed]}><MiykoText variant="caption" color={isSelected ? 'accentContrast' : 'textSecondary'}>{day.day}</MiykoText><MiykoText variant="label" color={isSelected ? 'accentContrast' : 'text'}>{day.date.split(' ')[0]}</MiykoText></Pressable>; })}</View></View>

        <View style={styles.sectionGap}><View style={styles.sectionHeading}><MiykoText variant="section">{selectedPlannerDay.day}&apos;s plan</MiykoText><MiykoText variant="caption" color="textSecondary">{selectedPlannerDay.events.length} events</MiykoText></View>{selectedPlannerDay.events.length === 0 ? <EmptyState title="Nothing planned yet" detail="Record an idea and MiyKo will help shape it." /> : selectedPlannerDay.events.map((event) => <MealCard key={event.id} event={event} onDelivery={() => event.deliveryId && router.push(`/home/delivery/${event.deliveryId}`)} />)}</View>

        <View style={styles.sectionGap}><SectionTitle title="Upcoming deliveries" action="See all" onAction={() => router.push('/home/deliveries')} />{deliveries.slice(0, 2).map((delivery) => <DeliveryCard key={delivery.id} title={delivery.title} date={delivery.date} status={delivery.status} total={delivery.total} onPress={() => router.push(`/home/delivery/${delivery.id}`)} />)}</View>
      </ScreenScroll>
    </>
  );
}

function MealCard({ event, onDelivery }: { event: (typeof plannerDays)[number]['events'][number]; onDelivery: () => void }) {
  const theme = useTheme();
  return <Surface style={styles.mealCard}><View style={[styles.eventDot, { backgroundColor: theme.accent }]} /><View style={{ flex: 1, gap: 3 }}><MiykoText variant="section">{event.title}</MiykoText><MiykoText variant="body" color="textSecondary">{event.subtitle}</MiykoText><MiykoText variant="caption" color="textSecondary">{event.time}{event.servings ? ` · ${event.servings} portions` : ''}</MiykoText></View>{event.deliveryId && <Pressable onPress={onDelivery} hitSlop={8}><AppIcon name="cart" size={20} color={theme.accent} /></Pressable>}</Surface>;
}

const styles = StyleSheet.create({
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
  pressed: { opacity: 0.68 },
});
