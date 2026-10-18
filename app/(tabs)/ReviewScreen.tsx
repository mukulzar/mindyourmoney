import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  StatusBar,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polyline, Rect, Line } from 'react-native-svg';
import { ALL_TAGS } from '../../data';
import type { Screen, ParsedReceipt } from '../../types';

interface Props {
  onNavigate: (s: Screen) => void;
  onConfirm: (data: ParsedReceipt) => void;
  prefill?: Partial<ParsedReceipt>;
  budgetTags?: string[];
}

// --- Icons ---

function ChevronLeftIcon() {
  return (
    <Svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Polyline points="15 18 9 12 15 6" />
    </Svg>
  );
}

function CalendarIcon() {
  return (
    <Svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#94A3B8"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Rect x="3" y="4" width="18" height="18" rx="2" />
      <Line x1="16" y1="2" x2="16" y2="6" />
      <Line x1="8" y1="2" x2="8" y2="6" />
      <Line x1="3" y1="10" x2="21" y2="10" />
    </Svg>
  );
}

// Skeleton component with pulsing animation
function Skeleton({ width, height }: { width: number | string; height: number }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as any, height, opacity },
      ]}
    />
  );
}

// --- Main Component ---

export default function ReviewScreen({ onNavigate, onConfirm, prefill, budgetTags = [] }: Props) {
  const [form, setForm] = useState<ParsedReceipt>({
    vendor: prefill?.vendor ?? "Domino's Pizza",
    date: prefill?.date ?? '2026-09-19',
    amount: prefill?.amount ?? '450.00',
    tags: prefill?.tags ?? ['Food & Dining', 'Deductible'],
    note: prefill?.note ?? '',
    type: prefill?.type ?? 'expense',
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ParsedReceipt, string>>>({});
  const availableTags = [...new Set([...ALL_TAGS, ...budgetTags])];

  const fontMono = Platform.OS === 'ios' ? 'Courier' : 'monospace';

  function set<K extends keyof ParsedReceipt>(k: K, v: ParsedReceipt[K]) {
    setForm((formState: ParsedReceipt) => ({ ...formState, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  }

  function toggleTag(tag: string) {
    set(
      'tags',
      form.tags.includes(tag)
        ? form.tags.filter((tagName: string) => tagName !== tag)
        : [...form.tags, tag]
    );
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.vendor.trim()) e.vendor = 'Required';
    if (!form.amount || isNaN(Number(form.amount))) e.amount = 'Invalid amount';
    if (!form.date) e.date = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleConfirm() {
    if (!validate()) return;
    setLoading(true);

    // Simulated API call delay
    await new Promise((r) => setTimeout(r, 900));

    setLoading(false);
    onConfirm(form);
    onNavigate('home');
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1E293B" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Receipt Preview Area */}
        <View style={styles.previewContainer}>
          {/* Skeleton Receipt */}
          <View style={styles.receiptCard}>
            <Skeleton width={112} height={12} />
            <View style={styles.gap4} />
            <Skeleton width={80} height={8} />
            <View style={styles.gap8} />
            <Skeleton width={144} height={8} />

            <View style={styles.rowBetweenMargin}>
              <Skeleton width={96} height={8} />
              <Skeleton width={48} height={8} />
            </View>

            <View style={styles.rowBetweenMargin}>
              <Skeleton width={80} height={8} />
              <Skeleton width={40} height={8} />
            </View>

            <View style={styles.receiptDivider}>
              <Skeleton width={40} height={12} />
              <Skeleton width={64} height={12} />
            </View>
          </View>

          {/* Back Button */}
          <Pressable
            style={styles.backButton}
            onPress={() => onNavigate('camera')}
          >
            <ChevronLeftIcon />
          </Pressable>
        </View>

        {/* Slide-Up Form Panel */}
        <View style={styles.formPanel}>
          <View style={styles.handleBar} />

          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Confirm Details</Text>
            <Text style={styles.panelSubtitle}>
              Review extracted data before logging
            </Text>
          </View>

          <ScrollView
            style={styles.flex1}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TRANSACTION TYPE</Text>
              <View style={styles.typeSelector}>
                <Pressable
                  style={[styles.typeButton, form.type === 'expense' && styles.expenseButtonActive]}
                  onPress={() => set('type', 'expense')}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      form.type === 'expense' ? styles.typeButtonTextActive : null,
                    ]}
                  >
                    Expense
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.typeButton, form.type === 'income' && styles.incomeButtonActive]}
                  onPress={() => set('type', 'income')}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      form.type === 'income' ? styles.typeButtonTextActive : null,
                    ]}
                  >
                    Income
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Vendor Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>VENDOR NAME</Text>
              <TextInput
                style={[
                  styles.textInput,
                  errors.vendor ? styles.inputErrorBorder : styles.inputNormalBorder,
                ]}
                value={form.vendor}
                onChangeText={(text) => set('vendor', text)}
                placeholder="Vendor name"
                placeholderTextColor="#94A3B8"
              />
              {errors.vendor && (
                <Text style={styles.errorText}>{errors.vendor}</Text>
              )}
            </View>

            {/* Date + Amount Row */}
            <View style={styles.rowGroup}>
              {/* Date Input */}
              <View style={styles.flex1}>
                <Text style={styles.inputLabel}>DATE</Text>
                <View
                  style={[
                    styles.textInputRow,
                    errors.date ? styles.inputErrorBorder : styles.inputNormalBorder,
                  ]}
                >
                  <CalendarIcon />
                  <TextInput
                    style={styles.inlineInput}
                    value={form.date}
                    onChangeText={(text) => set('date', text)}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                {errors.date && (
                  <Text style={styles.errorText}>{errors.date}</Text>
                )}
              </View>

              {/* Amount Input */}
              <View style={styles.flex1}>
                <Text style={styles.inputLabel}>AMOUNT</Text>
                <View
                  style={[
                    styles.textInputRow,
                    errors.amount ? styles.inputErrorBorder : styles.inputNormalBorder,
                  ]}
                >
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={[
                      styles.inlineInput,
                      styles.amountText,
                      { fontFamily: fontMono },
                    ]}
                    value={form.amount}
                    onChangeText={(text) => set('amount', text)}
                    placeholder="0.00"
                    placeholderTextColor="#94A3B8"
                    keyboardType="decimal-pad"
                  />
                </View>
                {errors.amount && (
                  <Text style={styles.errorText}>{errors.amount}</Text>
                )}
              </View>
            </View>

            {/* Tags Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TAGS</Text>
              <View style={styles.tagsContainer}>
                {availableTags.map((tag) => {
                  const active = form.tags.includes(tag);
                  return (
                    <Pressable
                      key={tag}
                      style={[
                        styles.tagChip,
                        active ? styles.tagActive : styles.tagInactive,
                      ]}
                      onPress={() => toggleTag(tag)}
                    >
                      <Text
                        style={[
                          styles.tagText,
                          active ? styles.tagTextActive : styles.tagTextInactive,
                        ]}
                      >
                        {tag}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Note Input */}
            <View style={styles.inputGroup}>
              <View style={styles.noteLabelRow}>
                <Text style={styles.inputLabel}>NOTE </Text>
                <Text style={styles.optionalText}>(optional)</Text>
              </View>
              <TextInput
                style={[
                  styles.textInput,
                  styles.textArea,
                  styles.inputNormalBorder,
                ]}
                value={form.note}
                onChangeText={(text) => set('note', text)}
                placeholder="Add a note..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={2}
              />
            </View>
          </ScrollView>

          {/* Action CTA */}
          <View style={styles.ctaContainer}>
            <Pressable
              style={[
                styles.confirmButton,
                loading && styles.disabledButton,
              ]}
              onPress={handleConfirm}
              disabled={loading}
            >
              <Text style={styles.confirmButtonText}>
                {loading ? 'Saving...' : 'Confirm & Log Transaction'}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  flex1: {
    flex: 1,
  },
  previewContainer: {
    height: '36%',
    backgroundColor: '#1E293B',
    position: 'relative',
    padding: 16,
  },
  receiptCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  skeleton: {
    backgroundColor: '#CBD5E1',
    borderRadius: 4,
  },
  gap4: { height: 4 },
  gap8: { height: 8 },
  rowBetweenMargin: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  receiptDivider: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formPanel: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
    zIndex: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  handleBar: {
    width: 32,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  panelHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  panelSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  expenseButtonActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  incomeButtonActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  typeButtonText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: '#1E293B',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 1.5,
  },
  textInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '500',
    color: '#1E293B',
    backgroundColor: '#F8FAFC',
  },
  inputNormalBorder: {
    borderColor: '#E2E8F0',
  },
  inputErrorBorder: {
    borderColor: '#EF4444',
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 2,
  },
  rowGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  textInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    gap: 8,
  },
  inlineInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#1E293B',
    padding: 0,
  },
  currencySymbol: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 14,
  },
  amountText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  tagActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  tagInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  tagTextActive: {
    color: '#FFFFFF',
  },
  tagTextInactive: {
    color: '#475569',
  },
  noteLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionalText: {
    fontSize: 10,
    color: '#CBD5E1',
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  ctaContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  confirmButton: {
    backgroundColor: '#059669',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: 'rgba(5, 150, 105, 0.7)',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});