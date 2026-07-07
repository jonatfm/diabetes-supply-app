import { useDatabase } from "@/db";
import { appSettings, appWarningsForProducts, coloredDotAssignments, coloredDots, holidays, packListForHoliday, packs, packsForHoliday, product_identifiers, products, sessions, stock_events } from "@/db/schema";
import { QueryClient, useMutation, useQueryClient } from "@tanstack/react-query";
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

type ValidatedImportData = {
  importData: ExportDataBase;
  importedProducts: any[];
  importedProductIdentifiers: any[];
  importedPacks: any[];
  importedStockEvents: any[];
  importedSessions: any[];
  importedColoredDots: any[];
  importedColoredDotAssignments: any[];
  importedAppSettings: any[];
  importedHolidays: any[];
  importedPackListForHoliday: any[];
  importedPacksForHoliday: any[];
  importedAppWarningsForProducts: any[];
};

export type ImportPreview = {
  fileUri: string;
  fileName: string;
  version: number;
  exportedAt?: string;
  stats: {
    products: number;
    productIdentifiers: number;
    packs: number;
    stockEvents: number;
    sessions: number;
    coloredDots: number;
    coloredDotAssignments: number;
    appSettings: number;
    holidays: number;
    packListForHoliday: number;
    packsForHoliday: number;
    appWarningsForProducts: number;
    images: number;
  };
};

export type ImportResult = {
  success: true;
  stats: {
    products: number;
    productIdentifiers: number;
    packs: number;
    stockEvents: number;
    sessions: number;
    coloredDots: number;
    coloredDotAssignments: number;
    appSettings: number;
    holidays: number;
    packListForHoliday: number;
    packsForHoliday: number;
    appWarningsForProducts: number;
    imagesRestored: number;
  };
};

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

function validateImportData(importData: ExportDataBase): ValidatedImportData {
  if (importData.version !== 1 && importData.version !== 2 && importData.version !== 3) {
    throw new Error(`Unsupported backup version: ${importData.version}`);
  }

  return {
    importData,
    importedProducts: requireArray(importData.products, "products"),
    importedProductIdentifiers: requireArray(importData.productIdentifiers, "productIdentifiers"),
    importedPacks: requireArray(importData.packs, "packs"),
    importedStockEvents: requireArray(importData.stockEvents, "stockEvents"),
    importedSessions: requireArray(importData.sessions, "sessions"),
    importedColoredDots: optionalArray(importData.coloredDots, "coloredDots"),
    importedColoredDotAssignments: optionalArray(importData.coloredDotAssignments, "coloredDotAssignments"),
    importedAppSettings: optionalArray(importData.appSettings, "appSettings"),
    importedHolidays: optionalArray(importData.holidays, "holidays"),
    importedPackListForHoliday: optionalArray(importData.packListForHoliday, "packListForHoliday"),
    importedPacksForHoliday: optionalArray(importData.packsForHoliday, "packsForHoliday"),
    importedAppWarningsForProducts: optionalArray(importData.appWarningsForProducts, "appWarningsForProducts"),
  };
}

function parseImportFileContent(fileContent: string): ValidatedImportData {
  let importData: ExportDataBase;
  try {
    importData = JSON.parse(fileContent);
  } catch {
    throw new Error("Invalid JSON file format");
  }

  return validateImportData(importData);
}

function buildImportPreview(fileUri: string, fileName: string, data: ValidatedImportData): ImportPreview {
  return {
    fileUri,
    fileName,
    version: data.importData.version,
    exportedAt: data.importData.exportedAt,
    stats: {
      products: data.importedProducts.length,
      productIdentifiers: data.importedProductIdentifiers.length,
      packs: data.importedPacks.length,
      stockEvents: data.importedStockEvents.length,
      sessions: data.importedSessions.length,
      coloredDots: data.importedColoredDots.length,
      coloredDotAssignments: data.importedColoredDotAssignments.length,
      appSettings: data.importedAppSettings.length,
      holidays: data.importedHolidays.length,
      packListForHoliday: data.importedPackListForHoliday.length,
      packsForHoliday: data.importedPacksForHoliday.length,
      appWarningsForProducts: data.importedAppWarningsForProducts.length,
      images: data.importData.images ? Object.keys(data.importData.images).length : 0,
    },
  };
}

