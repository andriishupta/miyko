import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'react-native';

import { api, ApiError } from '@/api/client';
import type { ApiDelivery } from '@/api/types';
import { DeliveryCard } from '@/components/delivery-card';
import { MiykoText, PrimaryButton, ScreenScroll, SectionTitle, Surface } from '@/components/miyko-ui';
import { formatSchedule } from '@/api/presenters';
import { useTheme } from '@/hooks/use-theme';

export default function DeliveriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [deliveries, setDeliveries] = useState<ApiDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.deliveries.all()
      .then(setDeliveries)
      .catch((cause) => setError(cause instanceof ApiError ? cause.message : 'Could not load deliveries.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: 'All deliveries', headerLargeTitle: true }} />
      <ScreenScroll bottomInset={insets.bottom + 112}>
        <View style={{ gap: 6 }}><MiykoText variant="body" color="textSecondary">Every grocery run returned by the MiyKo API.</MiykoText><MiykoText variant="caption" color="textSecondary">{deliveries.length} deliveries</MiykoText></View>
        <SectionTitle title="Deliveries" />
        {loading ? <ActivityIndicator color={theme.accent} /> : error ? <Surface><MiykoText variant="section">Deliveries unavailable</MiykoText><MiykoText variant="body" color="textSecondary">{error}</MiykoText><PrimaryButton label="Try again" onPress={() => router.replace('/home/deliveries')} /></Surface> : deliveries.length === 0 ? <Surface><MiykoText variant="section">No deliveries yet</MiykoText><MiykoText variant="body" color="textSecondary">The API returned an empty delivery history.</MiykoText></Surface> : deliveries.map((delivery) => <DeliveryCard key={delivery.id} title="Grocery delivery" date={delivery.scheduledFrom ? formatSchedule(delivery.scheduledFrom) : 'Schedule unavailable'} status={delivery.status === 'scheduled' ? 'Scheduled' : delivery.status === 'delivered' ? 'Delivered' : delivery.status === 'cancelled' ? 'Cancelled' : 'Pending'} total="—" onPress={() => router.push(`/home/delivery/${delivery.id}`)} />)}
      </ScreenScroll>
    </>
  );
}
