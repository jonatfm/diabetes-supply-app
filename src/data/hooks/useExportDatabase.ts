import { useDatabase } from "@/db";
import { appSettings, appWarningsForProducts, coloredDotAssignments, coloredDots, holidays, packListForHoliday, packs, packsForHoliday, product_identifiers, products, sessions, stock_events } from "@/db/schema";
import { useMutation } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

interface ExportData {
  version: number;
  exportedAt: string;
  products: any[];
  productIdentifiers: any[];
  packs: any[];
  stockEvents: any[];
  sessions: any[];
  coloredDots: any[];
  coloredDotAssignments: any[];
  appSettings: any[];
  holidays: any[];
  packListForHoliday: any[];
  packsForHoliday: any[];
  appWarningsForProducts: any[];
  images: Record<string, string>; // imageUri -> base64 data
}

export function useExportDatabase() {
  const { db, ready } = useDatabase();

  return useMutation({
    mutationFn: async () => {
      if (!db || !ready) {
        throw new Error("Database not ready");
      }

      // Fetch all data from tables
      const allProducts = await db.select().from(products);
      const allProductIdentifiers = await db.select().from(product_identifiers);
      const allPacks = await db.select().from(packs);
      const allStockEvents = await db.select().from(stock_events);
      const allSessions = await db.select().from(sessions);
      const allColoredDots = await db.select().from(coloredDots);
      const allColoredDotAssignments = await db.select().from(coloredDotAssignments);
      const allAppSettings = await db.select().from(appSettings);
      const allHolidays = await db.select().from(holidays);
      const allPackListForHoliday = await db.select().from(packListForHoliday);
      const allPacksForHoliday = await db.select().from(packsForHoliday);
      const allAppWarningsForProducts = await db.select().from(appWarningsForProducts);

      // Collect all unique image URIs and convert to base64
      const images: Record<string, string> = {};
      
      for (const product of allProducts) {
        if (product.imageUri) {
          try {
            // Check if file exists and read as base64
            const file = new File(product.imageUri);
            if (file.exists) {
              const base64 = await file.base64();
              images[product.imageUri] = base64;
            }
          } catch (err) {
            console.warn(`Failed to read image ${product.imageUri}:`, err);
          }
        }
      }

      const exportData: ExportData = {
        version: 3, // Includes holiday reservations and warning records
        exportedAt: new Date().toISOString(),
        products: allProducts,
        productIdentifiers: allProductIdentifiers,
        packs: allPacks,
        stockEvents: allStockEvents,
        sessions: allSessions,
        coloredDots: allColoredDots,
        coloredDotAssignments: allColoredDotAssignments,
        appSettings: allAppSettings,
        holidays: allHolidays,
        packListForHoliday: allPackListForHoliday,
        packsForHoliday: allPacksForHoliday,
        appWarningsForProducts: allAppWarningsForProducts,
        images,
      };

      // Create export file
      const fileName = `diabetes-supply-backup-${Date.now()}.json`;
      const exportFile = new File(Paths.cache, fileName);
      
      exportFile.create({ overwrite: true });
      exportFile.write(JSON.stringify(exportData, null, 2));

      // Share the file
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(exportFile.uri, {
          mimeType: "application/json",
          dialogTitle: "Export Database Backup",
          UTI: "public.json",
        });
      } else {
        throw new Error("Sharing is not available on this device");
      }

      // Clean up temp file
      try {
        exportFile.delete();
      } catch {
        // Ignore cleanup errors
      }

      return { success: true, fileName };
    },
  });
}
