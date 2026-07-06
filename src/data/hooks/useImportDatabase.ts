import { useDatabase } from "@/db";
import { appSettings, appWarningsForProducts, coloredDotAssignments, coloredDots, holidays, packListForHoliday, packs, packsForHoliday, product_identifiers, products, sessions, stock_events } from "@/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sql } from "drizzle-orm";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";

interface ExportDataBase {
  version: number;
  exportedAt: string;
  products: any[];
  productIdentifiers: any[];
  packs: any[];
  stockEvents: any[];
  sessions: any[];
  images: Record<string, string>;
  // V2 additions (optional for backwards compatibility)
  coloredDots?: any[];
  coloredDotAssignments?: any[];
  appSettings?: any[];
  // V3 additions (optional for backwards compatibility)
  holidays?: any[];
  packListForHoliday?: any[];
  packsForHoliday?: any[];
  appWarningsForProducts?: any[];
}

function requireArray(value: unknown, fieldName: string): any[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid backup file structure: ${fieldName} must be an array`);
  }

  return value;
}

function optionalArray(value: unknown, fieldName: string): any[] {
  if (value === undefined) return [];
  return requireArray(value, fieldName);
}

export function useImportDatabase() {
  const { db, ready } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!db || !ready) {
        throw new Error("Database not ready");
      }

      // Pick a JSON file
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        throw new Error("No file selected");
      }

      const fileUri = result.assets[0].uri;

      // Read and parse the file
      const pickedFile = new File(fileUri);
      const fileContent = await pickedFile.text();

      let importData: ExportDataBase;
      try {
        importData = JSON.parse(fileContent);
      } catch {
        throw new Error("Invalid JSON file format");
      }

      // Support versions 1, 2, and 3. Newer sections are optional for backwards compatibility.
      if (importData.version !== 1 && importData.version !== 2 && importData.version !== 3) {
        throw new Error(`Unsupported backup version: ${importData.version}`);
      }

      const importedProducts = requireArray(importData.products, "products");
      const importedProductIdentifiers = requireArray(importData.productIdentifiers, "productIdentifiers");
      const importedPacks = requireArray(importData.packs, "packs");
      const importedStockEvents = requireArray(importData.stockEvents, "stockEvents");
      const importedSessions = requireArray(importData.sessions, "sessions");
      const importedColoredDots = optionalArray(importData.coloredDots, "coloredDots");
      const importedColoredDotAssignments = optionalArray(importData.coloredDotAssignments, "coloredDotAssignments");
      const importedAppSettings = optionalArray(importData.appSettings, "appSettings");
      const importedHolidays = optionalArray(importData.holidays, "holidays");
      const importedPackListForHoliday = optionalArray(importData.packListForHoliday, "packListForHoliday");
      const importedPacksForHoliday = optionalArray(importData.packsForHoliday, "packsForHoliday");
      const importedAppWarningsForProducts = optionalArray(importData.appWarningsForProducts, "appWarningsForProducts");

      // Restore images first and create a mapping from old URIs to new URIs
      const imageUriMapping: Record<string, string> = {};
      const restoredImageFiles: File[] = [];
      
      if (importData.images) {
        for (const [originalUri, base64Data] of Object.entries(importData.images)) {
          try {
            // Skip if base64 data is empty or invalid
            if (!base64Data || typeof base64Data !== 'string' || base64Data.length === 0) {
              console.warn(`Skipping image ${originalUri}: empty or invalid base64 data`);
              continue;
            }

            // Generate a new filename, stripping any existing imported_ prefixes to prevent
            // filename growth on repeated import/export cycles
            let originalFileName = originalUri.split("/").pop() || `product_${Date.now()}.jpg`;
            
            // Remove all imported_TIMESTAMP_ prefixes (pattern: imported_<13-digit-timestamp>_)
            // This prevents filenames from growing unboundedly with each import
            while (originalFileName.match(/^imported_\d+_/)) {
              originalFileName = originalFileName.replace(/^imported_\d+_/, '');
            }
            
            // Safety check: if filename is still too long (>100 chars), generate a simple one
            // This handles edge cases with corrupted or unusual filenames
            if (originalFileName.length > 100) {
              const extension = originalFileName.split('.').pop() || 'jpg';
              originalFileName = `product_${Date.now()}.${extension}`;
            }
            
            // Create a clean new filename with a single import prefix
            const newFileName = `imported_${Date.now()}_${originalFileName}`;
            const newFile = new File(Paths.document, newFileName);

            // Write the image file from base64
            newFile.create({ overwrite: true });
            newFile.write(base64Data, { encoding: "base64" });

            imageUriMapping[originalUri] = newFile.uri;
            restoredImageFiles.push(newFile);
          } catch (err) {
            console.warn(`Failed to restore image ${originalUri}:`, err);
          }
        }
      }

      let coloredDotsRestored = 0;
      let coloredDotAssignmentsRestored = 0;
      let appSettingsRestored = 0;
      let holidaysRestored = 0;
      let packListForHolidayRestored = 0;
      let packsForHolidayRestored = 0;
      let appWarningsForProductsRestored = 0;

      try {
        await db.transaction(async (tx) => {
          const txDb = tx as unknown as typeof db;

          // Clear existing data in reverse dependency order.
          await txDb.run(sql`DELETE FROM ${coloredDotAssignments}`);
          await txDb.run(sql`DELETE FROM ${packsForHoliday}`);
          await txDb.run(sql`DELETE FROM ${packListForHoliday}`);
          await txDb.run(sql`DELETE FROM ${appWarningsForProducts}`);
          await txDb.run(sql`DELETE FROM ${coloredDots}`);
          await txDb.run(sql`DELETE FROM ${sessions}`);
          await txDb.run(sql`DELETE FROM ${stock_events}`);
          await txDb.run(sql`DELETE FROM ${packs}`);
          await txDb.run(sql`DELETE FROM ${product_identifiers}`);
          await txDb.run(sql`DELETE FROM ${holidays}`);
          await txDb.run(sql`DELETE FROM ${products}`);
          await txDb.run(sql`DELETE FROM ${appSettings}`);

          for (const product of importedProducts) {
            const updatedImageUri = product.imageUri ? (imageUriMapping[product.imageUri] || product.imageUri) : null;
            await txDb.insert(products).values({
              ...product,
              imageUri: updatedImageUri,
            });
          }

          for (const holiday of importedHolidays) {
            await txDb.insert(holidays).values(holiday);
            holidaysRestored++;
          }

          for (const identifier of importedProductIdentifiers) {
            await txDb.insert(product_identifiers).values(identifier);
          }

          for (const pack of importedPacks) {
            await txDb.insert(packs).values(pack);
          }

          for (const event of importedStockEvents) {
            await txDb.insert(stock_events).values(event);
          }

          for (const session of importedSessions) {
            await txDb.insert(sessions).values(session);
          }

          for (const dot of importedColoredDots) {
            await txDb.insert(coloredDots).values(dot);
            coloredDotsRestored++;
          }

          for (const assignment of importedColoredDotAssignments) {
            await txDb.insert(coloredDotAssignments).values(assignment);
            coloredDotAssignmentsRestored++;
          }

          for (const setting of importedAppSettings) {
            await txDb.insert(appSettings).values(setting);
            appSettingsRestored++;
          }

          for (const warning of importedAppWarningsForProducts) {
            await txDb.insert(appWarningsForProducts).values(warning);
            appWarningsForProductsRestored++;
          }

          for (const item of importedPackListForHoliday) {
            await txDb.insert(packListForHoliday).values(item);
            packListForHolidayRestored++;
          }

          for (const allocation of importedPacksForHoliday) {
            await txDb.insert(packsForHoliday).values(allocation);
            packsForHolidayRestored++;
          }
        });
      } catch (error) {
        for (const restoredFile of restoredImageFiles) {
          try {
            restoredFile.delete();
          } catch {
            // Ignore image cleanup errors; the database transaction is already rolled back.
          }
        }

        throw error;
      }

      // Invalidate all queries to refresh the UI
      await queryClient.invalidateQueries();

      // Clean up the picked file
      try {
        pickedFile.delete();
      } catch {
        // Ignore cleanup errors
      }

      return {
        success: true,
        stats: {
          products: importedProducts.length,
          productIdentifiers: importedProductIdentifiers.length,
          packs: importedPacks.length,
          stockEvents: importedStockEvents.length,
          sessions: importedSessions.length,
          coloredDots: coloredDotsRestored,
          coloredDotAssignments: coloredDotAssignmentsRestored,
          appSettings: appSettingsRestored,
          holidays: holidaysRestored,
          packListForHoliday: packListForHolidayRestored,
          packsForHoliday: packsForHolidayRestored,
          appWarningsForProducts: appWarningsForProductsRestored,
          imagesRestored: Object.keys(imageUriMapping).length,
        },
      };
    },
  });
}
