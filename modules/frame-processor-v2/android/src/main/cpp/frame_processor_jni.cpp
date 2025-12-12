/**
 * @file frame_processor_jni.cpp
 * @brief JNI wrapper for frame processor v2 using ZXing-cpp
 * 
 * Implements preprocessing techniques similar to the OpenCV-based frame_processor.cpp
 * but using pure C++ for Android NDK compatibility.
 */

#include <jni.h>
#include <android/log.h>
#include <string>
#include <sstream>
#include <vector>
#include <chrono>
#include <algorithm>
#include <cmath>
#include <numeric>
#include <set>

#include "ReadBarcode.h"
#include "ImageView.h"
#include "BarcodeFormat.h"
#include "Result.h"

#define LOG_TAG "FrameProcessorV2"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

namespace {

    // ============================================
    // Image Preprocessing Functions
    // ============================================
    
    // Convert RGB to grayscale using luminance formula
    std::vector<uint8_t> rgbToGrayscale(const uint8_t* rgb, int width, int height) {
        std::vector<uint8_t> gray(width * height);
        for (int i = 0; i < width * height; ++i) {
            int r = rgb[i * 3];
            int g = rgb[i * 3 + 1];
            int b = rgb[i * 3 + 2];
            // ITU-R BT.601 luminance formula (same as OpenCV)
            gray[i] = static_cast<uint8_t>((r * 299 + g * 587 + b * 114) / 1000);
        }
        return gray;
    }
    
    // Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
    std::vector<uint8_t> applyCLAHE(const std::vector<uint8_t>& gray, int width, int height, 
                                     int tileSize = 8, float clipLimit = 2.0f) {
        std::vector<uint8_t> result(gray.size());
        
        int tilesX = (width + tileSize - 1) / tileSize;
        int tilesY = (height + tileSize - 1) / tileSize;
        
        // Process each tile
        std::vector<std::vector<int>> histograms(tilesX * tilesY, std::vector<int>(256, 0));
        std::vector<std::vector<uint8_t>> luts(tilesX * tilesY, std::vector<uint8_t>(256));
        
        // Build histograms for each tile
        for (int ty = 0; ty < tilesY; ++ty) {
            for (int tx = 0; tx < tilesX; ++tx) {
                int tileIdx = ty * tilesX + tx;
                int startX = tx * tileSize;
                int startY = ty * tileSize;
                int endX = std::min(startX + tileSize, width);
                int endY = std::min(startY + tileSize, height);
                int tilePixels = (endX - startX) * (endY - startY);
                
                // Build histogram
                for (int y = startY; y < endY; ++y) {
                    for (int x = startX; x < endX; ++x) {
                        histograms[tileIdx][gray[y * width + x]]++;
                    }
                }
                
                // Clip histogram
                int clipValue = static_cast<int>(clipLimit * tilePixels / 256);
                int excess = 0;
                for (int i = 0; i < 256; ++i) {
                    if (histograms[tileIdx][i] > clipValue) {
                        excess += histograms[tileIdx][i] - clipValue;
                        histograms[tileIdx][i] = clipValue;
                    }
                }
                
                // Redistribute excess
                int avgIncrease = excess / 256;
                for (int i = 0; i < 256; ++i) {
                    histograms[tileIdx][i] += avgIncrease;
                }
                
                // Build CDF (lookup table)
                int sum = 0;
                for (int i = 0; i < 256; ++i) {
                    sum += histograms[tileIdx][i];
                    luts[tileIdx][i] = static_cast<uint8_t>(std::min(255, sum * 255 / tilePixels));
                }
            }
        }
        
        // Apply with bilinear interpolation between tiles
        for (int y = 0; y < height; ++y) {
            for (int x = 0; x < width; ++x) {
                float tx = (x + 0.5f) / tileSize - 0.5f;
                float ty = (y + 0.5f) / tileSize - 0.5f;
                
                int tx0 = std::max(0, static_cast<int>(std::floor(tx)));
                int tx1 = std::min(tilesX - 1, tx0 + 1);
                int ty0 = std::max(0, static_cast<int>(std::floor(ty)));
                int ty1 = std::min(tilesY - 1, ty0 + 1);
                
                float fx = tx - tx0;
                float fy = ty - ty0;
                
                uint8_t val = gray[y * width + x];
                
                float v00 = luts[ty0 * tilesX + tx0][val];
                float v10 = luts[ty0 * tilesX + tx1][val];
                float v01 = luts[ty1 * tilesX + tx0][val];
                float v11 = luts[ty1 * tilesX + tx1][val];
                
                float interpolated = v00 * (1-fx) * (1-fy) + v10 * fx * (1-fy) + 
                                   v01 * (1-fx) * fy + v11 * fx * fy;
                
                result[y * width + x] = static_cast<uint8_t>(std::clamp(interpolated, 0.0f, 255.0f));
            }
        }
        
        return result;
    }
    
