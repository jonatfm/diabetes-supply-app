import AppWrapper from '@/components/AppWrapper';
import { ensureDbReady, useDatabase } from '@/db';
import { appSettingsRepo } from '@/src/data/appSettingsRepo';
import { GoogleDriveBackupFrequency, performGoogleDriveBackup, shouldRunGoogleDriveBackup } from '@/src/data/hooks/useGoogleDriveBackup';
import { BackupFrequency, performLocalBackup, shouldRunBackup } from '@/src/data/hooks/useLocalBackup';
import { refreshScheduledInventoryNotifications } from '@/src/services/notificationService';
import { ScanFlowProvider } from '@/state/scanFlow';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useDrizzleStudio } from "expo-drizzle-studio-plugin";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
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
            <NotificationScheduler />
            <NotificationDeepLinkHandler />
            <LocalAutoBackup />
            <GoogleDriveAutoBackup />
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

function NotificationDeepLinkHandler() {
  const router = useRouter();
  const handledNotificationRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const handleResponse = (response: Notifications.NotificationResponse) => {
      const request = response.notification.request;
      if (handledNotificationRef.current === request.identifier) {
        return;
      }

      const productId = request.content.data?.productId;
      if (typeof productId !== "string" || !productId) {
        return;
      }

      handledNotificationRef.current = request.identifier;
      router.push({
        pathname: "/product/[id]",
        params: { id: productId },
      });
    };

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          handleResponse(response);
        }
      })
      .catch((error) => {
        console.warn("Failed to read last notification response", error);
      });

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, [router]);

  return null;
}

function LocalAutoBackup() {
  const { db, ready } = useDatabase();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!db || !ready || attemptedRef.current) return;
    attemptedRef.current = true;
    const activeDb = db;

    async function runBackupIfDue() {
      const settings = appSettingsRepo(activeDb);
      const frequency = await settings.getByKey<BackupFrequency>("localBackupFrequency");
      const lastBackupAt = await settings.getByKey<number>("localBackupLastBackupAt");

      if (!shouldRunBackup({ frequency, lastBackupAt })) {
        return;
      }

      const retentionCount = await settings.getByKey<number>("localBackupRetentionCount");
      await performLocalBackup({
        db: activeDb,
        retentionCount: retentionCount ?? 5,
      });
      await settings.upsert("localBackupLastBackupAt", Date.now());
    }

    runBackupIfDue().catch((error) => {
      console.warn("Failed to run local auto-backup", error);
    });
  }, [db, ready]);

  return null;
}

function GoogleDriveAutoBackup() {
  const { db, ready } = useDatabase();
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (!db || !ready || attemptedRef.current) return;
    attemptedRef.current = true;
    const activeDb = db;

    async function runBackupIfDue() {
      const settings = appSettingsRepo(activeDb);
      const advancedDriveEnabled = await settings.getByKey<boolean>("googleDriveBackupAdvancedEnabled");
      if (!advancedDriveEnabled) {
        return;
      }

      const accessToken = await settings.getByKey<string>("googleDriveAccessToken");
      const refreshToken = await settings.getByKey<string>("googleDriveRefreshToken");
      const frequency = await settings.getByKey<GoogleDriveBackupFrequency>("googleDriveBackupFrequency");
      const lastBackupAt = await settings.getByKey<number>("googleDriveLastBackupAt");

      if ((!accessToken?.trim() && !refreshToken?.trim()) || !shouldRunGoogleDriveBackup({ frequency, lastBackupAt })) {
        return;
      }

      const folderId = await settings.getByKey<string>("googleDriveFolderId");
      const retentionCount = await settings.getByKey<number>("googleDriveBackupRetentionCount");

      await performGoogleDriveBackup({
        db: activeDb,
        folderId,
        retentionCount: retentionCount ?? 5,
      });
      await settings.upsert("googleDriveLastBackupAt", Date.now());
    }

    runBackupIfDue().catch((error) => {
      console.warn("Failed to run Google Drive auto-backup", error);
    });
  }, [db, ready]);

  return null;
}

function NotificationScheduler() {
  const { db, ready } = useDatabase();

  useEffect(() => {
    if (!db || !ready || Platform.OS === 'web') return;

    refreshScheduledInventoryNotifications(db).catch((error) => {
      console.warn("Failed to refresh inventory notifications", error);
    });
  }, [db, ready]);

  return null;
}

function DrizzleStudioConnector({ rawDb }: { rawDb: any }) {
  useDrizzleStudio(rawDb ?? undefined);
  return null;
}
