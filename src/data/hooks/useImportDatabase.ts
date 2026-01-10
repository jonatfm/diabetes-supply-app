import { useDatabase } from "@/db";
import { packs, product_identifiers, products, sessions, stock_events } from "@/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sql } from "drizzle-orm";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";

interface ExportData {
  version: number;
  exportedAt: string;
  products: any[];
  productIdentifiers: any[];
  packs: any[];
  stockEvents: any[];
  sessions: any[];
  images: Record<string, string>; // imageUri -> base64 data
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

      let importData: ExportData;
      try {
        importData = JSON.parse(fileContent);
      } catch {
        throw new Error("Invalid JSON file format");
      }

      // Validate the import data structure
      if (!importData.version || !importData.products || !importData.packs) {
        throw new Error("Invalid backup file structure");
      }

      if (importData.version !== 1) {
        throw new Error(`Unsupported backup version: ${importData.version}`);
      }

      // Restore images first and create a mapping from old URIs to new URIs
      const imageUriMapping: Record<string, string> = {};
      
      if (importData.images) {
        for (const [originalUri, base64Data] of Object.entries(importData.images)) {
          try {
            // Generate a new filename based on the original
            const originalFileName = originalUri.split("/").pop() || `imported_${Date.now()}.jpg`;
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
      await db.run(sql`DELETE FROM ${sessions}`);
      await db.run(sql`DELETE FROM ${stock_events}`);
      await db.run(sql`DELETE FROM ${packs}`);
      await db.run(sql`DELETE FROM ${product_identifiers}`);
      await db.run(sql`DELETE FROM ${products}`);

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
          imagesRestored: Object.keys(imageUriMapping).length,
        },
      };
    },
  });
}
