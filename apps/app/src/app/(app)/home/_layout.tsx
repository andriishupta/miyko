import { Stack } from 'expo-router';

export default function HomeStackLayout() {
  return <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal', headerShadowVisible: false }} />;
}
