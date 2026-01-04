import { ensureDbReady } from '@/db';
import { ScanFlowProvider } from '@/state/scanFlow';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { Stack } from 'expo-router';
import { Platform, useColorScheme } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper';

// Only initialize database on native platforms (iOS/Android)
if (Platform.OS !== 'web') {
  ensureDbReady();
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const {theme} = useMaterial3Theme();

  const paperTheme =
    scheme === "dark"
    ? {...MD3DarkTheme, colors: {...MD3DarkTheme.colors, ...theme.dark}}
    : {...MD3LightTheme, colors: {...MD3LightTheme.colors, ...theme.light}};

  return (
    <PaperProvider theme={paperTheme}>
      <ScanFlowProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ScanFlowProvider>
    </PaperProvider>
  );
}
