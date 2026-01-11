import AppWrapper from '@/components/AppWrapper';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TakeProductPhoto() {
  const router = useRouter();
  const params = useLocalSearchParams<{ name?: string; unitsPerPack?: string; isSessionBased?: string; nominalSessionTimeDays?: string; useColoredDotsForProduct?: string; returnTo?: string; id?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(false);

  if (!permission?.granted) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Camera permission is required to take a product photo.</Text>
        <Button mode="contained" onPress={() => requestPermission()} >
          Grant Permission
        </Button>
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
        setFlashEnabled(false);
        const fileName = `product_${Date.now()}.jpg`;
        const file = new File(Paths.document, fileName);
        const sourceFile = new File(photo.uri);
        sourceFile.copy(file);
        if (params.returnTo) {
          router.replace({
            pathname: '/product/settings/[id]',
            params: {
              photoUri: file.uri,
              id: params.id ?? '',
              name: params.name ?? '',
              unitsPerPack: params.unitsPerPack ?? '',
              isSessionBased: params.isSessionBased ?? '',
              nominalSessionTimeDays: params.nominalSessionTimeDays ?? '',
              useColoredDotsForProduct: params.useColoredDotsForProduct ?? '',
            }
          });
        } else {
          router.replace({
            pathname: '/new/new_product',
            params: {
              photoUri: file.uri,
              name: params.name ?? '',
              unitsPerPack: params.unitsPerPack ?? '',
              isSessionBased: params.isSessionBased ?? '',
              nominalSessionTimeDays: params.nominalSessionTimeDays ?? '',
              useColoredDotsForProduct: params.useColoredDotsForProduct ?? '',
            }
          });
        }
      }
    } catch (e) {
      console.warn('Failed to capture photo', e);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <AppWrapper>
      <Text variant="headlineLarge">Take Product Photo</Text>
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
        <Button icon="camera" loading={isCapturing} mode="contained" onPress={handleCapture} disabled={isCapturing}>
          {isCapturing ? 'Capturing...' : 'Take Picture'}
        </Button>
      </View>
    </AppWrapper>
  );
}
