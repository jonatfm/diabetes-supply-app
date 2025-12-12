package expo.modules.frameprocessorv2

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import android.graphics.BitmapFactory
import android.util.Base64
import java.io.File

class FrameProcessorV2Module : Module() {
    
    companion object {
        init {
            System.loadLibrary("frame_processor_v2")
        }
    }
    
    override fun definition() = ModuleDefinition {
        Name("FrameProcessorV2")
        
        // Process an image file and return detected barcodes
        AsyncFunction("processImage") { imagePath: String, promise: Promise ->
            try {
                val path = if (imagePath.startsWith("file://")) {
                    imagePath.substring(7)
                } else {
                    imagePath
                }
                
                val file = File(path)
                if (!file.exists()) {
                    promise.reject("FILE_NOT_FOUND", "Image file not found: $path", null)
                    return@AsyncFunction
                }
                
                val bitmap = BitmapFactory.decodeFile(path)
                if (bitmap == null) {
                    promise.reject("DECODE_ERROR", "Could not decode image: $path", null)
                    return@AsyncFunction
                }
                
                // Convert bitmap to byte array for native processing
                val width = bitmap.width
                val height = bitmap.height
                val pixels = IntArray(width * height)
                bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
                
                // Convert ARGB to RGB bytes
                val rgbBytes = ByteArray(width * height * 3)
                for (i in 0 until width * height) {
                    val pixel = pixels[i]
                    rgbBytes[i * 3] = ((pixel shr 16) and 0xFF).toByte()     // R
                    rgbBytes[i * 3 + 1] = ((pixel shr 8) and 0xFF).toByte()  // G
                    rgbBytes[i * 3 + 2] = (pixel and 0xFF).toByte()          // B
                }
                
                // Process with native code
                val result = processImageNative(rgbBytes, width, height)
                
                bitmap.recycle()
                
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("PROCESS_ERROR", "Failed to process image: ${e.message}", e)
            }
        }
        
        // Process base64 encoded image
        AsyncFunction("processBase64") { base64Image: String, promise: Promise ->
            try {
                val imageData = Base64.decode(base64Image, Base64.DEFAULT)
                val bitmap = BitmapFactory.decodeByteArray(imageData, 0, imageData.size)
                
                if (bitmap == null) {
                    promise.reject("DECODE_ERROR", "Could not decode base64 image", null)
                    return@AsyncFunction
                }
                
                val width = bitmap.width
                val height = bitmap.height
                val pixels = IntArray(width * height)
                bitmap.getPixels(pixels, 0, width, 0, 0, width, height)
                
                val rgbBytes = ByteArray(width * height * 3)
                for (i in 0 until width * height) {
                    val pixel = pixels[i]
                    rgbBytes[i * 3] = ((pixel shr 16) and 0xFF).toByte()
                    rgbBytes[i * 3 + 1] = ((pixel shr 8) and 0xFF).toByte()
                    rgbBytes[i * 3 + 2] = (pixel and 0xFF).toByte()
                }
                
                val result = processImageNative(rgbBytes, width, height)
                
                bitmap.recycle()
                
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("PROCESS_ERROR", "Failed to process base64 image: ${e.message}", e)
            }
        }
        
        // Get processor info
        Function("getProcessorInfo") {
            return@Function getProcessorInfoNative()
        }
    }
    
    // Native method declarations
    private external fun processImageNative(imageData: ByteArray, width: Int, height: Int): String
    private external fun getProcessorInfoNative(): String
}
