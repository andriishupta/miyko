import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, EmptyState, MiykoText, PrimaryButton, ScreenScroll, StatusPill, Surface } from '@/components/miyko-ui';
import { Radius, Spacing } from '@/constants/theme';
import { deliveries } from '@/data/mock-data';
import { useTheme } from '@/hooks/use-theme';

export default function DeliveryDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const delivery = deliveries.find((item) => item.id === id);

  if (!delivery) return <ScreenScroll><MiykoText variant="title">Delivery</MiykoText><EmptyState title="Delivery not found" detail="This mock delivery is no longer available." /></ScreenScroll>;

  const tone = delivery.status === 'Approved' ? 'success' : delivery.status === 'Proposed' ? 'warning' : 'neutral';
  return (
    <>
      <Stack.Screen options={{ title: delivery.title }} />
      <ScreenScroll bottomInset={insets.bottom + 112}>
        <Surface style={styles.heroCard}><View style={[styles.deliveryBadge, { backgroundColor: theme.accentSoft }]}><AppIcon name="cart" size={26} color={theme.accent} /></View><MiykoText variant="title">{delivery.title}</MiykoText><StatusPill label={delivery.status} tone={tone} /><MiykoText variant="body" color="textSecondary">{delivery.date} · {delivery.eta}</MiykoText>{delivery.linkedMeal && <View style={styles.linkedMeal}><MiykoText variant="caption" color="textSecondary">LINKED MEAL</MiykoText><MiykoText variant="body">{delivery.linkedMeal}</MiykoText></View>}</Surface>

        <View style={styles.sectionGap}><View style={styles.sectionHeader}><MiykoText variant="section">Products</MiykoText><MiykoText variant="caption" color="textSecondary">{delivery.products.length} items</MiykoText></View>{delivery.products.map((product) => <Surface key={product.id} style={styles.productRow}><View style={[styles.check, { backgroundColor: theme.accentSoft }]}><MiykoText variant="label" color="accent">✓</MiykoText></View><View style={{ flex: 1, gap: 2 }}><MiykoText variant="body">{product.name}</MiykoText><MiykoText variant="caption" color="textSecondary">{product.detail} · {product.quantity}</MiykoText></View><MiykoText variant="label">{product.price}</MiykoText></Surface>)}</View>

        <Surface style={styles.totalCard}><MiykoText variant="body" color="textSecondary">Estimated total</MiykoText><MiykoText variant="title">{delivery.total}</MiykoText></Surface>
        {delivery.status === 'Proposed' && <PrimaryButton label="Approve mock delivery" onPress={() => router.back()} />}
        {delivery.status !== 'Proposed' && <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><MiykoText variant="label" color="accent">Back to Home</MiykoText></Pressable>}
      </ScreenScroll>
    </>
  );
}

const styles = StyleSheet.create({
  heroCard: { alignItems: 'flex-start', gap: Spacing.two },
  deliveryBadge: { width: 54, height: 54, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' },
  linkedMeal: { width: '100%', gap: 3, paddingTop: Spacing.two, marginTop: Spacing.one },
  sectionGap: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.two + 2 },
  check: { width: 28, height: 28, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  totalCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backButton: { alignItems: 'center', paddingVertical: Spacing.two },
  pressed: { opacity: 0.68 },
});