export async function restoreImportFromFile(
  db: NonNullable<ReturnType<typeof useDatabase>["db"]>,
  queryClient: QueryClient,
  fileUri: string,
  options?: { cleanupPickedFile?: boolean },
): Promise<ImportResult> {
  const pickedFile = new File(fileUri);
  const fileContent = await pickedFile.text();
  const validated = parseImportFileContent(fileContent);

  const imageUriMapping: Record<string, string> = {};
  const restoredImageFiles: File[] = [];

  if (validated.importData.images) {
    for (const [originalUri, base64Data] of Object.entries(validated.importData.images)) {
      try {
        if (!base64Data || typeof base64Data !== "string" || base64Data.length === 0) {
          console.warn(`Skipping image ${originalUri}: empty or invalid base64 data`);
          continue;
        }

        let originalFileName = originalUri.split("/").pop() || `product_${Date.now()}.jpg`;
        while (originalFileName.match(/^imported_\d+_/)) {
          originalFileName = originalFileName.replace(/^imported_\d+_/, "");
        }

        if (originalFileName.length > 100) {
          const extension = originalFileName.split(".").pop() || "jpg";
          originalFileName = `product_${Date.now()}.${extension}`;
        }

        const newFileName = `imported_${Date.now()}_${originalFileName}`;
        const newFile = new File(Paths.document, newFileName);
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

      for (const product of validated.importedProducts) {
        const updatedImageUri = product.imageUri ? (imageUriMapping[product.imageUri] || product.imageUri) : null;
        await txDb.insert(products).values({
          ...product,
          imageUri: updatedImageUri,
        });
      }

      for (const holiday of validated.importedHolidays) {
        await txDb.insert(holidays).values(holiday);
        holidaysRestored++;
      }

      for (const identifier of validated.importedProductIdentifiers) {
        await txDb.insert(product_identifiers).values(identifier);
      }

      for (const pack of validated.importedPacks) {
        await txDb.insert(packs).values(pack);
      }

      for (const event of validated.importedStockEvents) {
        await txDb.insert(stock_events).values(event);
      }

      for (const session of validated.importedSessions) {
        await txDb.insert(sessions).values(session);
      }

      for (const dot of validated.importedColoredDots) {
        await txDb.insert(coloredDots).values(dot);
        coloredDotsRestored++;
      }

      for (const assignment of validated.importedColoredDotAssignments) {
        await txDb.insert(coloredDotAssignments).values(assignment);
        coloredDotAssignmentsRestored++;
      }

      for (const setting of validated.importedAppSettings) {
        await txDb.insert(appSettings).values(setting);
        appSettingsRestored++;
      }

      for (const warning of validated.importedAppWarningsForProducts) {
        await txDb.insert(appWarningsForProducts).values(warning);
        appWarningsForProductsRestored++;
      }

      for (const item of validated.importedPackListForHoliday) {
        await txDb.insert(packListForHoliday).values(item);
        packListForHolidayRestored++;
      }

      for (const allocation of validated.importedPacksForHoliday) {
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

  await queryClient.invalidateQueries();

  if (options?.cleanupPickedFile) {
    try {
      pickedFile.delete();
    } catch {
      // Ignore cleanup errors.
    }
  }

  return {
    success: true,
    stats: {
      products: validated.importedProducts.length,
      productIdentifiers: validated.importedProductIdentifiers.length,
      packs: validated.importedPacks.length,
      stockEvents: validated.importedStockEvents.length,
      sessions: validated.importedSessions.length,
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

      const validated = parseImportFileContent(fileContent);

      // Restore images first and create a mapping from old URIs to new URIs
      const imageUriMapping: Record<string, string> = {};
      const restoredImageFiles: File[] = [];
      
      if (validated.importData.images) {
        for (const [originalUri, base64Data] of Object.entries(validated.importData.images)) {
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

          for (const product of validated.importedProducts) {
            const updatedImageUri = product.imageUri ? (imageUriMapping[product.imageUri] || product.imageUri) : null;
            await txDb.insert(products).values({
              ...product,
              imageUri: updatedImageUri,
            });
          }

          for (const holiday of validated.importedHolidays) {
            await txDb.insert(holidays).values(holiday);
            holidaysRestored++;
          }

          for (const identifier of validated.importedProductIdentifiers) {
            await txDb.insert(product_identifiers).values(identifier);
          }

          for (const pack of validated.importedPacks) {
            await txDb.insert(packs).values(pack);
          }

          for (const event of validated.importedStockEvents) {
            await txDb.insert(stock_events).values(event);
          }

          for (const session of validated.importedSessions) {
            await txDb.insert(sessions).values(session);
          }

          for (const dot of validated.importedColoredDots) {
            await txDb.insert(coloredDots).values(dot);
            coloredDotsRestored++;
          }

          for (const assignment of validated.importedColoredDotAssignments) {
            await txDb.insert(coloredDotAssignments).values(assignment);
            coloredDotAssignmentsRestored++;
          }

          for (const setting of validated.importedAppSettings) {
            await txDb.insert(appSettings).values(setting);
            appSettingsRestored++;
          }

          for (const warning of validated.importedAppWarningsForProducts) {
            await txDb.insert(appWarningsForProducts).values(warning);
            appWarningsForProductsRestored++;
          }

          for (const item of validated.importedPackListForHoliday) {
            await txDb.insert(packListForHoliday).values(item);
            packListForHolidayRestored++;
          }

          for (const allocation of validated.importedPacksForHoliday) {
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
          products: validated.importedProducts.length,
          productIdentifiers: validated.importedProductIdentifiers.length,
          packs: validated.importedPacks.length,
          stockEvents: validated.importedStockEvents.length,
          sessions: validated.importedSessions.length,
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

export function usePreviewImportDatabase() {
  return useMutation({
    mutationFn: async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        throw new Error("No file selected");
      }

      const asset = result.assets[0];
      const pickedFile = new File(asset.uri);
      const fileContent = await pickedFile.text();
      const validated = parseImportFileContent(fileContent);

      return buildImportPreview(asset.uri, asset.name ?? "Selected backup", validated);
    },
  });
}

export function useConfirmImportDatabase() {
  const { db, ready } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preview: ImportPreview) => {
      if (!db || !ready) {
        throw new Error("Database not ready");
      }

      return restoreImportFromFile(db, queryClient, preview.fileUri, {
        cleanupPickedFile: true,
      });
    },
  });
}
