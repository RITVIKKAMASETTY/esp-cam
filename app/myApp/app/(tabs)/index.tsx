/**
 * Home — BlindSist live detection screen
 *
 * Mobile equivalent of EspDetector.java:
 *  • Connects to ESP32-CAM Access Point (192.168.4.1)
 *  • Polls /capture for JPEG frames at ~3 FPS (333 ms, like Detector.java)
 *  • Sends frames to Python backend (detect_server.py) for MobileNet SSD inference
 *  • Overlays bounding boxes + class labels on the live feed
 *  • Shows the same [DETECTED] log the CLI prints
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';

import DetectionView from '@/components/detection-view';
import DetectionStats from '@/components/detection-stats';
import { useEspDetection } from '@/hooks/use-esp-detection';

export default function HomeScreen() {
  const esp = useEspDetection();

  const toggleDetection = useCallback(() => {
    if (esp.isRunning) {
      esp.stop();
    } else {
      esp.start();
    }
  }, [esp]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ── Header ──────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>BLINDSIST</Text>
          <Text style={styles.appSubtitle}>ESP32-CAM Object Detection</Text>
        </View>

        <TouchableOpacity
          onPress={toggleDetection}
          style={[
            styles.startBtn,
            esp.isRunning ? styles.stopBtn : styles.goBtn,
          ]}
          accessibilityLabel={esp.isRunning ? 'Stop detection' : 'Start detection'}
        >
          <Text style={styles.startBtnText}>
            {esp.isRunning ? '⏹  STOP' : '▶  START'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Live camera + detection boxes ───────────────────── */}
      <View style={styles.cameraArea}>
        <DetectionView
          frameUri={esp.frameUri}
          detections={esp.detections}
          isConnecting={esp.status === 'connecting'}
        />

        {/* Corner HUD overlay */}
        <View style={styles.hudTopLeft} pointerEvents="none">
          <Text style={styles.hudText}>REC</Text>
          <View style={styles.recDot} />
        </View>
        <View style={styles.hudBottomRight} pointerEvents="none">
          <Text style={styles.hudText}>ESP32-CAM  {esp.espIp}</Text>
        </View>
      </View>

      {/* ── Stats / detection log (mirrors CLI output) ──────── */}
      <DetectionStats
        status={esp.status}
        fps={esp.fps}
        frameCount={esp.frameCount}
        detections={esp.detections}
        errorMsg={esp.errorMsg}
        espIp={esp.espIp}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0A0A0F',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 3,
    fontFamily: 'monospace',
  },
  appSubtitle: {
    fontSize: 10,
    color: '#00D4FF',
    letterSpacing: 1.5,
    fontFamily: 'monospace',
    marginTop: 2,
  },

  /* Start / Stop button */
  startBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  goBtn: {
    borderColor: '#00D4FF',
    backgroundColor: 'rgba(0,212,255,0.12)',
  },
  stopBtn: {
    borderColor: '#FF4757',
    backgroundColor: 'rgba(255,71,87,0.12)',
  },
  startBtnText: {
    color: '#FFFFFF',
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 1,
  },

  /* Camera area */
  cameraArea: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },

  /* HUD corners */
  hudTopLeft: {
    position: 'absolute',
    top: 10,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF4757',
  },
  hudBottomRight: {
    position: 'absolute',
    bottom: 10,
    right: 12,
  },
  hudText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
});
