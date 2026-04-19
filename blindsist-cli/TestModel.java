import org.opencv.core.*;
import org.opencv.dnn.*;
import org.opencv.imgcodecs.Imgcodecs;
import org.opencv.imgproc.Imgproc;

public class TestModel {
    static { System.loadLibrary(Core.NATIVE_LIBRARY_NAME); }
    
    public static void main(String[] args) {
        String configPath = "D:/Projects/projects_101/TimePassProjects/blind/models/model.prototxt";
        String modelPath = "D:/Projects/projects_101/TimePassProjects/blind/models/model.caffemodel";
        
        System.out.println("=== MODEL DIAGNOSTIC (DIRECT BUFFER) ===\n");
        
        // Load model
        System.out.println("1. Loading model...");
        Net net = Dnn.readNetFromCaffe(configPath, modelPath);
        if (net.empty()) {
            System.err.println("   ❌ Failed!");
            return;
        }
        System.out.println("   ✓ Loaded\n");
        
        // Create test image
        System.out.println("2. Creating test image...");
        Mat testImg = new Mat(300, 300, CvType.CV_8UC3, new Scalar(128, 128, 128));
        Imgproc.rectangle(testImg, new Point(50, 50), new Point(250, 250), 
                         new Scalar(255, 255, 255), -1);
        Imgcodecs.imwrite("test_input.jpg", testImg);
        
        // Create blob and run inference
        System.out.println("3. Running inference...");
        Mat blob = Dnn.blobFromImage(testImg, 0.007843, new Size(300, 300), 
                                    new Scalar(127.5, 127.5, 127.5), false, false);
        net.setInput(blob);
        Mat output = net.forward();
        
        System.out.println("   Output dims: " + output.dims());
        System.out.println("   Output type: " + output.type());
        System.out.println("   Output empty: " + output.empty());
        
        // Get total elements
        long totalElements = output.total();
        int channels = output.channels();
        System.out.println("   Total elements: " + totalElements);
        System.out.println("   Channels: " + channels);
        System.out.println("   Expected: 700 elements (100 detections × 7 values)\n");
        
        // 🔧 READ ENTIRE BUFFER AT ONCE
        System.out.println("4. Reading all data as float array...");
        float[] allData = new float[(int)(totalElements * channels)];
        output.get(0, 0, allData);  // Read entire buffer
        
        System.out.println("   Elements read: " + allData.length);
        System.out.println("   First element: " + allData[0]);
        System.out.println("   Last element: " + allData[allData.length - 1]);
        
        // Check if all zeros
        boolean allZeros = true;
        for (float f : allData) {
            if (Math.abs(f) > 0.0001f) {
                allZeros = false;
                break;
            }
        }
        System.out.println("   All zeros: " + allZeros + "\n");
        
        // Parse as 100 detections × 7 values
        System.out.println("5. Parsing detections (100 × 7 = 700 values):");
        String[] classes = {"background", "aeroplane", "bicycle", "bird", "boat", "bottle",
            "bus", "car", "cat", "chair", "cow", "diningtable", "dog", 
            "horse", "motorbike", "person", "pottedplant", "sheep", "sofa", 
            "train", "tvmonitor"};
        
        int validCount = 0;
        int detectionsShown = 0;
        
        for (int i = 0; i < 100; i++) {
            int baseIdx = i * 7;
            if (baseIdx + 6 >= allData.length) break;
            
            // Each detection: [batchId, classId, confidence, x1, y1, x2, y2]
            float batchId = allData[baseIdx + 0];
            float classId = allData[baseIdx + 1];
            float confidence = allData[baseIdx + 2];
            float x1 = allData[baseIdx + 3];
            float y1 = allData[baseIdx + 4];
            float x2 = allData[baseIdx + 5];
            float y2 = allData[baseIdx + 6];
            
            if (confidence > 0.01f) {
                validCount++;
                if (detectionsShown < 10) {
                    String className = (classId >= 0 && classId < classes.length) ? 
                                      classes[(int)classId] : "unknown";
                    System.out.println("   [" + String.format("%3d", i) + "] " + 
                                     String.format("%-12s", className) + 
                                     " conf=" + String.format("%.4f", confidence) +
                                     " box=[" + String.format("%.2f", x1) + "," + 
                                     String.format("%.2f", y1) + "," +
                                     String.format("%.2f", x2) + "," + 
                                     String.format("%.2f", y2) + "]");
                    detectionsShown++;
                }
            }
        }
        
        System.out.println("\n6. Summary:");
        System.out.println("   Total detections: 100");
        System.out.println("   Valid (conf > 0.01): " + validCount);
        System.out.println("   Valid (conf > 0.15): " + countAbove(allData, 0.15f));
        System.out.println("   Valid (conf > 0.50): " + countAbove(allData, 0.50f));
        
        // Cleanup
        testImg.release();
        blob.release();
        output.release();
        
        System.out.println("\n=== DIAGNOSTIC COMPLETE ===");
        
        if (allZeros) {
            System.err.println("\n⚠️  WARNING: All output values are ZERO!");
            System.err.println("   This means the model is not producing valid detections.");
            System.err.println("   Possible causes:");
            System.err.println("   1. Model files corrupted");
            System.err.println("   2. Model incompatible with OpenCV 4.12");
            System.err.println("   3. Try different model (YOLO, SSD)");
        } else if (validCount == 0) {
            System.err.println("\n⚠️  Model produces data but no confident detections");
            System.err.println("   Try lowering confidence threshold to 0.05");
        } else {
            System.out.println("\n✅ Model is working correctly!");
        }
    }
    
    private static int countAbove(float[] data, float threshold) {
        int count = 0;
        for (int i = 0; i < 100; i++) {
            int idx = i * 7 + 2;  // Confidence is at index 2 of each detection
            if (idx < data.length && data[idx] > threshold) {
                count++;
            }
        }
        return count;
    }
}