# Diabetes Supply App - Frame Processor V2

This project contains a high-performance native barcode scanning module optimized for medical supplies (GS1 DataMatrix, etc.).

## Features

- **Native C++ Implementation**: Uses JNI and pure C++ for maximum performance.
- **Advanced Preprocessing**: Includes CLAHE, Laplacian Sharpening, and Adaptive Thresholding to handle difficult lighting and low-contrast codes.
- **Multi-Strategy Detection**: Automatically retries with different image enhancements (Grayscale, Sharpened, Inverted, etc.) if the initial scan fails.
- **High Resolution Support**: Designed to work with full-resolution images captured by Expo Camera.

## Usage

The module is located in `modules/frame-processor-v2`.

### Importing

```typescript
import { processImage, processBase64 } from '../modules/frame-processor-v2';
```

### API

#### `processImage(imagePath: string): Promise<ProcessingResult>`

Processes an image file stored on the device.

- **imagePath**: Absolute path or `file://` URI to the image.
- **Returns**: A promise resolving to a `ProcessingResult` object.

#### `processBase64(base64Image: string): Promise<ProcessingResult>`

Processes a base64-encoded image string.

- **base64Image**: The base64 string of the image.
- **Returns**: A promise resolving to a `ProcessingResult` object.

### Types

```typescript
interface ProcessingResult {
  success: boolean;
  barcodes?: BarcodeResult[];
  error?: string;
  processingTimeMs?: number;
}

interface BarcodeResult {
  format: string; // e.g., "DATA_MATRIX"
  text: string;   // The raw content
  gs1Data?: {     // Parsed GS1 keys if available
    gtin: string;
    lot: string;
    expiry: string;
    serial: string;
  };
}
```

### Example with Expo Camera

```typescript
import { CameraView, useCameraPermissions } from 'expo-camera';
import { processImage } from '../modules/frame-processor-v2';
import { useRef } from 'react';

// ... inside your component
const cameraRef = useRef<CameraView>(null);

const takePicture = async () => {
  if (cameraRef.current) {
    const photo = await cameraRef.current.takePictureAsync({
      quality: 1.0, // Use maximum quality for best results
      skipProcessing: true, // Skip internal processing for speed
    });
    
    if (photo) {
      const result = await processImage(photo.uri);
      if (result.success && result.barcodes && result.barcodes.length > 0) {
        console.log('Found barcode:', result.barcodes[0].text);
      }
    }
  }
};
```

## Building

This project uses a custom native module. You must build the native app to run it.

```bash
# Build for Android
npx expo run:android
```
