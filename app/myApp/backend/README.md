# BlindSist Detection Backend

Python FastAPI server that mirrors `EspDetector.java` / `Detector.java` from the CLI.

## What it does
- Accepts a JPEG frame via `POST /detect` (multipart form)
- Runs **MobileNet SSD** (Caffe) inference — same model as the Java CLI
- Returns JSON with detected objects, confidence scores, and bounding boxes
- Falls back to **demo mode** (random mock detections) if model files are missing

## Setup

```bash
pip install -r requirements.txt
```

## Running

```bash
# Demo mode (no model files needed — returns random mock detections):
python detect_server.py

# With real model files:
MODEL_PROTOTXT=../../../blindsist-cli/deploy.prototxt \
MODEL_CAFFEMODEL=../../../blindsist-cli/mobilenet_iter_73000.caffemodel \
python detect_server.py
```

Server starts on `http://0.0.0.0:5000`

## API

### `POST /detect`
- Body: `multipart/form-data` with field `frame` (JPEG image)
- Response:
```json
{
  "detections": [
    { "className": "person", "confidence": 0.92, "x": 120, "y": 80, "width": 150, "height": 200 }
  ],
  "frameWidth": 352,
  "frameHeight": 288,
  "modelLoaded": true
}
```

### `GET /health`
```json
{ "status": "ok", "modelLoaded": true }
```

## Network setup
1. Phone connects to **ESP32-CAM-AP** WiFi (password: `12345678`)
2. Run this server on your laptop on the **same network**
3. Find your laptop's IP: `ifconfig | grep 192.168.4`
4. In the app Settings tab, set Backend URL to `http://<your-laptop-ip>:5000`
