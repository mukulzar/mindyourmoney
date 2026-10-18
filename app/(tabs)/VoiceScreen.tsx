import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  Animated,
  Easing,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Line } from 'react-native-svg';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import { parseVoiceRecording } from '../../services/ai';

type Screen = 'home' | 'voice' | 'review' | 'camera';
type ParsedReceipt = {
  vendor?: string;
  amount?: string;
  date?: string;
  tags?: string[];
};

interface Props {
  onNavigate: (s: Screen) => void;
  onParsed: (data: Partial<ParsedReceipt>) => void;
}

type RecordState = 'idle' | 'recording' | 'processing' | 'done';

// --- Icons ---

function CloseIcon() {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}

function SmallCloseIcon() {
  return (
    <Svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </Svg>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <Svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={active ? '#FFFFFF' : '#059669'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <Line x1="12" y1="19" x2="12" y2="23" />
      <Line x1="8" y1="23" x2="16" y2="23" />
    </Svg>
  );
}

function SpinnerIcon() {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate: spin }] }}>
      <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </Svg>
    </Animated.View>
  );
}

// --- Main Component ---

export default function VoiceScreen({
  onNavigate = () => undefined,
  onParsed = () => undefined,
}: Props) {
  const [state, setState] = useState<RecordState>('idle');
  const [transcript, setTranscript] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [parsedReceipt, setParsedReceipt] = useState<ParsedReceipt>({});

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const fontMono = Platform.OS === 'ios' ? 'Courier' : 'monospace';

  // Bottom sheet animation value
  const sheetAnim = useRef(new Animated.Value(300)).current;

  // Pulse ring animation values
  const pulse1 = useRef(new Animated.Value(0)).current;
  const pulse2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (sheetOpen) {
      Animated.timing(sheetAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(sheetAnim, {
        toValue: 300,
        duration: 300,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [sheetOpen, sheetAnim]);

  // Pulse rings effect during recording
  useEffect(() => {
    if (state === 'recording') {
      const createPulse = (anim: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
              Animated.timing(anim, {
                toValue: 1,
                duration: 1500,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
              }),
            ]),
            Animated.timing(anim, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        );
      };

      const loop1 = createPulse(pulse1, 0);
      const loop2 = createPulse(pulse2, 750);

      loop1.start();
      loop2.start();

      return () => {
        loop1.stop();
        loop2.stop();
        pulse1.setValue(0);
        pulse2.setValue(0);
      };
    }
  }, [state, pulse1, pulse2]);

  // Elapsed timer
  useEffect(() => {
    if (state === 'recording') {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  async function startRecording() {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setTranscript('Microphone permission is required.');
      return;
    }

    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
    setTranscript('Listening...');
    setState('recording');
  }

  async function stopRecording() {
    setState('processing');
    await audioRecorder.stop();
    const uri = audioRecorder.uri;
    if (!uri) {
      setState('idle');
      return;
    }

    try {
      const parsed = await parseVoiceRecording(uri);
      setParsedReceipt(parsed);
      setTranscript(`${parsed.vendor || 'Transaction'} · ${parsed.amount || 'Amount not found'}`);
      setState('done');
      setSheetOpen(true);
    } catch (error) {
      setTranscript('Could not understand that recording. Please try again.');
      setState('idle');
      Alert.alert(
        'Voice logging failed',
        error instanceof Error ? error.message : 'The recording could not be processed.'
      );
    }
  }

  function handleConfirm() {
    onParsed({
      ...parsedReceipt,
    });
    onNavigate('review');
  }

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.closeBtn}
          onPress={() => onNavigate('home')}
        >
          <CloseIcon />
        </Pressable>
        <Text style={styles.headerTitle}>Voice Logging</Text>
        <View style={styles.placeholderBox} />
      </View>

      {/* Transcript Display */}
      <View style={styles.transcriptContainer}>
        {state === 'idle' && (
          <Text style={styles.idleText}>Tap the mic to start</Text>
        )}
        {(state === 'recording' || state === 'done') && !!transcript && (
          <Text style={styles.transcriptText}>
            "{transcript.replace('450 rupees', '').replace("Domino's...", '').trim()}
            {transcript.includes('450 rupees') && (
              <Text style={styles.greenText}> ₹450</Text>
            )}
            {transcript.includes("Domino's") && (
              <Text style={styles.greenText}> Domino's</Text>
            )}
            {transcript.includes("Domino's") && '...'} "
          </Text>
        )}
        {state === 'processing' && (
          <Text style={styles.processingText}>Processing...</Text>
        )}
      </View>

      {/* Visualizer + Mic */}
      <View style={styles.centerSection}>
        {/* Wave Bars */}
        <View style={styles.waveContainer}>
          {Array.from({ length: 10 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.waveBar,
                { opacity: state === 'recording' ? 1 : 0.2 },
              ]}
            />
          ))}
        </View>

        {/* Mic Button & Pulse Rings */}
        <View style={styles.micWrapper}>
          {state === 'recording' && (
            <>
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    width: 128,
                    height: 128,
                    borderRadius: 64,
                    borderColor: 'rgba(5,150,105,0.15)',
                    transform: [
                      {
                        scale: pulse1.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1.3],
                        }),
                      },
                    ],
                    opacity: pulse1.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0],
                    }),
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.pulseRing,
                  {
                    width: 96,
                    height: 96,
                    borderRadius: 48,
                    borderColor: 'rgba(5,150,105,0.25)',
                    transform: [
                      {
                        scale: pulse2.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1.3],
                        }),
                      },
                    ],
                    opacity: pulse2.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0],
                    }),
                  },
                ]}
              />
            </>
          )}

          <Pressable
            style={[
              styles.micButton,
              state === 'recording'
                ? styles.micRecording
                : styles.micIdle,
            ]}
            onPress={
              state === 'idle'
                ? startRecording
                : state === 'recording'
                ? stopRecording
                : undefined
            }
          >
            {state === 'processing' ? (
              <SpinnerIcon />
            ) : (
              <MicIcon active={state === 'recording'} />
            )}
          </Pressable>
        </View>

        {/* Timer / Hint */}
        {state === 'recording' && (
          <View style={styles.timerRow}>
            <View style={styles.redDot} />
            <Text style={[styles.timerText, { fontFamily: fontMono }]}>
              {fmt(elapsed)}
            </Text>
          </View>
        )}
        {state === 'idle' && (
          <Text style={styles.holdText}>HOLD TO SPEAK</Text>
        )}
      </View>

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            transform: [{ translateY: sheetAnim }],
          },
        ]}
      >
        <View style={styles.sheetCard}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Parsed Preview</Text>
            <Pressable
              style={styles.sheetCloseBtn}
              onPress={() => setSheetOpen(false)}
            >
              <SmallCloseIcon />
            </Pressable>
          </View>

          <View style={styles.sheetBody}>
            {[
              ['Vendor', parsedReceipt.vendor || 'Not found'],
              ['Category', parsedReceipt.tags?.[0] || 'Uncategorized'],
              ['Date', parsedReceipt.date || 'Today'],
            ].map(([k, v]) => (
              <View key={k} style={styles.sheetRow}>
                <Text style={styles.sheetLabel}>{k}</Text>
                <Text style={styles.sheetValue}>{v}</Text>
              </View>
            ))}

            <View style={styles.sheetTotalRow}>
              <Text style={styles.sheetTotalLabel}>Total</Text>
              <Text style={[styles.sheetTotalValue, { fontFamily: fontMono }]}>
                ₹{parsedReceipt.amount || '0.00'}
              </Text>
            </View>
          </View>

          <View style={styles.sheetActions}>
            <Pressable
              style={styles.redoBtn}
              onPress={() => {
                setState('idle');
                setSheetOpen(false);
                setTranscript('');
              }}
            >
              <Text style={styles.redoBtnText}>Redo</Text>
            </Pressable>

            <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>Confirm & Review</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  placeholderBox: {
    width: 36,
  },
  transcriptContainer: {
    paddingHorizontal: 32,
    paddingTop: 32,
    alignItems: 'center',
    minHeight: 72,
  },
  idleText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 14,
    fontWeight: '500',
  },
  transcriptText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  greenText: {
    color: '#059669',
  },
  processingText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 48,
  },
  waveBar: {
    width: 4,
    height: 32,
    backgroundColor: '#059669',
    borderRadius: 2,
  },
  micWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 1,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micRecording: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  micIdle: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  timerText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  holdText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
  },
  sheetCard: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sheetCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  sheetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },
  sheetValue: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  sheetTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  sheetTotalLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  sheetTotalValue: {
    color: '#059669',
    fontSize: 16,
    fontWeight: '700',
  },
  sheetActions: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    gap: 12,
  },
  redoBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  redoBtnText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});