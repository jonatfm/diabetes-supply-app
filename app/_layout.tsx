import { Stack } from 'expo-router';
import { Platform } from 'react-native';

// Only initialize database on native platforms (iOS/Android)
if (Platform.OS !== 'web') {
  const { ensureDbReady } = require('@/db/migrate');
  ensureDbReady();
}

export default function RootLayout() {
  return <Stack />;
}
