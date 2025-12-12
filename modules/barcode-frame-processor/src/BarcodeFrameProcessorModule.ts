import { NativeModule, requireNativeModule } from 'expo';

declare class BarcodeFrameProcessorModule extends NativeModule<{}> {
  // Frame processor is registered in native code
}

// This call loads the native module object from the JSI.
// Loading the module registers the frame processor plugin.
export default requireNativeModule<BarcodeFrameProcessorModule>('BarcodeFrameProcessor');
