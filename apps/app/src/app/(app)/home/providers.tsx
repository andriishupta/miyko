import { Stack } from 'expo-router';

import { ProviderManagement } from '@/components/provider-management';
import { ScreenScroll } from '@/components/miyko-ui';

export default function ProvidersScreen() {

  return (
    <>
      <Stack.Screen options={{ title: 'Store account' }} />
      <ScreenScroll>
        <ProviderManagement />
      </ScreenScroll>
    </>
  );
}
