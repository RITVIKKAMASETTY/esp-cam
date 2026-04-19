import org.opencv.core.*;
import org.opencv.dnn.*;
import org.opencv.imgcodecs.Imgcodecs;

import java.io.*;
import java.net.*;
import java.util.*;

public class Detector {
    
    private static final String ESP32_IP = "192.168.4.1";
    private static final String CAPTURE_URL = "http://" + ESP32_IP + "/capture";
    
    private static final String MODEL_PATH = "D:/Projects/projects_101/TimePassProjects/blind/models/res10_300x300_ssd_iter_140000.caffemodel";
    private static final String CONFIG_PATH = "D:/Projects/projects_101/TimePassProjects/blind/models/deploy.prototxt";
    
    private static final double CONFIDENCE_THRESHOLD = 0.50;
    private static final int INPUT_WIDTH = 300;
    private static final int INPUT_HEIGHT = 300;
    
    private static final String[] CLASSES = {"background", "face/person"};
    
    public static class Detection {
        public final String className;
        public final float confidence;
        public final int x, y, width, height;
        
        public Detection(String className, float confidence, int x, int y, int w, int h) {
            this.className = className;
            this.confidence = confidence;
            this.x = x; this.y = y; this.width = w; this.height = h;
        }
        
        @Override
        public String toString() {
            return String.format("[DETECTED] %-15s @ [%3d, %3d]  (conf: %.2f)", 
                className.toUpperCase(), x, y, confidence);
        }
    }
    
    public static class ObjectDetector {
        public final Net net;
        
        public ObjectDetector(String config, String model) {
            System.out.println("Loading OpenCV SSD Face Detector...");
            this.net = Dnn.readNetFromCaffe(config, model);
            if (this.net.empty()) {
                throw new RuntimeException("Failed to load model");
            }
            System.out.println("Model loaded successfully\n");
        }
        
        public List<Detection> detect(Mat frame, int frameCount) {
            List<Detection> results = new ArrayList<>();
            
            // Create blob
            Mat blob = Dnn.blobFromImage(frame, 1.0, new Size(INPUT_WIDTH, INPUT_HEIGHT), 
                                        new Scalar(104, 177, 123), false, false);
            
            net.setInput(blob);
            Mat detection = net.forward();
            
            if (frameCount <= 3) {
                System.out.println("[DEBUG] Output: " + detection.size());
            }
            
            // Parse detections
            int numDetections = (int) detection.size(2);
            
            for (int i = 0; i < numDetections; i++) {
                double[] data = detection.get(0, i);
                if (data == null || data.length < 7) continue;
                
                float confidence = (float) data[2];
                if (confidence < CONFIDENCE_THRESHOLD) continue;
                
                // Class ID (1 = face/person for this model)
                int classId = (int) data[1];
                if (classId != 1) continue;  // Only detect faces/persons
                
                // Scale box to original image
                int x = (int) (data[3] * frame.cols());
                int y = (int) (data[4] * frame.rows());
                int x2 = (int) (data[5] * frame.cols());
                int y2 = (int) (data[6] * frame.rows());
                
                results.add(new Detection(
                    CLASSES[classId], confidence,
                    x, y, x2 - x, y2 - y
                ));
                
                if (frameCount <= 3) {
                    System.out.println("  Face/Person: " + String.format("%.3f", confidence));
                }
            }
            
            blob.release();
            detection.release();
            return results;
        }
    }
    
    // === Fetch Frame from ESP32 ===
    public static Mat fetchFrame(String url) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(10000);
        
        if (conn.getResponseCode() != 200) {
            conn.disconnect();
            return null;
        }
        
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try (InputStream is = conn.getInputStream()) {
            byte[] data = new byte[4096];
            int n;
            while ((n = is.read(data)) != -1) buffer.write(data, 0, n);
        }
        conn.disconnect();
        
        byte[] jpeg = buffer.toByteArray();
        if (jpeg.length < 1000) return null;
        
        return Imgcodecs.imdecode(new MatOfByte(jpeg), Imgcodecs.IMREAD_COLOR);
    }
    
    // === Main Loop ===
    public static void runDetection() {
        System.out.println("Connecting to ESP32-CAM...");
        try {
            Mat test = fetchFrame(CAPTURE_URL);
            if (test == null || test.empty()) {
                System.err.println("Cannot connect to " + CAPTURE_URL);
                return;
            }
            System.out.println("Connected! Frame: " + test.cols() + "x" + test.rows());
            test.release();
        } catch (IOException e) {
            System.err.println("Connection error: " + e.getMessage());
            return;
        }
        
        System.out.println("\nStarting detection (Ctrl+C to stop)...\n");
        System.out.println("Note: This model detects FACES and PERSON upper bodies");
        System.out.println("oint camera at a person's face for best results\n");
        
        ObjectDetector detector = null;
        int frames = 0;
        
        try {
            detector = new ObjectDetector(CONFIG_PATH, MODEL_PATH);
            
            while (true) {
                long start = System.currentTimeMillis();
                
                Mat frame = fetchFrame(CAPTURE_URL);
                if (frame == null || frame.empty()) {
                    Thread.sleep(500);
                    continue;
                }
                
                frames++;
                List<Detection> found = detector.detect(frame, frames);
                
                if (!found.isEmpty()) {
                    System.out.println(">>> Frame " + frames + " - " + found.size() + " object(s):");
                    for (Detection d : found) System.out.println("  " + d);
                } else if (frames % 20 == 0) {
                    System.out.println("[NO DETECTION] Frame " + frames + " - Point at a PERSON's face");
                }
                
                frame.release();
                
                long elapsed = System.currentTimeMillis() - start;
                if (elapsed < 333) Thread.sleep(333 - elapsed);
            }
            
        } catch (Exception e) {
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    // === Entry Point ===
    public static void main(String[] args) {
        
        // Check model files
        File model = new File(MODEL_PATH);
        File config = new File(CONFIG_PATH);
        
        if (!model.exists()) {
            System.err.println("Model not found: " + MODEL_PATH);
            System.err.println("   Download from OpenCV's official repo (see instructions)");
            return;
        }
        if (!config.exists()) {
            System.err.println("Config not found: " + CONFIG_PATH);
            return;
        }
        
        System.out.println("Model: " + (model.length()/1024/1024) + " MB");
        System.out.println("Config: " + (config.length()/1024) + " KB");
        System.out.println();
        
        // Load OpenCV
        try {
            System.loadLibrary(Core.NATIVE_LIBRARY_NAME);
            System.out.println("OpenCV loaded\n");
        } catch (UnsatisfiedLinkError e) {
            System.err.println("OpenCV native library not found!");
            return;
        }
        
        runDetection();
    }
}