    // Apply unsharp masking for sharpening
    std::vector<uint8_t> applySharpen(const std::vector<uint8_t>& gray, int width, int height, float strength = 1.5f) {
        std::vector<uint8_t> result(gray.size());
        
        // Simple 3x3 Laplacian sharpening
        for (int y = 1; y < height - 1; ++y) {
            for (int x = 1; x < width - 1; ++x) {
                int idx = y * width + x;
                
                // Laplacian (edge detection)
                int laplacian = 
                    -gray[(y-1) * width + x] 
                    - gray[y * width + (x-1)] 
                    + 4 * gray[idx] 
                    - gray[y * width + (x+1)] 
                    - gray[(y+1) * width + x];
                
                // Add scaled laplacian to original
                int sharpened = static_cast<int>(gray[idx] + strength * laplacian);
                result[idx] = static_cast<uint8_t>(std::clamp(sharpened, 0, 255));
            }
        }
        
        // Copy edges
        for (int x = 0; x < width; ++x) {
            result[x] = gray[x];
            result[(height-1) * width + x] = gray[(height-1) * width + x];
        }
        for (int y = 0; y < height; ++y) {
            result[y * width] = gray[y * width];
            result[y * width + (width-1)] = gray[y * width + (width-1)];
        }
        
        return result;
    }
    
    // Apply adaptive thresholding (similar to OpenCV's adaptiveThreshold)
    std::vector<uint8_t> applyAdaptiveThreshold(const std::vector<uint8_t>& gray, int width, int height, 
                                                  int blockSize = 51, int constant = 10) {
        std::vector<uint8_t> result(gray.size());
        
        // Use integral image for fast local mean computation
        std::vector<uint64_t> integral(width * height, 0);
        
        // Build integral image
        for (int y = 0; y < height; ++y) {
            uint64_t rowSum = 0;
            for (int x = 0; x < width; ++x) {
                rowSum += gray[y * width + x];
                integral[y * width + x] = rowSum + (y > 0 ? integral[(y-1) * width + x] : 0);
            }
        }
        
        int halfBlock = blockSize / 2;
        
        // Apply threshold
        for (int y = 0; y < height; ++y) {
            for (int x = 0; x < width; ++x) {
                int x0 = std::max(0, x - halfBlock);
                int y0 = std::max(0, y - halfBlock);
                int x1 = std::min(width - 1, x + halfBlock);
                int y1 = std::min(height - 1, y + halfBlock);
                
                int count = (x1 - x0 + 1) * (y1 - y0 + 1);
                
                // Get sum from integral image
                uint64_t sum = integral[y1 * width + x1];
                if (x0 > 0) sum -= integral[y1 * width + (x0 - 1)];
                if (y0 > 0) sum -= integral[(y0 - 1) * width + x1];
                if (x0 > 0 && y0 > 0) sum += integral[(y0 - 1) * width + (x0 - 1)];
                
                int threshold = static_cast<int>(sum / count) - constant;
                result[y * width + x] = (gray[y * width + x] > threshold) ? 255 : 0;
            }
        }
        
        return result;
    }
    
    // Invert image
    std::vector<uint8_t> invertImage(const std::vector<uint8_t>& img) {
        std::vector<uint8_t> result(img.size());
        for (size_t i = 0; i < img.size(); ++i) {
            result[i] = 255 - img[i];
        }
        return result;
    }
    
