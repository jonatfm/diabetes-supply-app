import { requireNativeModule } from 'expo-modules-core';

/**
 * Frame Processor v2 Native Module
 * High-performance barcode detection for medical supplies
 */

export interface BarcodePosition {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GS1Data {
  gtin: string;
  lot: string;
  expiry: string;
  serial: string;
  productionDate: string;
}

export interface BarcodeResult {
  format: string;
  text: string;
  confidence: number;
  orientation: number;
  boundingBox: BoundingBox;
  position: BarcodePosition[];
  gs1Data?: GS1Data;
}

export interface ProcessingResult {
  success: boolean;
  processingTimeMs?: number;
  barcodes?: BarcodeResult[];
  error?: string;
}

export interface ProcessorInfo {
  name: string;
  version: string;
  supportedFormats: string[];
  platform: string;
}

interface FrameProcessorV2ModuleType {
  processImage(imagePath: string): Promise<string>;
  processBase64(base64Image: string): Promise<string>;
  getProcessorInfo(): string;
}

const FrameProcessorV2Native = requireNativeModule<FrameProcessorV2ModuleType>('FrameProcessorV2');

/**
 * Process an image file and detect barcodes
 * @param imagePath - Path to the image file (file:// URI or absolute path)
 * @returns Processing result with detected barcodes
 */
export async function processImage(imagePath: string): Promise<ProcessingResult> {
  try {
    const resultJson = await FrameProcessorV2Native.processImage(imagePath);
    return JSON.parse(resultJson);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process a base64-encoded image and detect barcodes
 * @param base64Image - Base64 encoded image data
 * @returns Processing result with detected barcodes
 */
export async function processBase64(base64Image: string): Promise<ProcessingResult> {
  try {
    const resultJson = await FrameProcessorV2Native.processBase64(base64Image);
    return JSON.parse(resultJson);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get information about the frame processor
 * @returns Processor info including supported formats
 */
export function getProcessorInfo(): ProcessorInfo {
  const infoJson = FrameProcessorV2Native.getProcessorInfo();
  return JSON.parse(infoJson);
}

export default {
  processImage,
  processBase64,
  getProcessorInfo,
};
