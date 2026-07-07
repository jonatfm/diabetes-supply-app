import { appSettingsRepo } from "@/src/data/appSettingsRepo";
import { packsRepo } from "@/src/data/packsRepo";
import { productRepo } from "@/src/data/productRepo";
import { statisticsRepo } from "@/src/data/statisticsRepo";
import { estimateDaysUntilOutOfStock } from "@/src/domain/statisticsService";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

type Db = Parameters<typeof appSettingsRepo>[0];

export type GeneratedWarning = {
  id: string;
  productId: string;
  packId?: string;
  type: "EXPIRY_APPROACHING" | "RUN_OUT_SOON";
  title: string;
  body: string;
  scheduledAt: Date;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SCHEDULED_NOTIFICATION_IDS_KEY = "scheduledNotificationIds";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function dateOnly(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function scheduleAtOrSoon(date: Date) {
  const soon = new Date(Date.now() + 60 * 1000);
  return date.getTime() > soon.getTime() ? date : soon;
}

async function ensureNotificationPermission() {
  if (Platform.OS === "web") {
    return false;
  }

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function cancelPreviouslyScheduled(db: Db) {
  const settings = appSettingsRepo(db);
  const ids = await settings.getByKey<string[]>(SCHEDULED_NOTIFICATION_IDS_KEY);
  if (!ids || ids.length === 0) {
    return;
  }

  await Promise.all(
    ids.map(async (id) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
      } catch {
        // Ignore cancellation failures; stale IDs can happen after OS cleanup.
      }
    }),
  );
  await settings.upsert(SCHEDULED_NOTIFICATION_IDS_KEY, []);
}

export async function generateInventoryWarnings(db: Db): Promise<GeneratedWarning[]> {
  const settings = appSettingsRepo(db);
  const appWarningsEnabled = await settings.getByKey<boolean>("appWarningsEnabled");
  if (!appWarningsEnabled) {
    return [];
  }

  const expiryEnabled = await settings.getByKey<boolean>("expiryApproachingWarningEnabled");
  const expiryDays = await settings.getByKey<number>("expiryApproachingDays") ?? 7;
  const runningOutEnabled = await settings.getByKey<boolean>("runningOutWarningEnabled");
  const runningOutDays = await settings.getByKey<number>("runningOutDays") ?? 3;

  const products = (await productRepo(db).getAllProducts()).filter((product) => product.active);
  const warnings: GeneratedWarning[] = [];
  const today = dateOnly(new Date());

  if (expiryEnabled) {
    for (const product of products.filter((item) => item.canHaveExpiry)) {
      const activePacks = await packsRepo(db).listActiveNonEmptyByProduct(product.id);
      for (const pack of activePacks) {
        if (!pack.expiry) continue;
        const expiryDate = parseDateOnly(pack.expiry);
        if (!expiryDate) continue;

        const daysUntilExpiry = Math.ceil((dateOnly(expiryDate).getTime() - today.getTime()) / MS_PER_DAY);
        if (daysUntilExpiry < 0 || daysUntilExpiry > expiryDays) {
          continue;
        }

        warnings.push({
          id: `expiry:${pack.id}`,
          productId: product.id,
          packId: pack.id,
          type: "EXPIRY_APPROACHING",
          title: `${product.name} expires soon`,
          body: `A pack expires on ${pack.expiry}.`,
          scheduledAt: scheduleAtOrSoon(new Date(expiryDate.getTime() - expiryDays * MS_PER_DAY)),
        });
      }
    }
  }

  if (runningOutEnabled) {
    for (const product of products) {
      const totalUnits = await packsRepo(db).totalUnitsByProduct(product.id);
      const daysUntilOut = estimateDaysUntilOutOfStock({
        product,
        totalUnits,
        sessionStats: product.isSessionBased ? await statisticsRepo(db).getSessionStatistics(product.id) : null,
        takeStats: product.isSessionBased ? null : await statisticsRepo(db).getTakeEventStatistics(product.id),
      });

      if (daysUntilOut === null || daysUntilOut > runningOutDays) {
        continue;
      }

      warnings.push({
        id: `runout:${product.id}`,
        productId: product.id,
        type: "RUN_OUT_SOON",
        title: `${product.name} is running low`,
        body: daysUntilOut === 0
          ? "No active stock remains."
          : `Estimated stock remaining: ${Math.max(0, daysUntilOut).toFixed(1)} days.`,
        scheduledAt: scheduleAtOrSoon(new Date()),
      });
    }
  }

  return warnings.slice(0, 50);
}

export async function refreshScheduledInventoryNotifications(db: Db) {
  await cancelPreviouslyScheduled(db);

  const warnings = await generateInventoryWarnings(db);
  if (warnings.length === 0) {
    return { scheduled: 0, warnings };
  }

  const permissionGranted = await ensureNotificationPermission();
  if (!permissionGranted) {
    throw new Error("Notification permission was not granted.");
  }

  const scheduledIds: string[] = [];
  for (const warning of warnings) {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: warning.title,
        body: warning.body,
        data: {
          warningId: warning.id,
          productId: warning.productId,
          packId: warning.packId,
          type: warning.type,
          route: `/product/${warning.productId}`,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: warning.scheduledAt,
      },
    });
    scheduledIds.push(id);
  }

  await appSettingsRepo(db).upsert(SCHEDULED_NOTIFICATION_IDS_KEY, scheduledIds);

  return {
    scheduled: scheduledIds.length,
    warnings,
  };
}
