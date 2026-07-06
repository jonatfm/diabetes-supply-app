import AppWrapper from '@/components/AppWrapper';
import { ensureDbReady, useDatabase } from '@/db';
import { ScanFlowProvider } from '@/state/scanFlow';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import { Stack } from 'expo-router';
import { Platform, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MD3DarkTheme, MD3LightTheme, PaperProvider, Text } from 'react-native-paper';

// Only initialize database on native platforms (iOS/Android)
if (Platform.OS !== 'web') {
  ensureDbReady();
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000, // Default 5 seconds
      gcTime: 1000 * 60 * 5, // 5 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false, // Don't refetch on window focus for mobile
    },
  },
});

export default function RootLayout() {
  const { ready: dbReady, rawDb, error } = useDatabase();

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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={paperTheme}>
          <ScanFlowProvider>
            {Platform.OS !== 'web' && <DrizzleStudioConnector rawDb={rawDb} />}
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="holiday_mode/plan_holiday" />
              <Stack.Screen name="scan" />
              <Stack.Screen name="product/[id]" />
              <Stack.Screen name="product/edit/[id]" />
              <Stack.Screen name="product/settings/[id]" />
              <Stack.Screen name="product/lastConsumedItem/[id]" />
              <Stack.Screen name="product/settings/add_colored_dots_scan/[id]" />
              <Stack.Screen name="new/add_pack" />
              <Stack.Screen name="new/choose_existing_product" />
              <Stack.Screen name="new/new_product" />
              <Stack.Screen name="new/take_product_photo" />
            </Stack>
          </ScanFlowProvider>
        </PaperProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function DrizzleStudioConnector({ rawDb }: { rawDb: any }) {
  useDrizzleStudio(rawDb ?? undefined);
  return null;
}
