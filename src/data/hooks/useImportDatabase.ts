import { useDatabase } from "@/db";
import { appSettings, coloredDotAssignments, coloredDots, packs, product_identifiers, products, sessions, stock_events } from "@/db/schema";
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

      // Validate the import data structure
      if (!importData.version || !importData.products || !importData.packs) {
        throw new Error("Invalid backup file structure");
      }

      // Support both version 1 and version 2
      if (importData.version !== 1 && importData.version !== 2) {
        throw new Error(`Unsupported backup version: ${importData.version}`);
      }

      const isV2 = importData.version === 2;

      // Restore images first and create a mapping from old URIs to new URIs
      const imageUriMapping: Record<string, string> = {};
      
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
          } catch (err) {
            console.warn(`Failed to restore image ${originalUri}:`, err);
          }
        }
      }

      // Clear existing data (in reverse order of dependencies)
      // Using raw SQL to avoid FK constraint issues
      await db.run(sql`DELETE FROM ${coloredDotAssignments}`);
      await db.run(sql`DELETE FROM ${coloredDots}`);
      await db.run(sql`DELETE FROM ${sessions}`);
      await db.run(sql`DELETE FROM ${stock_events}`);
      await db.run(sql`DELETE FROM ${packs}`);
      await db.run(sql`DELETE FROM ${product_identifiers}`);
      await db.run(sql`DELETE FROM ${products}`);
      await db.run(sql`DELETE FROM ${appSettings}`);

      // Insert products with updated image URIs
      for (const product of importData.products) {
        const updatedImageUri = product.imageUri ? (imageUriMapping[product.imageUri] || product.imageUri) : null;
        await db.insert(products).values({
          ...product,
          imageUri: updatedImageUri,
        });
      }

      // Insert product identifiers
      for (const identifier of importData.productIdentifiers) {
        await db.insert(product_identifiers).values(identifier);
      }

      // Insert packs
      for (const pack of importData.packs) {
        await db.insert(packs).values(pack);
      }

      // Insert stock events
      for (const event of importData.stockEvents) {
        await db.insert(stock_events).values(event);
      }

      // Insert sessions
      for (const session of importData.sessions) {
        await db.insert(sessions).values(session);
      }

      // Version 2 specific data
      let coloredDotsRestored = 0;
      let coloredDotAssignmentsRestored = 0;
      let appSettingsRestored = 0;

      if (isV2) {
        // Insert colored dots
        if (importData.coloredDots) {
          for (const dot of importData.coloredDots) {
            await db.insert(coloredDots).values(dot);
            coloredDotsRestored++;
          }
        }

        // Insert colored dot assignments
        if (importData.coloredDotAssignments) {
          for (const assignment of importData.coloredDotAssignments) {
            await db.insert(coloredDotAssignments).values(assignment);
            coloredDotAssignmentsRestored++;
          }
        }

        // Insert app settings
        if (importData.appSettings) {
          for (const setting of importData.appSettings) {
            await db.insert(appSettings).values(setting);
            appSettingsRestored++;
          }
        }
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
          products: importData.products.length,
          productIdentifiers: importData.productIdentifiers.length,
          packs: importData.packs.length,
          stockEvents: importData.stockEvents.length,
          sessions: importData.sessions.length,
          coloredDots: coloredDotsRestored,
          coloredDotAssignments: coloredDotAssignmentsRestored,
          appSettings: appSettingsRestored,
          imagesRestored: Object.keys(imageUriMapping).length,
        },
      };
    },
  });
}
