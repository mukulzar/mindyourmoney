import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Polygon,
  Line,
  Rect,
  Circle,
  Path,
} from 'react-native-svg';

type Screen = 'home' | 'voice' | 'review' | 'camera';

interface Props {
  onNavigate: (s: Screen) => void;
  onCapture: (imageUri: string) => void | Promise<void>;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CUTOUT_WIDTH = 252;
const CUTOUT_HEIGHT = 164;

// --- Icons ---

function FlashIcon({ active }: { active: boolean }) {
  return (
    <Svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={active ? '#FACC15' : 'none'}
      stroke={active ? '#FACC15' : '#FFFFFF'}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </Svg>
  );
}

function CloseIcon() {
  return (
    <Svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}

function GalleryIcon() {
  return (
    <Svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeOpacity={0.5}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Rect x="3" y="3" width="18" height="18" rx="2" />
      <Circle cx="8.5" cy="8.5" r="1.5" />
      <Polygon points="21 15 16 10 5 21" />
    </Svg>
  );
}

function SettingsIcon() {
  return (
    <Svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeOpacity={0.5}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Circle cx="12" cy="12" r="3" />
      <Path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </Svg>
  );
}

// --- Main Component ---

export default function CameraScreen({
  onNavigate = () => undefined,
  onCapture = () => undefined,
}: Props) {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState(false);
  const [mode, setMode] = useState<'scan' | 'voice'>('scan');
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: CUTOUT_HEIGHT - 4,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanAnim]);

  const handleClose = () => {
    if (onNavigate) {
      onNavigate('home');
      return;
    }
    router.replace('/(tabs)');
  };

  const handleCapture = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (picture?.uri) await onCapture(picture.uri);
    } finally {
      setCapturing(false);
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Loading camera...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Camera access is needed</Text>
          <Text style={styles.permissionText}>
            We use your camera to scan receipts and log expenses.
          </Text>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Allow Camera</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Viewfinder overlay side dimensions calculation
  const maskVertical = (SCREEN_HEIGHT - CUTOUT_HEIGHT) / 2;
  const maskHorizontal = (SCREEN_WIDTH - CUTOUT_WIDTH) / 2;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={flash}
      />

      {/* Dark Overlay Mask with Cutout */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Top Dark Block */}
        <View style={[styles.maskBlock, { height: maskVertical }]} />
        {/* Middle Row */}
        <View style={styles.maskMiddleRow}>
          <View style={[styles.maskBlock, { width: maskHorizontal }]} />
          {/* Cutout Window */}
          <View style={styles.cutoutWindow}>
            {/* Corner Brackets */}
            <View style={[styles.cornerBracket, styles.topLeftBracket]} />
            <View style={[styles.cornerBracket, styles.topRightBracket]} />
            <View style={[styles.cornerBracket, styles.bottomLeftBracket]} />
            <View style={[styles.cornerBracket, styles.bottomRightBracket]} />

            {/* Animated Scan Line */}
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [{ translateY: scanAnim }],
                },
              ]}
            />
          </View>
          <View style={[styles.maskBlock, { width: maskHorizontal }]} />
        </View>
        {/* Bottom Dark Block */}
        <View style={[styles.maskBlock, { height: maskVertical }]} />
      </View>

      <SafeAreaView style={styles.contentContainer}>
        {/* Top Toolbar */}
        <View style={styles.topToolbar}>
          <Pressable
            style={[
              styles.iconBtn,
              flash ? styles.flashBtnActive : styles.iconBtnDefault,
            ]}
            onPress={() => setFlash((f) => !f)}
          >
            <FlashIcon active={flash} />
          </Pressable>

          <View style={styles.headerTextGroup}>
            <Text style={styles.headerTitle}>Scan Receipt</Text>
            <Text style={styles.headerSubtitle}>Align within the frame</Text>
          </View>

          <Pressable
            style={[styles.iconBtn, styles.iconBtnDefault]}
            onPress={handleClose}
          >
            <CloseIcon />
          </Pressable>
        </View>

        {/* Gallery Link Button */}
        <View style={styles.galleryBtnWrapper}>
          <Pressable style={styles.galleryUploadBtn}>
            <Text style={styles.galleryUploadText}>Upload from Gallery</Text>
          </Pressable>
        </View>

        {/* Frame Hint */}
        <View style={styles.hintWrapper}>
          <Text style={styles.hintText}>Keep flat & well-lit</Text>
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          {/* Mode Selector */}
          <View style={styles.modeSelectorWrapper}>
            <View style={styles.modeSelector}>
              <Pressable
                style={[
                  styles.modeBtn,
                  mode === 'scan' ? styles.modeBtnActive : null,
                ]}
                onPress={() => setMode('scan')}
              >
                <Text
                  style={[
                    styles.modeText,
                    mode === 'scan' ? styles.modeTextActive : styles.modeTextInactive,
                  ]}
                >
                  Camera
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modeBtn,
                  mode === 'voice' ? styles.modeBtnActive : null,
                ]}
                onPress={() => {
                  setMode('voice');
                  onNavigate('voice');
                }}
              >
                <Text
                  style={[
                    styles.modeText,
                    mode === 'voice' ? styles.modeTextActive : styles.modeTextInactive,
                  ]}
                >
                  Voice
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Shutter Row */}
          <View style={styles.shutterRow}>
            {/* Gallery Shortcut */}
            <Pressable
              style={styles.shutterSideBtn}
              onPress={() => onNavigate('review')}
            >
              <GalleryIcon />
              <Text style={styles.shutterSideText}>Gallery</Text>
            </Pressable>

            {/* Shutter Button */}
            <Pressable style={styles.shutterOuter} onPress={handleCapture} disabled={capturing}>
              <View style={styles.shutterInner} />
            </Pressable>

            {/* Settings Shortcut */}
            <Pressable style={styles.shutterSideBtn}>
              <SettingsIcon />
              <Text style={styles.shutterSideText}>Settings</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  permissionCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  permissionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  simulatedBg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0D1117',
  },
  maskBlock: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    flex: 1,
  },
  maskMiddleRow: {
    height: CUTOUT_HEIGHT,
    flexDirection: 'row',
  },
  cutoutWindow: {
    width: CUTOUT_WIDTH,
    height: CUTOUT_HEIGHT,
    borderRadius: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  cornerBracket: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#059669',
  },
  topLeftBracket: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 6,
  },
  topRightBracket: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 6,
  },
  bottomLeftBracket: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 6,
  },
  bottomRightBracket: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 6,
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#059669',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 20,
  },
  topToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconBtnDefault: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  flashBtnActive: {
    backgroundColor: 'rgba(250, 204, 21, 0.2)',
    borderColor: 'rgba(250, 204, 21, 0.6)',
  },
  headerTextGroup: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  galleryBtnWrapper: {
    alignItems: 'center',
  },
  galleryUploadBtn: {
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
  },
  galleryUploadText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '600',
  },
  hintWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '56%',
    alignItems: 'center',
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  bottomControls: {
    paddingBottom: 24,
  },
  modeSelectorWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  modeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modeBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  modeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  modeTextActive: {
    color: '#1E293B',
  },
  modeTextInactive: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 48,
  },
  shutterSideBtn: {
    alignItems: 'center',
    gap: 6,
  },
  shutterSideText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
  },
  shutterOuter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },
});