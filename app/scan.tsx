import AppWrapper from '@/components/AppWrapper';
import { BarcodeResult, processImage } from '@/modules/frame-processor-v2/src';
import { useFindIdentifierByValue } from '@/src/data/hooks/useFindIdentifierByValue';
import { BarcodeReviewCandidate, getProductIdentifierDetectionsFromBarcodes, getProductIdentifierFromCode, resolveScanDestination } from '@/src/domain/scanService';
import { useScanFlow } from '@/state/scanFlow';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Button, Card, Modal, Portal, Snackbar, Text, TextInput, useTheme } from 'react-native-paper';
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
  const [scanError, setScanError] = useState<string | null>(null);
  const [reviewCandidates, setReviewCandidates] = useState<BarcodeReviewCandidate<BarcodeResult>[]>([]);
  const [rawScanCodes, setRawScanCodes] = useState<string[]>([]);

  const updateZoom = (newZoom: number) => {
    setZoom(newZoom);
  };

  const showScanError = (message: string) => {
    setScanError(message);
  };

  const continueWithCandidate = async (candidate: BarcodeReviewCandidate<BarcodeResult>) => {
    const { barcode, detection } = candidate;
    setFlashEnabled(false);
    setReviewCandidates([]);
    setRawScanCodes([]);

    setScanResult(barcode);
    const existing = await findIdentifier.mutateAsync({ value: detection.value, type: detection.type });
    const destination = resolveScanDestination(existing);

    if (destination.type === "new-or-existing-product") {
      router.push("/new/choose_existing_product");
      return;
    }

    if (destination.type === "add-pack") {
      router.push({
        pathname: "/new/add_pack",
        params: { productId: destination.productId },
      });
      return;
    }

    showScanError("This code matches multiple products. Please choose the product manually.");
    router.push("/new/choose_existing_product");
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
        
        if (result.success && result.barcodes && result.barcodes.length > 0) {
          const rawCodes = result.barcodes
            .map((barcode) => barcode.text)
            .filter((text): text is string => !!text);
          const candidates = getProductIdentifierDetectionsFromBarcodes(result.barcodes);
          setRawScanCodes(rawCodes);

          if (candidates.length === 1) {
            console.log('Extracted identifier:', candidates[0].detection.value, 'from barcode index:', candidates[0].index);
            await continueWithCandidate(candidates[0]);
          } else if (candidates.length > 1) {
            setReviewCandidates(candidates);
          } else {
            showScanError('No valid product identifier found in barcode.');
          }
        } else {
          showScanError('No barcodes detected. Please try again.');
        }
      }
      setIsScanning(false);
    }
  }

  const handleManualCodeSubmit = async() => {
    if (!manualCode) return;
    const detection = getProductIdentifierFromCode(manualCode);

    if (detection) {
      const fakedBarcode: BarcodeResult = {
        format: detection.format,
        text: manualCode,
        confidence: 1,
        orientation: 0,
        boundingBox: { x: 0, y: 0, width: 0, height: 0 },
        position: [],
      }

      await continueWithCandidate({ barcode: fakedBarcode, detection, index: 0 });
    } else {
      showScanError("No valid product identifier found in code.");
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

      {reviewCandidates.length > 0 ? (
        <Card elevation={1} style={{ marginBottom: 16 }}>
          <Card.Content style={{ gap: 8 }}>
            <Text variant="titleMedium">Review detected codes</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Multiple product codes were detected. Choose the one printed on the pack you want to add.
            </Text>
            {reviewCandidates.map((candidate) => (
              <Button
                key={`${candidate.index}-${candidate.detection.type}-${candidate.detection.value}`}
                mode="outlined"
                icon={candidate.detection.format === "GS1" ? "barcode-scan" : "barcode"}
                onPress={() => continueWithCandidate(candidate)}
              >
                {candidate.detection.type}: {candidate.detection.value}
              </Button>
            ))}
          </Card.Content>
        </Card>
      ) : null}

      {reviewCandidates.length === 0 && rawScanCodes.length > 0 ? (
        <Card elevation={1} style={{ marginBottom: 16 }}>
          <Card.Content style={{ gap: 8 }}>
            <Text variant="titleMedium">Detected raw codes</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              None could be read as a product identifier. You can retry or use one as manual input.
            </Text>
            {rawScanCodes.map((code, index) => (
              <Button
                key={`${index}-${code}`}
                mode="outlined"
                icon="form-textbox"
                onPress={() => {
                  setManualCode(code);
                  setShowManualCodeInputModal(true);
                }}
              >
                Use code {index + 1}
              </Button>
            ))}
          </Card.Content>
        </Card>
      ) : null}

      <Portal>
        <Modal visible={showManualCodeInputModal} onDismiss={() => setShowManualCodeInputModal(false)} contentContainerStyle={{ margin: 20, padding: 20, backgroundColor: theme.colors.surface, borderRadius: 8 }}>
          <Text variant="titleLarge" style={{ marginBottom: 16 }}>Manual Code Input</Text>
          <TextInput label="Enter Product Code" value={manualCode} onChangeText={text => setManualCode(text)} />
          <Button mode="contained" disabled={!manualCode} onPress={handleManualCodeSubmit}>
            Submit
          </Button>
        </Modal>
      </Portal>
      <Snackbar
        visible={scanError !== null}
        onDismiss={() => setScanError(null)}
        duration={4000}
        action={{
          label: 'Dismiss',
          onPress: () => setScanError(null),
        }}
      >
        {scanError}
      </Snackbar>
    </AppWrapper>
  );
}
