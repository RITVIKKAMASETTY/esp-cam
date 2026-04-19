/**
 * DetectionStats — mirrors the Detector.java terminal output in card form:
 *  >>> Frame 42 - 2 object(s):
 *    [DETECTED] PERSON          @ [120, 80]  (conf: 0.87)
 *    [DETECTED] CHAIR           @ [250, 110] (conf: 0.71)
 *
 * + shows FPS, connection status, and frame counter.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ConnectionStatus, Detection } from '@/hooks/use-esp-detection';

interface DetectionStatsProps {
  status: ConnectionStatus;
  fps: number;
  frameCount: number;
  detections: Detection[];
  errorMsg: string | null;
  espIp: string;
}

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string; dot: string }> = {
  disconnected: { label: 'DISCONNECTED', color: '#555', dot: '⚫' },
  connecting:   { label: 'CONNECTING…',  color: '#FFA502', dot: '🟡' },
  connected:    { label: 'CONNECTED',    color: '#2ECC71', dot: '🟢' },
  error:        { label: 'ERROR',        color: '#FF4757', dot: '🔴' },
};

export default function DetectionStats({
  status,
  fps,
  frameCount,
  detections,
  errorMsg,
  espIp,
}: DetectionStatsProps) {
  const sc = STATUS_CONFIG[status];

  return (
    <View style={styles.container}>
      {/* Top status bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <Text style={[styles.statusLabel, { color: sc.color }]}>
            {sc.dot} {sc.label}
          </Text>
          <Text style={styles.ipText}>{espIp}</Text>
        </View>
        <View style={styles.statusRight}>
          <Text style={styles.metric}>
            <Text style={styles.metricValue}>{fps}</Text>
            <Text style={styles.metricUnit}> FPS</Text>
          </Text>
          <Text style={styles.metric}>
            <Text style={styles.metricValue}>{frameCount}</Text>
            <Text style={styles.metricUnit}> frames</Text>
          </Text>
        </View>
      </View>

      {/* Error message */}
      {errorMsg ? (
        <Text style={styles.errorText}>⚠ {errorMsg}</Text>
      ) : null}

      {/* Detection list — mirrors CLI output */}
      <View style={styles.detectionsHeader}>
        <Text style={styles.detectionsHeaderText}>
          {`>>> Frame ${frameCount} — ${detections.length} object(s)`}
        </Text>
      </View>

      <ScrollView style={styles.detectionList} nestedScrollEnabled>
        {detections.length === 0 ? (
          <Text style={styles.noDetection}>
            {status === 'connected'
              ? '[NO DETECTION] — point camera at an object'
              : '—'}
          </Text>
        ) : (
          detections.map((d, i) => (
            <Text key={i} style={styles.detectionRow}>
              {'  [DETECTED] '}
              <Text style={styles.className}>{d.className.toUpperCase().padEnd(15)}</Text>
              {' @ ['}
              <Text style={styles.coord}>{d.x},{d.y}</Text>
              {']  (conf: '}
              <Text style={styles.conf}>{d.confidence.toFixed(2)}</Text>
              {')'}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0A0A0F',
    borderTopWidth: 1,
    borderTopColor: '#1A1A2E',
    maxHeight: 220,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  statusLeft: {
    gap: 2,
  },
  statusLabel: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
  },
  ipText: {
    fontSize: 10,
    color: '#444',
    fontFamily: 'monospace',
  },
  statusRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  metric: {
    fontFamily: 'monospace',
  },
  metricValue: {
    fontSize: 14,
    color: '#00D4FF',
    fontWeight: '700',
  },
  metricUnit: {
    fontSize: 10,
    color: '#555',
  },
  errorText: {
    color: '#FF4757',
    fontSize: 11,
    fontFamily: 'monospace',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  detectionsHeader: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 2,
  },
  detectionsHeaderText: {
    color: '#00D4FF',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  detectionList: {
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  noDetection: {
    color: '#444',
    fontFamily: 'monospace',
    fontSize: 11,
    paddingVertical: 4,
  },
  detectionRow: {
    color: '#AAAAAA',
    fontFamily: 'monospace',
    fontSize: 11,
    paddingVertical: 1,
  },
  className: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  coord: {
    color: '#FFA502',
  },
  conf: {
    color: '#2ECC71',
  },
});
