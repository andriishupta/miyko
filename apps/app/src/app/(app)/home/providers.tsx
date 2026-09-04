import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProviderManagement } from '@/components/provider-management';
import { ScreenScroll } from '@/components/miyko-ui';

export default function ProvidersScreen() {
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ title: 'Store providers' }} />
      <ScreenScroll bottomInset={insets.bottom + 112}>
        <ProviderManagement />
      </ScreenScroll>
    </>
  );
}