    // Downscale image by factor
    std::vector<uint8_t> downscale(const std::vector<uint8_t>& img, int width, int height, 
                                    int& newWidth, int& newHeight, float scale) {
        newWidth = static_cast<int>(width * scale);
        newHeight = static_cast<int>(height * scale);
        
        std::vector<uint8_t> result(newWidth * newHeight);
        
        float invScale = 1.0f / scale;
        for (int y = 0; y < newHeight; ++y) {
            for (int x = 0; x < newWidth; ++x) {
                int srcX = std::min(static_cast<int>(x * invScale), width - 1);
                int srcY = std::min(static_cast<int>(y * invScale), height - 1);
                result[y * newWidth + x] = img[srcY * width + srcX];
            }
        }
        
        return result;
    }
    
    // Try to detect barcodes with given image and options
    ZXing::Results detectBarcodes(const std::vector<uint8_t>& img, int width, int height,
                                   const ZXing::ReaderOptions& options) {
        ZXing::ImageView imageView(img.data(), width, height, ZXing::ImageFormat::Lum);
        return ZXing::ReadBarcodes(imageView, options);
    }

    std::string escapeJson(const std::string& s) {
        std::ostringstream o;
        for (char c : s) {
            switch (c) {
                case '"': o << "\\\""; break;
                case '\\': o << "\\\\"; break;
                case '\b': o << "\\b"; break;
                case '\f': o << "\\f"; break;
                case '\n': o << "\\n"; break;
                case '\r': o << "\\r"; break;
                case '\t': o << "\\t"; break;
                default:
                    if ('\x00' <= c && c <= '\x1f') {
                        o << "\\u" << std::hex << (int)c;
                    } else {
                        o << c;
                    }
            }
        }
        return o.str();
    }
    
    std::string formatToString(ZXing::BarcodeFormat format) {
        switch (format) {
            case ZXing::BarcodeFormat::DataMatrix: return "DataMatrix";
            case ZXing::BarcodeFormat::EAN8: return "EAN8";
            case ZXing::BarcodeFormat::EAN13: return "EAN13";
            case ZXing::BarcodeFormat::Code128: return "Code128";
            case ZXing::BarcodeFormat::UPCA: return "UPCA";
            case ZXing::BarcodeFormat::UPCE: return "UPCE";
            case ZXing::BarcodeFormat::QRCode: return "QRCode";
            case ZXing::BarcodeFormat::Code39: return "Code39";
            case ZXing::BarcodeFormat::ITF: return "ITF";
            case ZXing::BarcodeFormat::Codabar: return "Codabar";
            default: return "Unknown";
        }
    }
    
    // Parse GS1 data from barcode text
    struct GS1Data {
        std::string gtin;
        std::string lot;
        std::string expiry;
        std::string serial;
        std::string productionDate;
    };
    
    GS1Data parseGS1(const std::string& text) {
        GS1Data data;
        std::string working = text;
        
        // Replace FNC1 and GS characters
        const char FNC1 = '\x1D';
        const char GS = '\x1D';
        
        size_t pos = 0;
        while (pos < working.length()) {
            // Skip FNC1/GS characters
            if (working[pos] == FNC1 || working[pos] == GS) {
                pos++;
                continue;
            }
            
            if (pos + 2 > working.length()) break;
            
            std::string ai = working.substr(pos, 2);
            
            if (ai == "01" && pos + 16 <= working.length()) {
                // GTIN (14 digits)
                data.gtin = working.substr(pos + 2, 14);
                pos += 16;
            } else if (ai == "10") {
                // Lot number (variable length, ends at FNC1 or GS)
                pos += 2;
                size_t end = working.find_first_of(std::string(1, FNC1) + std::string(1, GS), pos);
                if (end == std::string::npos) end = working.length();
                data.lot = working.substr(pos, end - pos);
                pos = end;
            } else if (ai == "17" && pos + 8 <= working.length()) {
                // Expiry date (YYMMDD)
                data.expiry = working.substr(pos + 2, 6);
                pos += 8;
            } else if (ai == "21") {
                // Serial number (variable length)
                pos += 2;
                size_t end = working.find_first_of(std::string(1, FNC1) + std::string(1, GS), pos);
                if (end == std::string::npos) end = working.length();
                data.serial = working.substr(pos, end - pos);
                pos = end;
            } else if (ai == "11" && pos + 8 <= working.length()) {
                // Production date (YYMMDD)
                data.productionDate = working.substr(pos + 2, 6);
                pos += 8;
            } else {
                // Unknown AI, skip to next FNC1/GS or advance
                pos++;
            }
        }
        
        return data;
    }
    
