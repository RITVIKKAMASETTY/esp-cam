/**
 * Settings — Configure ESP32-CAM IP and detection backend URL.
 *
 * Mirrors the hardcoded constants in Detector.java:
 *   private static final String ESP32_IP = "192.168.4.1";
 *   private static final String CAPTURE_URL = "http://" + ESP32_IP + "/capture";
 *   private static final double CONFIDENCE_THRESHOLD = 0.50;
 *
 * These are now user-configurable and persisted via AsyncStorage.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';

import { useEspDetection, CLASSES } from '@/hooks/use-esp-detection';

export default function SettingsScreen() {
  const esp = useEspDetection();

  const [ipDraft, setIpDraft]           = useState(esp.espIp);
  const [backendDraft, setBackendDraft] = useState(esp.backendUrl);

  const handleSave = () => {
    esp.setEspIp(ipDraft.trim());
    esp.setBackendUrl(backendDraft.trim());
    Alert.alert('Saved', 'Settings saved. Restart detection on the Home tab.');
  };

  const handleTestEsp = async () => {
    try {
      const url = `http://${ipDraft.trim()}/capture`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        Alert.alert('✅ ESP32 Reachable', `Connected to ${url}`);
      } else {
        Alert.alert('⚠️ Bad Response', `HTTP ${resp.status} from ${url}`);
      }
    } catch (e: any) {
      Alert.alert('❌ Connection Failed', e?.message ?? 'Cannot reach ESP32.\nMake sure you are on the ESP32-CAM-AP WiFi network.');
    }
  };

  const handleTestBackend = async () => {
    try {
      const url = `${backendDraft.trim()}/health`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const json = await resp.json();
      Alert.alert(
        '✅ Backend Reachable',
        `Status: ${json.status}\nModel loaded: ${json.modelLoaded ? 'Yes ✅' : 'No — demo mode ⚠️'}`,
      );
    } catch (e: any) {
      Alert.alert('❌ Backend Unreachable', e?.message ?? 'Start detect_server.py first.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>SETTINGS</Text>
        <Text style={styles.subtitle}>BLINDSIST CONFIGURATION</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* ── ESP32-CAM ──────────────────────────────────── */}
        <SectionHeader title="ESP32-CAM" icon="📡" />

        <InfoRow label="Default IP" value="192.168.4.1" />
        <InfoRow label="SSID" value="ESP32-CAM-AP" />
        <InfoRow label="Password" value="12345678" />
        <InfoRow label="Endpoints" value="/capture  /stream  /" />

        <View style={styles.field}>
          <Text style={styles.label}>ESP32 IP Address</Text>
          <TextInput
            style={styles.input}
            value={ipDraft}
            onChangeText={setIpDraft}
            placeholder="192.168.4.1"
            placeholderTextColor="#444"
            autoCapitalize="none"
            keyboardType="numeric"
            accessibilityLabel="ESP32 IP address input"
          />
        </View>

        <TouchableOpacity style={styles.testBtn} onPress={handleTestEsp}>
          <Text style={styles.testBtnText}>TEST CONNECTION</Text>
        </TouchableOpacity>

        {/* ── Detection Backend ───────────────────────────── */}
        <SectionHeader title="Detection Backend" icon="🧠" />

        <View style={styles.infoCard}>
          <Text style={styles.infoCardText}>
            {'Run detect_server.py on the same WiFi network.\n\n'}
            {'  pip install fastapi uvicorn opencv-python-headless\n'}
            {'  python detect_server.py\n\n'}
            {'Set the URL below to http://<your-pc-ip>:5000\n'}
            {'(leave the backend URL empty to run in frame-only mode)'}
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Backend URL</Text>
          <TextInput
            style={styles.input}
            value={backendDraft}
            onChangeText={setBackendDraft}
            placeholder="http://192.168.4.2:5000"
            placeholderTextColor="#444"
            autoCapitalize="none"
            keyboardType="url"
            accessibilityLabel="Backend URL input"
          />
        </View>

        <TouchableOpacity style={styles.testBtn} onPress={handleTestBackend}>
          <Text style={styles.testBtnText}>TEST BACKEND</Text>
        </TouchableOpacity>

        {/* ── Model Info ──────────────────────────────────── */}
        <SectionHeader title="Model Info" icon="📦" />
        <InfoRow label="Architecture" value="MobileNet SSD (Caffe)" />
        <InfoRow label="Input size"   value="300 × 300" />
        <InfoRow label="Scale"        value="0.007843" />
        <InfoRow label="Mean"         value="127.5, 127.5, 127.5" />
        <InfoRow label="Threshold"    value="50% confidence" />
        <InfoRow label="Classes"      value={`${CLASSES.filter(c => c !== '???').length} objects`} />

        {/* Save */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>SAVE SETTINGS</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIcon}>{icon}</Text>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0A0A0F',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 3,
    fontFamily: 'monospace',
  },
  subtitle: {
    fontSize: 10,
    color: '#00D4FF',
    letterSpacing: 1.5,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  scroll: { flex: 1 },
  content: { padding: 16 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A2E',
    paddingBottom: 6,
  },
  sectionIcon: { fontSize: 16 },
  sectionTitle: {
    fontSize: 12,
    color: '#00D4FF',
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 2,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 2,
  },
  infoLabel: {
    color: '#666',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  infoValue: {
    color: '#AAAAAA',
    fontFamily: 'monospace',
    fontSize: 11,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 8,
  },

  infoCard: {
    backgroundColor: '#0D0D1A',
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1A1A2E',
    marginVertical: 8,
  },
  infoCardText: {
    color: '#777',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 18,
  },

  field: { marginVertical: 8 },
  label: {
    color: '#888',
    fontSize: 11,
    fontFamily: 'monospace',
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0D0D1A',
    borderWidth: 1,
    borderColor: '#1A1A2E',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontFamily: 'monospace',
    fontSize: 14,
  },

  testBtn: {
    borderWidth: 1,
    borderColor: '#00D4FF',
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: 'rgba(0,212,255,0.06)',
  },
  testBtnText: {
    color: '#00D4FF',
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.5,
  },

  saveBtn: {
    backgroundColor: '#00D4FF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  saveBtnText: {
    color: '#000',
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 2,
  },
});
