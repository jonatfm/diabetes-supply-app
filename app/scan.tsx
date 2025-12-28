import { db } from '@/db/client';
import { product_identifiers, products } from '@/db/schema';
import { BarcodeResult, processImage } from '@/modules/frame-processor-v2/src';
import { getConvenienceFields, parseGS1Unified } from '@/scripts/gs1';
import { Button } from '@react-navigation/elements';
import { CameraView } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';


const addScannedItemToInventory = async (barcode: BarcodeResult) => {
  // Normalize GS1 data from the raw barcode text using the unified parser
  const text = barcode.text ?? '';
  const parsed = parseGS1Unified(text);
  const conv = getConvenienceFields(parsed);

  // Prefer parsed values; fallback to native gs1Data if present
  const gtin = conv.gtin || (barcode.gs1Data?.gtin ?? '').replace(/\D+/g, '');
  const lot = conv.lot || (barcode.gs1Data?.lot ?? '').trim();
  const expiry = conv.expiry || (barcode.gs1Data?.expiry ?? '').trim();
  const serial = conv.serial || (barcode.gs1Data?.serial ?? '').trim();
  const productionDate = conv.productionDate || (barcode.gs1Data?.productionDate ?? '').trim();

  if (!gtin) {
    alert('No GS1 GTIN (01) found in barcode');
    return;
  }

  // Here you would typically look up the product in your database using the GTIN
  console.log('Adding item to inventory:', {
    gtin,
    lot,
    expiry,
    serial,
    productionDate,
  });

  alert(`Item added to inventory: gtin: ${gtin} lot: ${lot} expiry: ${expiry} serial: ${serial} productionDate: ${productionDate}`);

  // Check if this GTIN is already recorded in the product_identifiers table. If not create it together with a product

  // Check if we already have any product identifier
  const existing = await db.select({ id: product_identifiers.id }).from(product_identifiers);

  // Create a new product + identifier if it doesn't exist
  if (existing.length === 0) {
    let product = await db.insert(products).values({
      name: "Debug",
      category: "other",
      defaultUnit: "piece",
      unitsPerPackDefault: 1,
    }).returning({id: products.id});

    await db.insert(product_identifiers).values({
      productId: product[0].id,
      value: gtin,
      type: "GTIN",
      createdAt: Date.now(),
    });
    console.log('Product identifier added to database');
  } else {
    console.log('Product identifier already exists in database');
  }
};

export default function Scan() {
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  const [isScanning, setIsScanning] = useState(false);

  const takePicture = async () => {
    if (cameraRef.current) {
      setIsScanning(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: true,
      });

      if (photo) {
        const result = await processImage(photo.uri);
        if (result.success && result.barcodes && result.barcodes.length > 0) {
            //addScannedItemToInventory(result.barcodes[0]);
            router.push("/new/choose_existing_product");
        } else {
          alert('No barcodes detected');
        }
      }
      setIsScanning(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <CameraView
        ref={cameraRef}
        style={{flex: 1}}
      />
      <Button onPress={takePicture} disabled={isScanning}>{isScanning ? 'Scanning...' : 'Take Picture'}</Button>
    </SafeAreaView>
  );
}
