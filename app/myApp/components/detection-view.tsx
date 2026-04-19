/**
 * DetectionView — renders the live ESP32 frame with detection boxes overlaid.
 *
 * Mirrors the Detector.java terminal output:
 *   [DETECTED] PERSON @ [x, y]  (conf: 0.87)
 * but as a visual overlay on the camera feed.
 */

import React, { useMemo } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Text,
  ActivityIndicator,
  LayoutChangeEvent,
} from 'react-native';
import { Detection } from '@/hooks/use-esp-detection';

interface DetectionViewProps {
  frameUri: string | null;
  detections: Detection[];
  /** Width of the frame returned by the backend */
  frameWidth?: number;
  /** Height of the frame returned by the backend */
  frameHeight?: number;
  isConnecting: boolean;
}

// Color palette for class labels
const CLASS_COLORS: Record<string, string> = {
  person:       '#FF4757',
  car:          '#2ED573',
  bicycle:      '#1E90FF',
  motorcycle:   '#FFA502',
  bus:          '#A29BFE',
  truck:        '#FD79A8',
  dog:          '#FDCB6E',
  cat:          '#00CEC9',
  bird:         '#6C5CE7',
  chair:        '#74B9FF',
  bottle:       '#55EFC4',
  laptop:       '#E17055',
  'cell phone': '#D63031',
  tv:           '#0984E3',
};

function getColor(className: string) {
  return CLASS_COLORS[className.toLowerCase()] ?? '#FFFFFF';
}

export default function DetectionView({
  frameUri,
  detections,
  frameWidth = 352,
  frameHeight = 288,
  isConnecting,
}: DetectionViewProps) {
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });

  const handleLayout = (e: LayoutChangeEvent) => {
    setContainerSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
  };

  // Scale bounding boxes to the actual rendered size (aspect-fit)
  const scale = useMemo(() => {
    if (!containerSize.width || !containerSize.height || !frameWidth || !frameHeight) {
      return { sx: 1, sy: 1, offsetX: 0, offsetY: 0 };
    }
    const containerAspect = containerSize.width / containerSize.height;
    const frameAspect = frameWidth / frameHeight;
    let sx: number, sy: number, offsetX = 0, offsetY = 0;

    if (containerAspect > frameAspect) {
      // Container is wider — letterbox on sides
      sy = containerSize.height / frameHeight;
      sx = sy;
      offsetX = (containerSize.width - frameWidth * sx) / 2;
    } else {
      // Container is taller — letterbox on top/bottom
      sx = containerSize.width / frameWidth;
      sy = sx;
      offsetY = (containerSize.height - frameHeight * sy) / 2;
    }
    return { sx, sy, offsetX, offsetY };
  }, [containerSize, frameWidth, frameHeight]);

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {/* Camera frame */}
      {frameUri ? (
        <Image source={{ uri: frameUri }} style={styles.frame} resizeMode="contain" />
      ) : (
        <View style={styles.placeholder}>
          {isConnecting ? (
            <ActivityIndicator color="#00D4FF" size="large" />
          ) : (
            <Text style={styles.placeholderText}>📡 No signal</Text>
          )}
        </View>
      )}

      {/* Bounding box overlays */}
      {detections.map((det, i) => {
        const { sx, sy, offsetX, offsetY } = scale;
        const color = getColor(det.className);
        const left  = det.x * sx + offsetX;
        const top   = det.y * sy + offsetY;
        const bw    = det.width * sx;
        const bh    = det.height * sy;

        return (
          <View key={i} style={[styles.box, { left, top, width: bw, height: bh, borderColor: color }]}>
            <View style={[styles.labelBg, { backgroundColor: color }]}>
              <Text style={styles.labelText}>
                {det.className.toUpperCase()}{'  '}{Math.round(det.confidence * 100)}%
              </Text>
            </View>
          </View>
        );
      })}

      {/* Scan line animation overlay */}
      {isConnecting && (
        <View style={styles.scanOverlay} pointerEvents="none">
          <Text style={styles.scanText}>CONNECTING…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  frame: {
    flex: 1,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0F',
  },
  placeholderText: {
    color: '#555',
    fontSize: 18,
    fontFamily: 'monospace',
    marginTop: 12,
  },
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 2,
  },
  labelBg: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    alignSelf: 'flex-start',
    marginTop: -24,
  },
  labelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: 'monospace',
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanText: {
    color: '#00D4FF',
    fontFamily: 'monospace',
    fontSize: 12,
    letterSpacing: 2,
    opacity: 0.7,
  },
});
