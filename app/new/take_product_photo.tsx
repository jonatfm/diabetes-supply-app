import { CameraView, useCameraPermissions } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Button, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TakeProductPhoto() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string; unitsPerPack?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  if (!permission?.granted) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Camera permission is required to take a product photo.</Text>
        <Button title="Grant Permission" onPress={() => requestPermission()} />
      </SafeAreaView>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });
      if (photo?.uri) {
        const fileName = `product_${Date.now()}.jpg`;
        const file = new File(Paths.document, fileName);
        const sourceFile = new File(photo.uri);
        sourceFile.copy(file);
        router.replace({
          pathname: '/new/new_product',
          params: {
            photoUri: file.uri,
            name: params.name ?? '',
            unitsPerPack: params.unitsPerPack ?? '',
          }
        });
      }
    } catch (e) {
      console.warn('Failed to capture photo', e);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} />
      <View style={{ padding: 12 }}>
        <Button title={isCapturing ? 'Capturing…' : 'Take Product Photo'} onPress={handleCapture} disabled={isCapturing} />
        <Button title="Cancel" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}
