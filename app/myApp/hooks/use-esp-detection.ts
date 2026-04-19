/**
 * useEspDetection
 *
 * Mirrors the EspDetector.java CLI logic:
 *  1. Polls ESP32 /capture endpoint for a JPEG image
 *  2. Sends it to the Python detection backend (or uses a mock)
 *  3. Returns detected objects, current frame URI, connection status
 *
 * ESP32 endpoints (from esp32_cam_server.ino):
 *   http://<ip>/capture  → single JPEG frame
 *   http://<ip>/stream   → MJPEG stream
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Detection {
  className: string;
  confidence: number; // 0.0 – 1.0
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface EspDetectionState {
  frameUri: string | null;
  detections: Detection[];
  status: ConnectionStatus;
  errorMsg: string | null;
  fps: number;
  frameCount: number;
  espIp: string;
  backendUrl: string;
  setEspIp: (ip: string) => void;
  setBackendUrl: (url: string) => void;
  start: () => void;
  stop: () => void;
  isRunning: boolean;
}

// MobileNet SSD classes — same list used in EspDetector.java / labelmap.txt
export const CLASSES = [
  '???', 'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train',
  'truck', 'boat', 'traffic light', 'fire hydrant', '???', 'stop sign',
  'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
  'elephant', 'bear', 'zebra', 'giraffe', '???', 'backpack', 'umbrella',
  '???', '???', 'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard',
  'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard',
  'surfboard', 'tennis racket', 'bottle', '???', 'wine glass', 'cup',
  'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich', 'orange',
  'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair',
  'couch', 'potted plant', 'bed', '???', 'dining table', '???', '???',
  'toilet', '???', 'tv', 'laptop', 'mouse', 'remote', 'keyboard',
  'cell phone', 'microwave', 'oven', 'toaster', 'sink', 'refrigerator',
  '???', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier',
  'toothbrush',
];

const STORAGE_KEYS = {
  ESP_IP: '@blindsist/esp_ip',
  BACKEND_URL: '@blindsist/backend_url',
};

const DEFAULT_ESP_IP = '192.168.4.1'; // from Detector.java
const DEFAULT_BACKEND = 'http://192.168.4.2:5000'; // Python backend (see backend/)

export function useEspDetection(): EspDetectionState {
  const [espIp, setEspIpState] = useState(DEFAULT_ESP_IP);
  const [backendUrl, setBackendUrlState] = useState(DEFAULT_BACKEND);
  const [frameUri, setFrameUri] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const fpsFrames = useRef(0);
  const fpsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved settings on mount
  useEffect(() => {
    (async () => {
      try {
        const savedIp = await AsyncStorage.getItem(STORAGE_KEYS.ESP_IP);
        const savedBackend = await AsyncStorage.getItem(STORAGE_KEYS.BACKEND_URL);
        if (savedIp) setEspIpState(savedIp);
        if (savedBackend) setBackendUrlState(savedBackend);
      } catch (_) {}
    })();
  }, []);

  const setEspIp = useCallback(async (ip: string) => {
    setEspIpState(ip);
    await AsyncStorage.setItem(STORAGE_KEYS.ESP_IP, ip).catch(() => {});
  }, []);

  const setBackendUrl = useCallback(async (url: string) => {
    setBackendUrlState(url);
    await AsyncStorage.setItem(STORAGE_KEYS.BACKEND_URL, url).catch(() => {});
  }, []);

  /**
   * Fetch a single JPEG frame from ESP32 /capture
   * Returns base64 data URI string
   */
  const fetchFrame = useCallback(async (ip: string): Promise<string> => {
    const captureUrl = `http://${ip}/capture`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const resp = await fetch(captureUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  /**
   * Send frame to Python backend for detection.
   * The backend mirrors EspDetector.java: receives JPEG, runs MobileNet SSD, returns JSON.
   * Falls back to empty array if backend unreachable.
   */
  const runDetection = useCallback(async (
    frameDataUri: string,
    backend: string,
  ): Promise<Detection[]> => {
    try {
      // Convert data URI to blob
      const base64 = frameDataUri.split(',')[1];
      const byteChars = atob(base64);
      const byteNums = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteNums], { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('frame', blob, 'frame.jpg');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const resp = await fetch(`${backend}/detect`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) return [];
      const json: { detections: Detection[] } = await resp.json();
      return json.detections ?? [];
    } catch {
      // Backend not available — return empty (no crash like CLI)
      return [];
    }
  }, []);

  const pollLoop = useCallback(async (ip: string, backend: string) => {
    if (!runningRef.current) return;

    try {
      setStatus('connecting');
      const dataUri = await fetchFrame(ip);
      setFrameUri(dataUri);
      setStatus('connected');
      setErrorMsg(null);

      // Run detection in parallel with next frame fetch
      const found = await runDetection(dataUri, backend);
      setDetections(found);

      setFrameCount(c => c + 1);
      fpsFrames.current += 1;
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e?.message ?? 'Connection failed');
      setDetections([]);
    }

    // ~3 FPS like the CLI (333ms loop from Detector.java)
    if (runningRef.current) {
      timerRef.current = setTimeout(() => pollLoop(ip, backend), 333);
    }
  }, [fetchFrame, runDetection]);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsRunning(true);
    setFrameCount(0);
    setFps(0);

    // FPS counter — reset every second
    fpsFrames.current = 0;
    fpsTimer.current = setInterval(() => {
      setFps(fpsFrames.current);
      fpsFrames.current = 0;
    }, 1000);

    pollLoop(espIp, backendUrl);
  }, [espIp, backendUrl, pollLoop]);

  const stop = useCallback(() => {
    runningRef.current = false;
    setIsRunning(false);
    setStatus('disconnected');
    if (timerRef.current) clearTimeout(timerRef.current);
    if (fpsTimer.current) clearInterval(fpsTimer.current);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    runningRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (fpsTimer.current) clearInterval(fpsTimer.current);
  }, []);

  return {
    frameUri,
    detections,
    status,
    errorMsg,
    fps,
    frameCount,
    espIp,
    backendUrl,
    setEspIp,
    setBackendUrl,
    start,
    stop,
    isRunning,
  };
}
