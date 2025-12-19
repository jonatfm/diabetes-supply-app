import { processImage } from '@/modules/frame-processor-v2/src';
import { Button } from '@react-navigation/elements';
import { CameraView } from 'expo-camera';
import { useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Scan() {
  const cameraRef = useRef<CameraView>(null);

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
