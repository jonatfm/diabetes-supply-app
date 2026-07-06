import AppWrapper from '@/components/AppWrapper';
import { BarcodeResult, processImage } from '@/modules/frame-processor-v2/src';
import { detectBarcodeFormat, getConvenienceFields, parseGS1Unified } from '@/scripts/gs1';
import { useFindIdentifierByValue } from '@/src/data/hooks/useFindIdentifierByValue';
import { useScanFlow } from '@/state/scanFlow';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Button, Card, Modal, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { runOnJS } from 'react-native-reanimated';


export default function Scan() {
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();
  const { setScanResult } = useScanFlow();
  const findIdentifier = useFindIdentifierByValue();
  const theme = useTheme();
  

  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [showManualCodeInputModal, setShowManualCodeInputModal] = useState(false);
  const [manualCode, setManualCode] = useState('');

  const updateZoom = (newZoom: number) => {
    setZoom(newZoom);
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newZoom = Math.max(0, Math.min(zoom + (e.scale - 1) * 0.05, 1));
      runOnJS(updateZoom)(newZoom);
    });

  if (!permission?.granted) {
    return (
      <AppWrapper>
        <View style={{ marginBottom: 16 }}>
          <Button 
            mode="text" 
            onPress={() => router.back()} 
            icon="arrow-left"
            style={{ alignSelf: 'flex-start', marginLeft: -8 }}
          >
            Back
          </Button>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Card elevation={2} style={{ padding: 24, alignItems: 'center', maxWidth: 400, }}>
            <Text variant="titleLarge" style={{ marginBottom: 8, textAlign: 'center' }}>Camera Access Required</Text>
            <Text variant="bodyMedium" style={{ marginBottom: 24, textAlign: 'center', color: theme.colors.onSurfaceVariant }}>
              Camera permission is required to scan barcodes.
            </Text>
            <Button onPress={() => requestPermission()} mode="contained" icon="camera">
              Grant Permission
            </Button>
          </Card>
        </View>
      </AppWrapper>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      setIsScanning(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
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
            setFlashEnabled(false);

            // Persist the detected barcode in the scanning flow context
            setScanResult(barcode);
            const existing = await findIdentifier.mutateAsync({ value: identifier });
            console.log('Existing identifiers with this identifier:', existing);
            if (existing.length === 0) {
              router.push("/new/choose_existing_product");
            } else {
              const productId = existing[0].productId;
              
              router.push({
                pathname: "/new/add_pack",
                params: { productId: String(productId) },
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

  const handleManualCodeSubmit = async() => {
    if (!manualCode) return;
    const detected = detectBarcodeFormat(manualCode);
    
    let identifier = "";
    let fakedGs1Data: any | undefined = undefined;
    if (detected.format === "GS1") {
      const parsed = parseGS1Unified(manualCode);
      const conv = getConvenienceFields(parsed);
      fakedGs1Data = parsed;
      identifier = conv.identifier;
    } else if (detected.format === "EAN13") {
      const conv = getConvenienceFields(manualCode);
      identifier = conv.identifier;
    }

    if (identifier) {
      setFlashEnabled(false);

      const fakedBarcode: BarcodeResult = {
        format: detected.format,
        text: manualCode,
        confidence: 1,
        orientation: 0,
        boundingBox: { x: 0, y: 0, width: 0, height: 0 },
        position: [],
        gs1Data: fakedGs1Data,
      }

      setScanResult(fakedBarcode);
      const existing = await findIdentifier.mutateAsync({value: identifier});
      if (existing.length === 0) {
        router.push("/new/choose_existing_product");
      } else {
        const productId = existing[0].productId;

        router.push({
          pathname: "/new/add_pack",
          params: {productId: String(productId)}
        })
      }
    } else {
      alert("No valid product identifier found in code");
    }
  }


  return (
    <AppWrapper>
      <Text variant="headlineLarge" style={{ marginBottom: 16 }}>Scan Product</Text>
      <Card elevation={2} style={{ flex: 1, marginBottom: 16, overflow: 'hidden', flexGrow: 1 }}>
        <View style={{flexGrow: 1, width: '100%', height: "100%"}}>
          <GestureDetector gesture={pinchGesture}>
            <CameraView
              ref={cameraRef}
              style={{flex: 1, flexGrow: 1, width: '100%'}}
              enableTorch={flashEnabled}
              zoom={zoom}
            />
          </GestureDetector>
        </View>
      </Card>
      <View style={{ gap: 12, marginBottom: 32 }}>
        <Button icon={flashEnabled ? "flashlight" : "flashlight-off"} mode={flashEnabled ? "contained" : "contained-tonal"} onPress={() => setFlashEnabled(!flashEnabled)}>
          {flashEnabled ? 'Flash On' : 'Flash Off'}
        </Button>
        <Button icon="camera" loading={isScanning} mode="contained" onPress={takePicture} disabled={isScanning}>
          {isScanning ? 'Scanning...' : 'Take Picture'}
        </Button>
        <Button icon="barcode-off" mode="outlined" onPress={() => setShowManualCodeInputModal(true)}>
          Cannot Scan?
        </Button>
      </View>

      <Portal>
        <Modal visible={showManualCodeInputModal} onDismiss={() => setShowManualCodeInputModal(false)} contentContainerStyle={{ margin: 20, padding: 20, backgroundColor: theme.colors.surface, borderRadius: 8 }}>
          <Text variant="titleLarge" style={{ marginBottom: 16 }}>Manual Code Input</Text>
          <TextInput label="Enter Product Code" value={manualCode} onChangeText={text => setManualCode(text)} />
          <Button mode="contained" disabled={!manualCode} onPress={handleManualCodeSubmit}>
            Submit
          </Button>
        </Modal>
      </Portal>
    </AppWrapper>
  );
}