    std::string resultsToJson(const ZXing::Results& results, double processingTimeMs) {
        std::ostringstream json;
        json << "{";
        json << "\"success\":true,";
        json << "\"processingTimeMs\":" << processingTimeMs << ",";
        json << "\"barcodes\":[";
        
        bool first = true;
        for (const auto& result : results) {
            if (!result.isValid()) continue;
            
            if (!first) json << ",";
            first = false;
            
            std::string text = result.text();
            auto format = result.format();
            auto pos = result.position();
            
            json << "{";
            json << "\"format\":\"" << formatToString(format) << "\",";
            json << "\"text\":\"" << escapeJson(text) << "\",";
            json << "\"confidence\":" << (result.isValid() ? 1.0 : 0.0) << ",";
            json << "\"orientation\":" << result.orientation() << ",";
            
            // Bounding box
            int minX = std::min({pos.topLeft().x, pos.topRight().x, pos.bottomLeft().x, pos.bottomRight().x});
            int maxX = std::max({pos.topLeft().x, pos.topRight().x, pos.bottomLeft().x, pos.bottomRight().x});
            int minY = std::min({pos.topLeft().y, pos.topRight().y, pos.bottomLeft().y, pos.bottomRight().y});
            int maxY = std::max({pos.topLeft().y, pos.topRight().y, pos.bottomLeft().y, pos.bottomRight().y});
            
            json << "\"boundingBox\":{";
            json << "\"x\":" << minX << ",";
            json << "\"y\":" << minY << ",";
            json << "\"width\":" << (maxX - minX) << ",";
            json << "\"height\":" << (maxY - minY);
            json << "},";
            
            // Position (corners)
            json << "\"position\":[";
            json << "{\"x\":" << pos.topLeft().x << ",\"y\":" << pos.topLeft().y << "},";
            json << "{\"x\":" << pos.topRight().x << ",\"y\":" << pos.topRight().y << "},";
            json << "{\"x\":" << pos.bottomRight().x << ",\"y\":" << pos.bottomRight().y << "},";
            json << "{\"x\":" << pos.bottomLeft().x << ",\"y\":" << pos.bottomLeft().y << "}";
            json << "]";
            
            // GS1 data for DataMatrix and Code128
            if (format == ZXing::BarcodeFormat::DataMatrix || format == ZXing::BarcodeFormat::Code128) {
                GS1Data gs1 = parseGS1(text);
                if (!gs1.gtin.empty() || !gs1.lot.empty() || !gs1.expiry.empty()) {
                    json << ",\"gs1Data\":{";
                    json << "\"gtin\":\"" << escapeJson(gs1.gtin) << "\",";
                    json << "\"lot\":\"" << escapeJson(gs1.lot) << "\",";
                    json << "\"expiry\":\"" << escapeJson(gs1.expiry) << "\",";
                    json << "\"serial\":\"" << escapeJson(gs1.serial) << "\",";
                    json << "\"productionDate\":\"" << escapeJson(gs1.productionDate) << "\"";
                    json << "}";
                }
            }
            
            json << "}";
        }
        
        json << "]}";
        return json.str();
    }
}

