import { db } from '@/db/client';
import { product_identifiers } from '@/db/schema';
import { processImage } from '@/modules/frame-processor-v2/src';
import { getConvenienceFields, parseGS1Unified } from '@/scripts/gs1';
import { useScanFlow } from '@/state/scanFlow';
import { Button } from '@react-navigation/elements';
import { eq } from 'drizzle-orm';
import { CameraView } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';


export default function Scan() {
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const { setScanResult } = useScanFlow();

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
        // check if gtin is present in the parsed gs1 data
        const gtin = result.barcodes && result.barcodes.length > 0 && result.barcodes[0].text ? getConvenienceFields(parseGS1Unified(result.barcodes[0].text)).gtin : null;
        
        if (result.success && result.barcodes && result.barcodes.length > 0 && result.barcodes[0].text && parseGS1Unified(result.barcodes[0].text || '') && gtin) {
            // Persist the first detected barcode in the scanning flow context
            setScanResult(result.barcodes[0]);
            //const existing = await db.select({ id: product_identifiers.id }).from(product_identifiers);
            const existing = await db.select().from(product_identifiers).where(eq(product_identifiers.value, gtin));
            console.log('Existing identifiers with this GTIN:', existing);
            if (existing.length === 0) {
              router.push("/new/choose_existing_product");
            } else {
              router.push({
                pathname: "/new/add_pack",
                params: { productId: String(existing[0].productId) },
              });
            }
        } else {
          alert('No barcodes detected / No GS1 data found. Please try again.');
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
