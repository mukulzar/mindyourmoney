import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BudgetItem } from '../../types';

interface Props {
  budgets: BudgetItem[];
  onChange: (budgets: BudgetItem[]) => void;
  onClose: () => void;
}

const COLORS = ['#059669', '#0EA5E9', '#8B5CF6', '#F97316'];

export default function ManageScreen({ budgets, onChange, onClose }: Props) {
  const [newLabel, setNewLabel] = useState('');
  const [newCap, setNewCap] = useState('');

  const recommendations = useMemo(() => {
    return budgets.flatMap((budget) => {
      const percentage = budget.cap ? budget.spent / budget.cap : 0;
      if (percentage >= 0.8) {
        return [`${budget.label} is at ${Math.round(percentage * 100)}%. Consider increasing its limit.`];
      }
      if (budget.spent === 0) {
        return [`${budget.label} has no spending yet. Keep the limit under review.`];
      }
      return [];
    });
  }, [budgets]);

  const updateCap = (budget: BudgetItem, value: string) => {
    const cap = Number(value);
    if (!Number.isFinite(cap)) return;
    onChange(budgets.map((item) => (item.id === budget.id ? { ...item, cap } : item)));
  };

  const addBudget = () => {
    const label = newLabel.trim();
    const cap = Number(newCap);
    if (!label || !Number.isFinite(cap) || cap <= 0) return;

    onChange([
      ...budgets,
      {
        id: `budget-${Date.now()}`,
        icon: '📌',
        label,
        spent: 0,
        cap,
        color: COLORS[budgets.length % COLORS.length],
      },
    ]);
    setNewLabel('');
    setNewCap('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Manage Budgets</Text>
          <Text style={styles.subtitle}>Set limits and review spending guidance</Text>
        </View>
        <Pressable onPress={onClose}>
          <Text style={styles.closeText}>Done</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Recommendations</Text>
        <View style={styles.recommendationBox}>
          {recommendations.length ? (
            recommendations.map((recommendation) => (
              <Text key={recommendation} style={styles.recommendationText}>
                {recommendation}
              </Text>
            ))
          ) : (
            <Text style={styles.recommendationText}>Your budgets are currently within their limits.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Your Budgets</Text>
        {budgets.map((budget) => {
          const percentage = budget.cap ? Math.round((budget.spent / budget.cap) * 100) : 0;
          const remaining = Math.max(budget.cap - budget.spent, 0);
          return (
            <View key={budget.id} style={styles.budgetCard}>
              <View style={styles.budgetHeader}>
                <Text style={styles.budgetIcon}>{budget.icon}</Text>
                <View style={styles.flex1}>
                  <Text style={styles.budgetName}>{budget.label}</Text>
                  <Text style={styles.budgetMeta}>
                    ${budget.spent.toFixed(2)} spent · ${remaining.toFixed(2)} remaining
                  </Text>
                </View>
                <Text style={[styles.percentage, percentage >= 80 && styles.warningText]}>
                  {percentage}%
                </Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${Math.min(percentage, 100)}%`, backgroundColor: budget.color }]} />
              </View>
              <View style={styles.editRow}>
                <Text style={styles.capLabel}>Limit $</Text>
                <TextInput
                  style={styles.capInput}
                  value={String(budget.cap)}
                  keyboardType="decimal-pad"
                  onChangeText={(value) => updateCap(budget, value)}
                />
                <Pressable onPress={() => onChange(budgets.filter((item) => item.id !== budget.id))}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Add Budget</Text>
        <View style={styles.addCard}>
          <TextInput style={styles.addInput} placeholder="Category name" placeholderTextColor="#94A3B8" value={newLabel} onChangeText={setNewLabel} />
          <TextInput style={styles.addInput} placeholder="Limit" placeholderTextColor="#94A3B8" keyboardType="decimal-pad" value={newCap} onChangeText={setNewCap} />
          <Pressable style={styles.addButton} onPress={addBudget}>
            <Text style={styles.addButtonText}>Add Budget</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F3' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, backgroundColor: '#102B26', borderBottomWidth: 1, borderBottomColor: '#102B26' },
  title: { color: '#F7FBF8', fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#9DC8BC', fontSize: 11, marginTop: 3 },
  closeText: { color: '#B8E5D7', fontSize: 13, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  sectionTitle: { color: '#1E293B', fontSize: 14, fontWeight: '700', marginTop: 8 },
  recommendationBox: { backgroundColor: '#E6F1EC', borderColor: '#C5DDD2', borderWidth: 1, borderRadius: 9, padding: 14, gap: 8 },
  recommendationText: { color: '#176653', fontSize: 12, lineHeight: 18 },
  budgetCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE5E0', borderRadius: 10, padding: 14, gap: 10 },
  budgetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  budgetIcon: { fontSize: 20 },
  flex1: { flex: 1 },
  budgetName: { color: '#18322D', fontSize: 14, fontWeight: '700' },
  budgetMeta: { color: '#94A3B8', fontSize: 11, marginTop: 3 },
  percentage: { color: '#059669', fontSize: 12, fontWeight: '700' },
  warningText: { color: '#DC2626' },
  progressTrack: { height: 7, borderRadius: 4, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 4 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  capLabel: { color: '#64748B', fontSize: 12 },
  capInput: { flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, color: '#1E293B', fontSize: 12 },
  deleteText: { color: '#DC2626', fontSize: 11, fontWeight: '600' },
  addCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE5E0', borderRadius: 10, padding: 14, gap: 9 },
  addInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, color: '#1E293B', fontSize: 12 },
  addButton: { backgroundColor: '#0F766E', borderRadius: 8, alignItems: 'center', paddingVertical: 11 },
  addButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
});
