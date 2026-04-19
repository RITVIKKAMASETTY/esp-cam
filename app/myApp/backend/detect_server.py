"""
detect_server.py — FastAPI backend that mirrors EspDetector.java / Detector.java

The Java CLI:
  1. Fetches JPEG from ESP32 /capture
  2. Decodes it with OpenCV
  3. Runs MobileNet SSD (Caffe)
  4. Prints detections to stdout

This server does the SAME thing but as an HTTP endpoint so the React Native
app can call it via POST /detect with a JPEG body.

Usage:
  pip install fastapi uvicorn opencv-python-headless numpy
  python detect_server.py

  # Optional: specify paths to Caffe model files
  MODEL_PROTOXT=./model.prototxt MODEL_CAFFEMODEL=./model.caffemodel python detect_server.py
"""

import os
import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

# ── Model paths (same as in Detector.java / TestModel.java) ──────────────────
PROTOTXT  = os.getenv("MODEL_PROTOTXT",  "model.prototxt")
CAFFEMODEL= os.getenv("MODEL_CAFFEMODEL","model.caffemodel")

# Confidence threshold — 0.50 like Detector.java
CONFIDENCE_THRESHOLD = float(os.getenv("CONF_THRESHOLD", "0.5"))

# Input size — 300×300 like the Java blob creation
INPUT_SIZE = (300, 300)

# Mean subtraction — matches Dnn.blobFromImage(…, new Scalar(127.5, 127.5, 127.5))
MEAN = (127.5, 127.5, 127.5)
SCALE = 0.007843  # matches Java: 0.007843

# Classes — from EspDetector.java / labelmap.txt
CLASSES = [
    "???", "person", "bicycle", "car", "motorcycle", "airplane", "bus",
    "train", "truck", "boat", "traffic light", "fire hydrant", "???",
    "stop sign", "parking meter", "bench", "bird", "cat", "dog", "horse",
    "sheep", "cow", "elephant", "bear", "zebra", "giraffe", "???",
    "backpack", "umbrella", "???", "???", "handbag", "tie", "suitcase",
    "frisbee", "skis", "snowboard", "sports ball", "kite", "baseball bat",
    "baseball glove", "skateboard", "surfboard", "tennis racket", "bottle",
    "???", "wine glass", "cup", "fork", "knife", "spoon", "bowl", "banana",
    "apple", "sandwich", "orange", "broccoli", "carrot", "hot dog", "pizza",
    "donut", "cake", "chair", "couch", "potted plant", "bed", "???",
    "dining table", "???", "???", "toilet", "???", "tv", "laptop", "mouse",
    "remote", "keyboard", "cell phone", "microwave", "oven", "toaster",
    "sink", "refrigerator", "???", "book", "clock", "vase", "scissors",
    "teddy bear", "hair drier", "toothbrush",
]

app = FastAPI(title="BlindSist Detection Server")

# Allow React Native / Expo to call from any origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load model once at startup ───────────────────────────────────────────────
net = None

@app.on_event("startup")
def load_model():
    global net
    if os.path.exists(PROTOTXT) and os.path.exists(CAFFEMODEL):
        print(f"Loading model: {CAFFEMODEL}")
        net = cv2.dnn.readNetFromCaffe(PROTOTXT, CAFFEMODEL)
        print("✅ Model loaded")
    else:
        print("⚠️  Model files not found — running in DEMO mode (random mock detections)")
        print(f"   Expected: {PROTOTXT}, {CAFFEMODEL}")

# ── Response schema ───────────────────────────────────────────────────────────
class Detection(BaseModel):
    className: str
    confidence: float
    x: int
    y: int
    width: int
    height: int

class DetectResponse(BaseModel):
    detections: List[Detection]
    frameWidth: int
    frameHeight: int
    modelLoaded: bool

# ── POST /detect ─────────────────────────────────────────────────────────────
@app.post("/detect", response_model=DetectResponse)
async def detect(frame: UploadFile = File(...)):
    """
    Accepts a JPEG image (multipart), runs MobileNet SSD inference,
    returns JSON detections — mirrors EspDetector.java output format.
    """
    contents = await frame.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return DetectResponse(detections=[], frameWidth=0, frameHeight=0, modelLoaded=net is not None)

    h, w = img.shape[:2]

    if net is None:
        # Demo mode — return 1-2 mock detections so the UI is testable
        import random
        mock = []
        for _ in range(random.randint(0, 2)):
            cls = random.choice(["person", "car", "dog", "chair", "bottle", "laptop"])
            conf = random.uniform(0.55, 0.95)
            bx = random.randint(0, w // 2)
            by = random.randint(0, h // 2)
            bw = random.randint(w // 4, w // 2)
            bh = random.randint(h // 4, h // 2)
            mock.append(Detection(className=cls, confidence=round(conf, 3),
                                  x=bx, y=by, width=bw, height=bh))
        return DetectResponse(detections=mock, frameWidth=w, frameHeight=h, modelLoaded=False)

    # ── Real inference (same as Java) ────────────────────────────────────────
    blob = cv2.dnn.blobFromImage(img, SCALE, INPUT_SIZE, MEAN, False, False)
    net.setInput(blob)
    detections_mat = net.forward()

    results = []
    # detections_mat shape: [1, 1, N, 7]
    for i in range(detections_mat.shape[2]):
        row = detections_mat[0, 0, i]
        confidence = float(row[2])
        if confidence < CONFIDENCE_THRESHOLD:
            continue

        class_id = int(row[1])
        class_name = CLASSES[class_id] if 0 <= class_id < len(CLASSES) else "unknown"
        if class_name == "???":
            continue

        x1 = int(row[3] * w)
        y1 = int(row[4] * h)
        x2 = int(row[5] * w)
        y2 = int(row[6] * h)

        results.append(Detection(
            className=class_name,
            confidence=round(confidence, 3),
            x=x1, y=y1,
            width=max(0, x2 - x1),
            height=max(0, y2 - y1),
        ))

    return DetectResponse(
        detections=results,
        frameWidth=w,
        frameHeight=h,
        modelLoaded=True,
    )

# ── GET /health ───────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "modelLoaded": net is not None}

if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
