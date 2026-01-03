import AppWrapper from '@/components/AppWrapper';
import { db } from '@/db/client';
import { product_identifiers } from '@/db/schema';
import { processImage } from '@/modules/frame-processor-v2/src';
import { detectBarcodeFormat, getConvenienceFields, parseGS1Unified } from '@/scripts/gs1';
import { useScanFlow } from '@/state/scanFlow';
import { eq } from 'drizzle-orm';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';


export default function Scan() {
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const { setScanResult } = useScanFlow();

  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);

  if (!permission?.granted) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Camera permission is required to scan barcodes.</Text>
        <Button onPress={() => requestPermission()}>Grant Permission</Button>
      </SafeAreaView>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      setIsScanning(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: true,
      });

      if (photo) {
        const result = await processImage(photo.uri);
        console.log('Scan result:', result);
        
        if (result.success && result.barcodes && result.barcodes.length > 0 && result.barcodes[0].text) {
          const barcode = result.barcodes[0];
          const detected = detectBarcodeFormat(barcode.text);
          
          let identifier = '';
          
          if (detected.format === 'GS1') {
            const parsed = parseGS1Unified(barcode.text);
            const conv = getConvenienceFields(parsed);
            identifier = conv.identifier;
          } else if (detected.format === 'EAN13') {
            const conv = getConvenienceFields(barcode.text);
            identifier = conv.identifier;
          }
          
          console.log('Extracted identifier:', identifier);
          
          if (identifier) {
            // Persist the detected barcode in the scanning flow context
            setScanResult(barcode);
            const existing = await db.select().from(product_identifiers).where(eq(product_identifiers.value, identifier));
            console.log('Existing identifiers with this identifier:', existing);
            if (existing.length === 0) {
              router.push("/new/choose_existing_product");
            } else {
              router.push({
                pathname: "/new/add_pack",
                params: { productId: String(existing[0].productId) },
              });
            }
          } else {
            alert('No valid product identifier found in barcode');
          }
        } else {
          alert('No barcodes detected. Please try again.');
        }
      }
      setIsScanning(false);
    }
  }

  return (
    <AppWrapper>
      <Text variant="headlineLarge">Scan product code</Text>
      <Card style={{ flex: 1, marginVertical: 16, overflow: 'hidden', flexGrow: 1 }}>
        <View style={{flexGrow: 1, width: '100%', height: "100%"}}>
          <CameraView
            ref={cameraRef}
            style={{flex: 1, flexGrow: 1, width: '100%'}}
            enableTorch={flashEnabled}
          />
        </View>
      </Card>
      <View style={{ gap: 16 }}>
        <Button icon={flashEnabled ? "flashlight" : "flashlight-off"} mode={flashEnabled ? "contained" : "contained-tonal"} onPress={() => setFlashEnabled(!flashEnabled)}>
          {flashEnabled ? 'Flash On' : 'Flash Off'}
        </Button>
        <Button icon="camera" loading={isScanning} mode="contained" onPress={takePicture} disabled={isScanning}>
          {isScanning ? 'Scanning...' : 'Take Picture'}
        </Button>
      </View>
    </AppWrapper>
  );
}