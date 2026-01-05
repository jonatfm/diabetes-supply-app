import AppWrapper from '@/components/AppWrapper';
import { ensureDbReady, useDatabase } from '@/db';
import { ScanFlowProvider } from '@/state/scanFlow';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { Stack } from 'expo-router';
import { Platform, useColorScheme } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, PaperProvider, Text } from 'react-native-paper';

// Only initialize database on native platforms (iOS/Android)
if (Platform.OS !== 'web') {
  ensureDbReady();
}

const queryClient = new QueryClient();

export default function RootLayout() {
  const { db, ready: dbReady, rawDb, error } = useDatabase();

  if (Platform.OS !== 'web') {
    useDrizzleStudio(rawDb ?? undefined);
  }

  const scheme = useColorScheme();
  const {theme} = useMaterial3Theme();

  const paperTheme =
    scheme === "dark"
    ? {...MD3DarkTheme, colors: {...MD3DarkTheme.colors, ...theme.dark}}
    : {...MD3LightTheme, colors: {...MD3LightTheme.colors, ...theme.light}};

  if (!dbReady) {
    return (
      <AppWrapper>
        <Text>Loading...</Text>
        {error && <Text style={{ color: 'red' }}>Error: {error.message}</Text>}
      </AppWrapper>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={paperTheme}>
        <ScanFlowProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ScanFlowProvider>
      </PaperProvider>
    </QueryClientProvider>
  );
}
