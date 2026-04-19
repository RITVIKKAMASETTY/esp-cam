import org.opencv.core.*;
import org.opencv.dnn.*;
import org.opencv.imgcodecs.Imgcodecs;
import java.io.InputStream;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

public class EspDetector {
    static { System.loadLibrary(Core.NATIVE_LIBRARY_NAME); }

    public static void main(String[] args) throws Exception {
        String cameraUrl = "http://192.168.4.1/capture"; // Your ESP32 IP
        
        // Load the model
        Net net = Dnn.readNetFromCaffe("deploy.prototxt", "mobilenet_iter_73000.caffemodel");
        String[] classNames = {"background", "aeroplane", "bicycle", "bird", "boat", "bottle", "bus", "car", "cat", "chair", "cow", "diningtable", "dog", "horse", "motorbike", "person", "pottedplant", "sheep", "sofa", "train", "tvmonitor"};

        System.out.println("Scanning ESP32 feed...");

        while (true) {
            try {
                // 1. Download image from ESP32
                URL url = new URL(cameraUrl);
                byte[] imageBytes;
                try (InputStream in = url.openStream()) {
                    imageBytes = in.readAllBytes();
                }

                // 2. Decode bytes to OpenCV Mat
                Mat frame = Imgcodecs.imdecode(new MatOfByte(imageBytes), Imgcodecs.IMREAD_COLOR);
                if (frame.empty()) continue;

                // 3. Pre-process (Blobbing)
                Mat blob = Dnn.blobFromImage(frame, 0.007843, new Size(300, 300), new Scalar(127.5, 127.5, 127.5));
                net.setInput(blob);

                // 4. Inference
                Mat detections = net.forward();
                detections = detections.reshape(1, (int)detections.total() / 7);

                // 5. Parse Results
                for (int i = 0; i < detections.rows(); i++) {
                    double confidence = detections.get(i, 2)[0];
                    if (confidence > 0.5) { // 50% threshold
                        int classId = (int)detections.get(i, 1)[0];
                        
                        // Positions are normalized (0.0 to 1.0)
                        double x1 = detections.get(i, 3)[0] * frame.cols();
                        double y1 = detections.get(i, 4)[0] * frame.rows();
                        double x2 = detections.get(i, 5)[0] * frame.cols();
                        double y2 = detections.get(i, 6)[0] * frame.rows();

                        System.out.printf("Detected: %s (%.2f%%) at [%.0f, %.0f] to [%.0f, %.0f]%n", 
                                          classNames[classId], confidence * 100, x1, y1, x2, y2);
                    }
                }
                Thread.sleep(50); // Don't DDOS your ESP32
            } catch (Exception e) {
                System.out.println("Error: " + e.getMessage());
                Thread.sleep(1000);
            }
        }
    }
}