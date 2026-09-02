import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native-paper';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiError } from '@/api/client';
import type { ApiDeliveryDetails } from '@/api/types';
import { presentDelivery } from '@/api/presenters';
import { AppIcon, EmptyState, MiykoText, PrimaryButton, ScreenScroll, SecondaryButton, StatusPill, Surface } from '@/components/miyko-ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function DeliveryDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [delivery, setDelivery] = useState<ApiDeliveryDetails | null>(null);
  const [productNames, setProductNames] = useState<Record<string, { name: string; unit: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    api.deliveries.details(id)
      .then(async (nextDelivery) => {
        if (!active) return;
        setDelivery(nextDelivery);
        const products = await Promise.all((nextDelivery.order?.items ?? []).filter((item) => item.productId).map((item) => api.products.details(item.productId!).catch(() => null)));
        if (active) setProductNames(Object.fromEntries(products.filter(Boolean).map((result) => [result!.product.id, { name: result!.product.name, unit: result!.product.unit }])));
      })
      .catch((cause) => { if (active) setError(cause instanceof ApiError ? cause.message : 'Could not load delivery.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

  if (loading) return <ScreenScroll bottomInset={insets.bottom + 112} contentContainerStyle={styles.centered}><ActivityIndicator color={theme.accent} /></ScreenScroll>;
  if (!delivery) return <ScreenScroll bottomInset={insets.bottom + 112}><MiykoText variant="title">Delivery</MiykoText><EmptyState title="Delivery unavailable" detail={error ?? 'The API did not return this delivery.'} /></ScreenScroll>;

  const view = presentDelivery(delivery.delivery, delivery.order, productNames);
  const tone = delivery.delivery.status === 'scheduled' ? 'warning' : delivery.delivery.status === 'delivered' ? 'success' : 'neutral';
  const proposalId = delivery.order?.proposalId;
  return (
    <>
      <Stack.Screen options={{ title: view.title }} />
      <ScreenScroll bottomInset={insets.bottom + 112}>
        <Surface style={styles.heroCard}><View style={[styles.deliveryBadge, { backgroundColor: theme.accentSoft }]}><AppIcon name="cart" size={26} color={theme.accent} /></View><MiykoText variant="title">{view.title}</MiykoText><StatusPill label={view.status} tone={tone} /><MiykoText variant="body" color="textSecondary">{view.date} · {view.eta}</MiykoText>{delivery.delivery.addressReference && <MiykoText variant="caption" color="textSecondary">{delivery.delivery.addressReference}</MiykoText>}</Surface>
        <View style={styles.sectionGap}><View style={styles.sectionHeader}><MiykoText variant="section">Products</MiykoText><MiykoText variant="caption" color="textSecondary">{view.products.length} items</MiykoText></View>{view.products.map((product) => <Surface key={product.id} style={styles.productRow}><View style={[styles.check, { backgroundColor: theme.accentSoft }]}><MiykoText variant="label" color="accent">✓</MiykoText></View><View style={{ flex: 1, gap: 2 }}><MiykoText variant="body">{product.name}</MiykoText><MiykoText variant="caption" color="textSecondary">{product.detail} · {product.quantity}</MiykoText></View><MiykoText variant="label">{product.price}</MiykoText></Surface>)}</View>
        <Surface style={styles.totalCard}><MiykoText variant="body" color="textSecondary">Total</MiykoText><MiykoText variant="title">{view.total}</MiykoText></Surface>
        {delivery.delivery.status === 'pending' && <Surface><MiykoText variant="section">Approval required</MiykoText><MiykoText variant="body" color="textSecondary">Review the proposal before any provider basket action is attempted.</MiykoText>{proposalId ? <PrimaryButton label="Review proposal" icon="cart" onPress={() => router.push(`/home/proposals/${proposalId}`)} /> : <MiykoText variant="caption" color="textSecondary">The API did not return a proposal for this delivery.</MiykoText>}</Surface>}
        <SecondaryButton label="Back to deliveries" onPress={() => router.back()} />
      </ScreenScroll>
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  heroCard: { alignItems: 'flex-start', gap: Spacing.two },
  deliveryBadge: { width: 54, height: 54, borderRadius: Radius.medium, alignItems: 'center', justifyContent: 'center' },
  sectionGap: { gap: Spacing.two },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.two + 2 },
  check: { width: 28, height: 28, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  totalCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
