import { processImage, type BarcodeResult, type ProcessingResult } from '@/modules/frame-processor-v2/src';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
}

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProcessingResult | null>(null);
  const [lastPhoto, setLastPhoto] = useState<CapturedPhoto | null>(null);
  const cameraRef = useRef<CameraView>(null);

  const handleTakePicture = useCallback(async () => {
    if (!cameraRef.current || isProcessing) return;

    setIsProcessing(true);
    setResults(null);

    try {
      // Take picture at high resolution for better barcode detection
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1.0,
        skipProcessing: false,
        // Request maximum available resolution for better barcode detection
        // Note: Actual resolution depends on device capabilities
      });

      if (!photo) {
        throw new Error('Failed to capture photo');
      }

      setLastPhoto({
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
      });

      console.log(`Photo captured: ${photo.width}x${photo.height} at ${photo.uri}`);

      // Process with frame processor
      const result = await processImage(photo.uri);
      setResults(result);

      if (result.success && result.barcodes && result.barcodes.length > 0) {
        console.log(`Found ${result.barcodes.length} barcode(s)`);
      } else if (!result.success) {
        console.log(`Processing failed: ${result.error}`);
      } else {
        console.log('No barcodes found');
      }

    } catch (error) {
      console.error('Error capturing/processing photo:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing]);

  const toggleCameraFacing = useCallback(() => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }, []);

  const clearResults = useCallback(() => {
    setResults(null);
    setLastPhoto(null);
  }, []);

  // Permission handling
  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission is required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
      >
        {/* Viewfinder overlay */}
        <View style={styles.overlay}>
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
          <Text style={styles.instructionText}>
            Position barcode within the frame
          </Text>
        </View>

        {/* Processing indicator */}
        {isProcessing && (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
        )}
      </CameraView>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={styles.flipButton}
          onPress={toggleCameraFacing}
        >
          <Text style={styles.flipButtonText}>Flip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
          onPress={handleTakePicture}
          disabled={isProcessing}
        >
          <View style={styles.captureButtonInner} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.clearButton}
          onPress={clearResults}
        >
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Results panel */}
      {results && (
        <ScrollView style={styles.resultsContainer}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>
              {results.success ? 'Scan Results' : 'Error'}
            </Text>
            {results.processingTimeMs && (
              <Text style={styles.processingTime}>
                {results.processingTimeMs.toFixed(1)}ms
              </Text>
            )}
          </View>

          {results.success && results.barcodes && results.barcodes.length > 0 ? (
            results.barcodes.map((barcode, index) => (
              <BarcodeResultCard key={index} barcode={barcode} index={index} />
            ))
          ) : results.success ? (
            <Text style={styles.noResults}>No barcodes detected</Text>
          ) : (
            <Text style={styles.errorText}>{results.error}</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

interface BarcodeResultCardProps {
  barcode: BarcodeResult;
  index: number;
}

function BarcodeResultCard({ barcode, index }: BarcodeResultCardProps) {
  return (
    <View style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultFormat}>{barcode.format}</Text>
        <Text style={styles.resultIndex}>#{index + 1}</Text>
      </View>
      
      <Text style={styles.resultText} selectable>
        {barcode.text}
      </Text>

      {barcode.gs1Data && (
        <View style={styles.gs1Container}>
          <Text style={styles.gs1Title}>GS1 Data:</Text>
          {barcode.gs1Data.gtin && (
            <Text style={styles.gs1Item}>GTIN: {barcode.gs1Data.gtin}</Text>
          )}
          {barcode.gs1Data.lot && (
            <Text style={styles.gs1Item}>Lot: {barcode.gs1Data.lot}</Text>
          )}
          {barcode.gs1Data.expiry && (
            <Text style={styles.gs1Item}>Expiry: {formatExpiryDate(barcode.gs1Data.expiry)}</Text>
          )}
          {barcode.gs1Data.serial && (
            <Text style={styles.gs1Item}>Serial: {barcode.gs1Data.serial}</Text>
          )}
        </View>
      )}

      <View style={styles.metaContainer}>
        <Text style={styles.metaText}>
          Position: {barcode.boundingBox.x}, {barcode.boundingBox.y}
        </Text>
        <Text style={styles.metaText}>
          Size: {barcode.boundingBox.width}x{barcode.boundingBox.height}
        </Text>
      </View>
    </View>
  );
}

function formatExpiryDate(yymmdd: string): string {
  if (yymmdd.length !== 6) return yymmdd;
  const year = parseInt(yymmdd.substring(0, 2), 10);
  const month = yymmdd.substring(2, 4);
  const day = yymmdd.substring(4, 6);
  const fullYear = year > 50 ? 1900 + year : 2000 + year;
  return `${fullYear}-${month}-${day}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinder: {
    width: 280,
    height: 200,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#00FF00',
  },
  cornerTopLeft: {
    top: -1,
    left: -1,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    top: -1,
    right: -1,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    bottom: -1,
    left: -1,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    bottom: -1,
    right: -1,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  instructionText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginTop: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 12,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 30,
    backgroundColor: '#000',
  },
  flipButton: {
    padding: 15,
  },
  flipButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.5,
  },
  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFFFFF',
  },
  clearButton: {
    padding: 15,
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  resultsContainer: {
    maxHeight: 250,
    backgroundColor: '#1C1C1E',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  processingTime: {
    fontSize: 14,
    color: '#8E8E93',
  },
  noResults: {
    padding: 16,
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  errorText: {
    padding: 16,
    fontSize: 16,
    color: '#FF3B30',
  },
  resultCard: {
    margin: 8,
    padding: 12,
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resultFormat: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  resultIndex: {
    fontSize: 12,
    color: '#8E8E93',
  },
  resultText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 8,
  },
  gs1Container: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#3A3A3C',
    borderRadius: 6,
  },
  gs1Title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00FF00',
    marginBottom: 4,
  },
  gs1Item: {
    fontSize: 12,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metaText: {
    fontSize: 11,
    color: '#8E8E93',
  },
  permissionText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