extern "C" {

JNIEXPORT jstring JNICALL
Java_expo_modules_frameprocessorv2_FrameProcessorV2Module_processImageNative(
        JNIEnv *env,
        jobject thiz,
        jbyteArray imageData,
        jint width,
        jint height) {
    
    LOGI("Processing image %dx%d with enhanced preprocessing", width, height);
    
    auto startTime = std::chrono::high_resolution_clock::now();
    
    try {
        // Get byte array
        jbyte* data = env->GetByteArrayElements(imageData, nullptr);
        if (!data) {
            return env->NewStringUTF("{\"success\":false,\"error\":\"Failed to get image data\"}");
        }
        
        const uint8_t* rgbData = reinterpret_cast<const uint8_t*>(data);
        
        // Configure ZXing reader options
        ZXing::ReaderOptions options;
        options.setFormats(
            ZXing::BarcodeFormat::DataMatrix |
            ZXing::BarcodeFormat::Code128 |
            ZXing::BarcodeFormat::EAN13 |
            ZXing::BarcodeFormat::UPCA |
            ZXing::BarcodeFormat::QRCode |
            ZXing::BarcodeFormat::EAN8 |
            ZXing::BarcodeFormat::UPCE |
            ZXing::BarcodeFormat::Code39 |
            ZXing::BarcodeFormat::ITF
        );
        options.setTryHarder(true);
        options.setTryRotate(true);
        options.setTryInvert(true);
        options.setTryDownscale(true);
        options.setMaxNumberOfSymbols(10);
        
        // Collect all results from different preprocessing strategies
        ZXing::Results allResults;
        std::set<std::string> seenBarcodes;  // To avoid duplicates
        
        auto addUniqueResults = [&](const ZXing::Results& newResults) {
            for (const auto& result : newResults) {
                if (result.isValid()) {
                    std::string key = ZXing::ToString(result.format()) + ":" + result.text();
                    if (seenBarcodes.find(key) == seenBarcodes.end()) {
                        seenBarcodes.insert(key);
                        allResults.push_back(result);
                    }
                }
            }
        };
        
        // ============================================
        // Strategy 1: Simple grayscale (fast, works for good images)
        // ============================================
        LOGI("Trying strategy 1: Simple grayscale");
        auto grayscale = rgbToGrayscale(rgbData, width, height);
        auto results1 = detectBarcodes(grayscale, width, height, options);
        addUniqueResults(results1);
        
        if (!allResults.empty()) {
            LOGI("Strategy 1 found %zu barcodes", allResults.size());
        }
        
        // ============================================
        // Strategy 2: CLAHE contrast enhancement
        // ============================================
        if (allResults.empty()) {
            LOGI("Trying strategy 2: CLAHE enhancement");
            auto claheImg = applyCLAHE(grayscale, width, height, 8, 2.5f);
            auto results2 = detectBarcodes(claheImg, width, height, options);
            addUniqueResults(results2);
            
            if (!allResults.empty()) {
                LOGI("Strategy 2 found %zu barcodes", allResults.size());
            }
        }
        
        // ============================================
        // Strategy 3: Sharpened image
        // ============================================
        if (allResults.empty()) {
            LOGI("Trying strategy 3: Sharpening");
            auto sharpened = applySharpen(grayscale, width, height, 1.5f);
            auto results3 = detectBarcodes(sharpened, width, height, options);
            addUniqueResults(results3);
            
            if (!allResults.empty()) {
                LOGI("Strategy 3 found %zu barcodes", allResults.size());
            }
        }
        
        // ============================================
        // Strategy 4: CLAHE + Sharpening combination
        // ============================================
        if (allResults.empty()) {
            LOGI("Trying strategy 4: CLAHE + Sharpening");
            auto claheImg = applyCLAHE(grayscale, width, height, 8, 3.0f);
            auto sharpened = applySharpen(claheImg, width, height, 1.2f);
            auto results4 = detectBarcodes(sharpened, width, height, options);
            addUniqueResults(results4);
            
            if (!allResults.empty()) {
                LOGI("Strategy 4 found %zu barcodes", allResults.size());
            }
        }
        
        // ============================================
        // Strategy 5: Adaptive threshold (for difficult lighting)
        // ============================================
        if (allResults.empty()) {
            LOGI("Trying strategy 5: Adaptive thresholding");
            auto claheImg = applyCLAHE(grayscale, width, height, 8, 2.5f);
            auto binarized = applyAdaptiveThreshold(claheImg, width, height, 51, 10);
            auto results5 = detectBarcodes(binarized, width, height, options);
            addUniqueResults(results5);
            
            if (!allResults.empty()) {
                LOGI("Strategy 5 found %zu barcodes", allResults.size());
            }
        }
        
        // ============================================
        // Strategy 6: Inverted image (for negative barcodes)
        // ============================================
        if (allResults.empty()) {
            LOGI("Trying strategy 6: Inverted image");
            auto inverted = invertImage(grayscale);
            auto results6 = detectBarcodes(inverted, width, height, options);
            addUniqueResults(results6);
            
            if (!allResults.empty()) {
                LOGI("Strategy 6 found %zu barcodes", allResults.size());
            }
        }
        
        // ============================================
        // Strategy 7: Downscaled image (for very high res images)
        // ============================================
        if (allResults.empty() && width > 1500) {
            LOGI("Trying strategy 7: Downscaled image");
            int newWidth, newHeight;
            float scale = 1500.0f / std::max(width, height);
            auto downscaled = downscale(grayscale, width, height, newWidth, newHeight, scale);
            auto downscaledClahe = applyCLAHE(downscaled, newWidth, newHeight, 8, 2.5f);
            auto results7 = detectBarcodes(downscaledClahe, newWidth, newHeight, options);
            addUniqueResults(results7);
            
            if (!allResults.empty()) {
                LOGI("Strategy 7 found %zu barcodes", allResults.size());
            }
        }
        
        // ============================================
        // Strategy 8: Upscaled center region (for small barcodes)
        // ============================================
        if (allResults.empty() && width > 1000 && height > 1000) {
            LOGI("Trying strategy 8: Center crop with CLAHE");
            // Extract center region
            int cropSize = std::min(width, height) / 2;
            int startX = (width - cropSize) / 2;
            int startY = (height - cropSize) / 2;
            
            std::vector<uint8_t> centerCrop(cropSize * cropSize);
            for (int y = 0; y < cropSize; ++y) {
                for (int x = 0; x < cropSize; ++x) {
                    centerCrop[y * cropSize + x] = grayscale[(startY + y) * width + (startX + x)];
                }
            }
            
            auto croppedClahe = applyCLAHE(centerCrop, cropSize, cropSize, 8, 3.0f);
            auto croppedSharp = applySharpen(croppedClahe, cropSize, cropSize, 1.5f);
            auto results8 = detectBarcodes(croppedSharp, cropSize, cropSize, options);
            addUniqueResults(results8);
            
            if (!allResults.empty()) {
                LOGI("Strategy 8 found %zu barcodes", allResults.size());
            }
        }
        
        // Release byte array
        env->ReleaseByteArrayElements(imageData, data, JNI_ABORT);
        
        auto endTime = std::chrono::high_resolution_clock::now();
        double processingTimeMs = std::chrono::duration<double, std::milli>(endTime - startTime).count();
        
        LOGI("Total: Found %zu unique barcodes in %.2f ms", allResults.size(), processingTimeMs);
        
        // Convert to JSON
        std::string json = resultsToJson(allResults, processingTimeMs);
        return env->NewStringUTF(json.c_str());
        
    } catch (const std::exception& e) {
        LOGE("Error processing image: %s", e.what());
        std::string error = "{\"success\":false,\"error\":\"" + std::string(e.what()) + "\"}";
        return env->NewStringUTF(error.c_str());
    } catch (...) {
        LOGE("Unknown error processing image");
        return env->NewStringUTF("{\"success\":false,\"error\":\"Unknown error\"}");
    }
}

JNIEXPORT jstring JNICALL
Java_expo_modules_frameprocessorv2_FrameProcessorV2Module_getProcessorInfoNative(
        JNIEnv *env,
        jobject thiz) {
    
    std::ostringstream json;
    json << "{";
    json << "\"name\":\"FrameProcessorV2\",";
    json << "\"version\":\"1.0.0\",";
    json << "\"supportedFormats\":[\"DataMatrix\",\"Code128\",\"EAN13\",\"UPCA\",\"QRCode\",\"EAN8\",\"UPCE\",\"Code39\",\"ITF\"],";
    json << "\"platform\":\"Android\"";
    json << "}";
    
    return env->NewStringUTF(json.str().c_str());
}

} // extern "C"
