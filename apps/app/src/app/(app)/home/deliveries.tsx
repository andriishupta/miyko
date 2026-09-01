import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View } from 'react-native';

import { DeliveryCard } from '@/components/delivery-card';
import { MiykoText, ScreenScroll, SectionTitle } from '@/components/miyko-ui';
import { deliveries } from '@/data/mock-data';

export default function DeliveriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ title: 'All deliveries', headerLargeTitle: true }} />
      <ScreenScroll bottomInset={insets.bottom + 112}>
        <View style={{ gap: 6 }}><MiykoText variant="body" color="textSecondary">Every planned, approved and completed grocery run in one place.</MiykoText><MiykoText variant="caption" color="textSecondary">3 mock deliveries</MiykoText></View>
        <SectionTitle title="Deliveries" />
        {deliveries.map((delivery) => <DeliveryCard key={delivery.id} title={delivery.title} date={delivery.date} status={delivery.status} total={delivery.total} onPress={() => router.push(`/home/delivery/${delivery.id}`)} />)}
      </ScreenScroll>
    </>
  );
}
