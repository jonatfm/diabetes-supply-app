package expo.modules.barcodeframeprocessor

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry
import com.mrousavy.camera.frameprocessors.VisionCameraProxy

class BarcodeFrameProcessorModule : Module() {
  
  init {
    // Register the frame processor plugin when this module is instantiated by Expo
    FrameProcessorPluginRegistry.addFrameProcessorPlugin(
      "scanBarcodes"
    ) { proxy: VisionCameraProxy?, options: Map<String?, Any?>? ->
      BarcodeFrameProcessorPlugin(
        proxy,
        options
      )
    }
  }
  
  override fun definition() = ModuleDefinition {
    Name("BarcodeFrameProcessor")
  }
}
