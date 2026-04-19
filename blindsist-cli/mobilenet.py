
import os
import sys
import time
import urllib.request
import zipfile
import cv2
import numpy as np
import tensorflow as tf


ESP32_IP = "192.168.4.1"
CAPTURE_URL = f"http://{ESP32_IP}/capture"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(SCRIPT_DIR, "detect.tflite")
LABEL_PATH = os.path.join(SCRIPT_DIR, "labelmap.txt")

CONFIDENCE_THRESHOLD = 0.50
FPS_TARGET = 3



def load_labels(path):
    """Load COCO labels from file"""
    with open(path, 'r') as f:
        labels = [line.strip() for line in f.readlines()]
    # Remove first placeholder label if present
    if labels and labels[0] in ['???', 'background']:
        labels = labels[1:]
    return labels

def fetch_frame(url, timeout=5):
    """Fetch single JPEG frame from ESP32-CAM"""
    try:
        req = urllib.request.Request(url, headers={"Connection": "close"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = resp.read()
            if len(data) < 1000:
                return None
            arr = np.frombuffer(data, np.uint8)
            return cv2.imdecode(arr, cv2.IMREAD_COLOR)
    except:
        return None

def main():
    print("=" * 60)
    print("Blindsist Firmware - MobileNet CLI Demo")
    print("=" * 60)
    print(f"ESP32: {ESP32_IP}")
    print(f"Model: COCO SSD MobileNet V1 (TFLite)")
    print("=" * 60)
    print()
    print("Loading labels...")
    labels = load_labels(LABEL_PATH)
    print(f"Loaded {len(labels)} classes\n")
    
    # Load TFLite model
    print("Loading TFLite interpreter...")
    try:
        interpreter = tf.lite.Interpreter(model_path=MODEL_PATH)
        interpreter.allocate_tensors()
        
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()
        
        input_height = input_details[0]['shape'][1]
        input_width = input_details[0]['shape'][2]
        
    except Exception as e:
        print(f"Failed to load model: {e}")
        input("\nPress Enter to exit...")
        return
    
    # Test ESP32 connection
    print("Testing ESP32 connection...")
    test = fetch_frame(CAPTURE_URL, timeout=3)
    if test is None or test.size == 0:
        print(f"Cannot connect to {CAPTURE_URL}")
        print("Connect to ESP32-CAM-AP WiFi (pass: 12345678)")
        input("\nPress Enter to exit...")
        return
    print(f"Connected! Frame: {test.shape[1]}x{test.shape[0]}\n")
    
    # Main detection loop
    print("Starting detection (Ctrl+C to stop)...")
    print("-" * 60)
    
    frame_count = 0
    try:
        while True:
            start = time.time()
            
            # Fetch frame from ESP32
            frame = fetch_frame(CAPTURE_URL)
            if frame is None or frame.size == 0:
                time.sleep(0.5)
                continue
            
            frame_count += 1
            imH, imW = frame.shape[:2]
            
            # Preprocess: resize to model input size
            image_resized = cv2.resize(frame, (input_width, input_height))
            input_data = np.expand_dims(image_resized, axis=0)
            
            # Run inference
            interpreter.set_tensor(input_details[0]['index'], input_data)
            interpreter.invoke()
            
            # Get outputs
            boxes = interpreter.get_tensor(output_details[0]['index'])[0]   # [N, 4]
            classes = interpreter.get_tensor(output_details[1]['index'])[0] # [N]
            scores = interpreter.get_tensor(output_details[2]['index'])[0]  # [N]
            
            # Parse detections
            found = False
            for i in range(len(scores)):
                if scores[i] < CONFIDENCE_THRESHOLD:
                    continue
                
                # Get class name (handle index offset)
                cls_idx = int(classes[i])
                if cls_idx < len(labels):
                    name = labels[cls_idx].upper()
                else:
                    name = f"CLASS_{cls_idx}"
                
                # Scale box to original image size
                ymin = int(max(0, boxes[i][0] * imH))
                xmin = int(max(0, boxes[i][1] * imW))
                ymax = int(min(imH, boxes[i][2] * imH))
                xmax = int(min(imW, boxes[i][3] * imW))
                
                # Calculate center point for output
                cx = (xmin + xmax) // 2
                cy = (ymin + ymax) // 2
                
                print(f"[DETECTION]{name:<12} @ [{cx:3d}, {cy:3d}]  (conf: {scores[i]:.2f})")
                found = True
            
            if not found and frame_count % 20 == 0:
                print(f"[NO DETECTION] Frame {frame_count} - Point at person/bottle/chair")
            
            # Throttle FPS
            elapsed = time.time() - start
            if elapsed < (1.0 / FPS_TARGET):
                time.sleep((1.0 / FPS_TARGET) - elapsed)
                
    except KeyboardInterrupt:
        print(f"\nStopped by user")
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()