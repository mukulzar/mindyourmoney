import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  StyleSheet,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Polyline, Line, Rect } from 'react-native-svg';
import * as Print from 'expo-print';
import AsyncStorage from '@react-native-async-storage/async-storage';

import CameraScreen from './CameraScreen';
import VoiceScreen from './VoiceScreen';
import ReviewScreen from './ReviewScreen';
import ManageScreen from './ManageScreen';
import ProfileScreen from './ProfileScreen';
import { parseReceiptImage } from '../../services/ai';
import type { BudgetItem, ParsedReceipt, Profile, Screen, TransactionItem } from '../../types';

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
};

type ExportPeriod = 'month' | 'previous-month' | 'year' | 'previous-year' | 'all';

type SavedState = {
  transactions: TransactionItem[];
  budgets: BudgetItem[];
  notifications?: NotificationItem[];
  profile?: Profile;
};

const STORAGE_KEY = 'wealthai-financial-state-v1';

const DEFAULT_PROFILE: Profile = {
  name: 'Mukul Gahlot',
  email: 'mukul@example.com',
};

const BUDGETS: BudgetItem[] = [
  { id: 'g1', icon: 'G', label: 'Groceries', spent: 640, cap: 800, color: '#0F766E' },
  { id: 't1', icon: 'T', label: 'Transport', spent: 240, cap: 350, color: '#2563EB' },
  { id: 'e1', icon: 'E', label: 'Entertainment', spent: 398, cap: 500, color: '#7C3AED' },
];

const BUDGET_CATEGORY_MAP: Record<string, string> = {
  'Food & Dining': 'Groceries',
  Transport: 'Transport',
  Entertainment: 'Entertainment',
};

const EMPTY_RECEIPT: ParsedReceipt = {
  vendor: '',
  date: '2026-09-19',
  amount: '',
  tags: [],
  note: '',
  type: 'expense',
};

interface Props {
  path?: string;
  onNavigate?: (s: Screen) => void;
}

// --- Icons ---

function BellIcon() {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}

function ChevronRight() {
  return (
    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

function ScanIcon() {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="23 7 23 1 17 1" />
      <Line x1="17" y1="1" x2="23" y2="7" />
      <Polyline points="1 17 1 23 7 23" />
      <Line x1="7" y1="23" x2="1" y2="17" />
      <Polyline points="23 17 23 23 17 23" />
      <Line x1="17" y1="23" x2="23" y2="17" />
      <Polyline points="1 7 1 1 7 1" />
      <Line x1="7" y1="1" x2="1" y2="7" />
    </Svg>
  );
}

function MicIcon() {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <Line x1="12" y1="19" x2="12" y2="23" />
      <Line x1="8" y1="23" x2="16" y2="23" />
    </Svg>
  );
}

function PlusIcon() {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <Line x1="12" y1="5" x2="12" y2="19" />
      <Line x1="5" y1="12" x2="19" y2="12" />
    </Svg>
  );
}

function ArrowUpIcon() {
  return (
    <Svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <Polyline points="18 15 12 9 6 15" />
    </Svg>
  );
}

// --- Main Screen ---

export default function HomeScreen({ onNavigate = () => undefined, path }: Props) {
  const [activeScreen, setActiveScreen] = useState<Screen>('home');
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [budgetManageOpen, setBudgetManageOpen] = useState(false);
  const [receipt, setReceipt] = useState<ParsedReceipt>(EMPTY_RECEIPT);
  const [budgets, setBudgets] = useState<BudgetItem[]>(
    BUDGETS.map((budget) => ({ ...budget, spent: 0 }))
  );
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [allTransactionsOpen, setAllTransactionsOpen] = useState(false);
  const [exportPeriodOpen, setExportPeriodOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expandedTx, setExpandedTx] = useState<string | null>(null);
  const unread = notifications.filter((notification) => !notification.read).length;
  const income = transactions
    .filter((transaction) => transaction.type === 'credit')
    .reduce((total, transaction) => total + transaction.amount, 0);
  const expenses = transactions
    .filter((transaction) => transaction.type === 'debit')
    .reduce((total, transaction) => total + transaction.amount, 0);
  const netWorth = income - expenses;
  const formatMoney = (value: number) => `$${value.toFixed(2)}`;
  const profileInitials = profile.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';
  const currentHour = new Date().getHours();
  const greeting =
    currentHour < 12
      ? 'Good morning,'
      : currentHour < 17
        ? 'Good afternoon,'
        : currentHour < 21
          ? 'Good evening,'
          : 'Good night,';

  void path;

  const fontMono = Platform.OS === 'ios' ? 'Courier' : 'monospace';

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!stored) return;
        const saved = JSON.parse(stored) as SavedState;
        setTransactions(
          (saved.transactions ?? []).map((transaction) => ({
            ...transaction,
            date: transaction.date ?? new Date().toISOString().slice(0, 10),
          }))
        );
        setBudgets(saved.budgets ?? BUDGETS.map((budget) => ({ ...budget, spent: 0 })));
        setNotifications(saved.notifications ?? []);
        setProfile(saved.profile ?? DEFAULT_PROFILE);
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ transactions, budgets, notifications, profile })
    ).catch(() => undefined);
  }, [budgets, hydrated, notifications, profile, transactions]);

  const handleNavigate = (screen: Screen) => {
    if (screen === 'home') {
      setActiveScreen('home');
      return;
    }
    setActiveScreen(screen);
  };

  const handleConfirmReceipt = (data: ParsedReceipt) => {
    const amount = Number(data.amount);
    const isIncome = data.type === 'income';
    const transactionDate = data.date || new Date().toISOString().slice(0, 10);
    setTransactions((current) => [
      {
        id: `tx-${Date.now()}`,
        date: transactionDate,
        icon: isIncome ? '💰' : '🧾',
        name: data.vendor,
        type: isIncome ? 'credit' : 'debit',
        amount,
        timestamp: `Today · ${new Date().toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
        })}`,
        category: data.tags[0] ?? 'Other',
      },
      ...current,
    ]);

    const budgetLabel = !isIncome
      ? data.tags
          .map((tag) => BUDGET_CATEGORY_MAP[tag] ?? tag)
          .find((tag) => budgets.some((budget) => budget.label === tag))
      : undefined;

    const notificationTime = new Date().toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
    setNotifications((current) => [
      {
        id: `notification-${Date.now()}`,
        title: isIncome ? 'Income added' : 'Expense added',
        body: `${data.vendor || 'Transaction'} was logged for $${amount.toFixed(2)}.`,
        time: notificationTime,
        read: false,
      },
      ...current,
    ]);

    if (budgetLabel && Number.isFinite(amount)) {
      const matchedBudget = budgets.find((budget) => budget.label === budgetLabel);
      const updatedSpent = (matchedBudget?.spent ?? 0) + amount;
      if (matchedBudget && updatedSpent >= matchedBudget.cap * 0.8) {
        setNotifications((current) => [
          {
            id: `notification-budget-${Date.now()}`,
            title: `${matchedBudget.label} budget alert`,
            body: `${matchedBudget.label} is now ${Math.round((updatedSpent / matchedBudget.cap) * 100)}% of its limit.`,
            time: notificationTime,
            read: false,
          },
          ...current,
        ]);
      }
      setBudgets((current) =>
        current.map((budget) =>
          budget.label === budgetLabel
            ? { ...budget, spent: budget.spent + amount }
            : budget
        )
      );
    }
    setReceipt(EMPTY_RECEIPT);
  };

  const handleReceiptCapture = async (imageUri: string) => {
    try {
      const parsed = await parseReceiptImage(imageUri);
      setReceipt((current) => ({
        ...current,
        vendor: parsed.vendor,
        amount: parsed.amount,
        date: parsed.date || current.date,
        tags: parsed.tags,
        type: 'expense',
      }));
      setActiveScreen('review');
    } catch (error) {
      Alert.alert(
        'Receipt scan failed',
        error instanceof Error ? error.message : 'Could not read this receipt.'
      );
    }
  };

  const resetFinancialData = () => {
    Alert.alert('Reset all data?', 'All transactions and budget progress will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          setTransactions([]);
          setBudgets(BUDGETS.map((budget) => ({ ...budget, spent: 0 })));
          setNotifications([]);
          setProfile(DEFAULT_PROFILE);
          setReceipt(EMPTY_RECEIPT);
          await AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              transactions: [],
              budgets: BUDGETS.map((budget) => ({ ...budget, spent: 0 })),
              notifications: [],
              profile: DEFAULT_PROFILE,
            })
          );
        },
      },
    ]);
  };

  const exportTransactions = async (period: ExportPeriod) => {
    if (exporting) return;

    setExporting(true);
    try {
      const now = new Date();
      const filteredTransactions = transactions.filter((transaction) => {
        const transactionDate = new Date(`${transaction.date}T00:00:00`);
        if (period === 'all') return true;
        if (period === 'year') return transactionDate.getFullYear() === now.getFullYear();
        if (period === 'previous-year') {
          return transactionDate.getFullYear() === now.getFullYear() - 1;
        }
        if (period === 'month') {
          return (
            transactionDate.getFullYear() === now.getFullYear() &&
            transactionDate.getMonth() === now.getMonth()
          );
        }
        const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return (
          transactionDate.getFullYear() === previousMonth.getFullYear() &&
          transactionDate.getMonth() === previousMonth.getMonth()
        );
      });
      const transactionRows = filteredTransactions.length
        ? filteredTransactions
            .map(
              (transaction) => `
                <tr>
                  <td>${transaction.id}</td>
                  <td>${transaction.date}</td>
                  <td>${transaction.name}</td>
                  <td class="${transaction.type}">${transaction.type === 'credit' ? 'Income' : 'Expense'}</td>
                  <td>${transaction.type === 'credit' ? '+' : '-'}$${transaction.amount.toFixed(2)}</td>
                  <td>${transaction.category}</td>
                </tr>`
            )
            .join('')
        : '<tr><td colspan="6" class="empty">No transactions in this period.</td></tr>';
      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
              body { font-family: Arial, sans-serif; color: #1E293B; padding: 24px; }
              h1 { color: #059669; margin-bottom: 4px; }
              p { color: #64748B; margin-top: 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 24px; }
              th { background: #059669; color: white; text-align: left; }
              th, td { padding: 9px 7px; border: 1px solid #CBD5E1; font-size: 10px; }
              .credit { color: #059669; font-weight: bold; }
              .debit { color: #DC2626; font-weight: bold; }
              .empty { text-align: center; color: #64748B; padding: 24px; }
            </style>
          </head>
          <body>
            <h1>WealthAI Transactions</h1>
            <p>Period: ${period === 'all' ? 'All history' : period === 'year' ? 'This year' : period === 'previous-year' ? 'Previous year' : period === 'month' ? 'This month' : 'Previous month'}</p>
            <table>
              <thead>
                <tr><th>ID</th><th>Date</th><th>Name</th><th>Type</th><th>Amount</th><th>Category</th></tr>
              </thead>
              <tbody>${transactionRows}</tbody>
            </table>
          </body>
        </html>`;
      await Print.printAsync({ html });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sharing error';
      Alert.alert('PDF failed', `The PDF could not be opened.\n\n${message}`);
    } finally {
      setExporting(false);
    }
  };

  const chooseExportPeriod = (period: ExportPeriod) => {
    setExportPeriodOpen(false);
    void exportTransactions(period);
  };

  if (activeScreen === 'camera') {
    return (
      <CameraScreen
        onNavigate={handleNavigate}
        onCapture={handleReceiptCapture}
      />
    );
  }

  if (activeScreen === 'voice') {
    return (
      <VoiceScreen
        onNavigate={handleNavigate}
        onParsed={(data) => {
          setReceipt((current) => ({
            ...current,
            vendor: data.vendor ?? current.vendor,
            amount: data.amount ?? current.amount,
            date: data.date ?? current.date,
            tags: data.tags ?? current.tags,
            type: 'expense',
          }));
          setActiveScreen('review');
        }}
      />
    );
  }

  if (activeScreen === 'review') {
    return (
      <ReviewScreen
        prefill={receipt}
        budgetTags={budgets.map((budget) => budget.label)}
        onNavigate={handleNavigate}
        onConfirm={handleConfirmReceipt}
      />
    );
  }

  if (activeScreen === 'profile') {
    return (
      <ProfileScreen
        profile={profile}
        onSave={setProfile}
        onClose={() => setActiveScreen('home')}
      />
    );
  }

  if (budgetManageOpen) {
    return (
      <ManageScreen
        budgets={budgets}
        onChange={setBudgets}
        onClose={() => setBudgetManageOpen(false)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Notification Drawer / Modal */}
      <Modal visible={notifOpen} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Notifications</Text>
            <Pressable onPress={() => setNotifOpen(false)}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.flex1} showsVerticalScrollIndicator={false}>
            {notifications.length === 0 ? (
              <Text style={styles.emptyTransactionsText}>No notifications yet.</Text>
            ) : (
              notifications.map((notification) => (
                <View
                  key={notification.id}
                  style={[
                    styles.notifItem,
                    !notification.read ? styles.notifUnreadBg : null,
                  ]}
                >
                  {!notification.read ? (
                    <View style={styles.unreadDot} />
                  ) : (
                    <View style={styles.unreadDotPlaceholder} />
                  )}
                  <View style={styles.flex1}>
                    <Text style={styles.notifItemTitle}>{notification.title}</Text>
                    <Text style={styles.notifItemBody}>{notification.body}</Text>
                  </View>
                  <Text style={styles.notifItemTime}>{notification.time}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={allTransactionsOpen} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>All Transactions</Text>
              <Text style={styles.modalSubtitle}>{transactions.length} total</Text>
            </View>
            <Pressable onPress={() => setAllTransactionsOpen(false)}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.flex1} contentContainerStyle={styles.allTransactionsContent}>
            {transactions.length === 0 ? (
              <Text style={styles.emptyTransactionsText}>No transactions yet.</Text>
            ) : (
              transactions.map((transaction) => (
                <View key={transaction.id} style={styles.allTransactionRow}>
                  <View style={styles.txIconBox}>
                    <Text style={{ fontSize: 20 }}>{transaction.icon}</Text>
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.txName}>{transaction.name}</Text>
                    <Text style={styles.txTime}>
                      {transaction.category} · {transaction.timestamp}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      { fontFamily: fontMono },
                      transaction.type === 'credit' ? styles.creditText : styles.darkText,
                    ]}
                  >
                    {transaction.type === 'credit' ? '+' : '-'}${transaction.amount.toFixed(2)}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
          <View style={styles.exportContainer}>
            <Pressable
              style={[styles.exportButton, exporting && styles.disabledExportButton]}
              onPress={() => setExportPeriodOpen(true)}
              disabled={exporting}
            >
              <Text style={styles.exportButtonText}>
                {exporting ? 'Preparing PDF...' : 'Save or Share PDF'}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={exportPeriodOpen} animationType="fade" transparent>
        <View style={styles.periodBackdrop}>
          <View style={styles.periodCard}>
            <Text style={styles.periodTitle}>Choose PDF duration</Text>
            <Text style={styles.periodSubtitle}>Which transactions should be included?</Text>
            <Pressable style={styles.periodOption} onPress={() => chooseExportPeriod('month')}>
              <Text style={styles.periodOptionText}>This month</Text>
            </Pressable>
            <Pressable style={styles.periodOption} onPress={() => chooseExportPeriod('previous-month')}>
              <Text style={styles.periodOptionText}>Previous month</Text>
            </Pressable>
            <Pressable style={styles.periodOption} onPress={() => chooseExportPeriod('year')}>
              <Text style={styles.periodOptionText}>This year</Text>
            </Pressable>
            <Pressable style={styles.periodOption} onPress={() => chooseExportPeriod('previous-year')}>
              <Text style={styles.periodOptionText}>Previous year</Text>
            </Pressable>
            <Pressable style={styles.periodOption} onPress={() => chooseExportPeriod('all')}>
              <Text style={styles.periodOptionText}>All history</Text>
            </Pressable>
            <Pressable style={styles.periodCancel} onPress={() => setExportPeriodOpen(false)}>
              <Text style={styles.periodCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.userSection} onPress={() => setActiveScreen('profile')}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profileInitials}</Text>
          </View>
          <View>
            <Text style={styles.greetingText}>{greeting}</Text>
            <Text style={styles.userNameText}>{profile.name}</Text>
          </View>
        </Pressable>
        <Pressable
          style={styles.bellButton}
          onPress={() => {
            setNotifOpen(true);
            setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
          }}
        >
          <BellIcon />
          {unread > 0 && <View style={styles.badge} />}
        </Pressable>
      </View>

      {/* Scrollable Content */}
      <ScrollView style={styles.flex1} showsVerticalScrollIndicator={false}>
        {/* Hero Balance Card */}
        <View style={styles.heroWrapper}>
          <View style={styles.card}>
            <Text style={styles.heroSubtitle}>TOTAL NET WORTH</Text>
            <View style={styles.balanceContainer}>
              <Text style={[styles.balanceMain, { fontFamily: fontMono }]}>
                {formatMoney(netWorth).split('.')[0]}
              </Text>
              <Text style={[styles.balanceCents, { fontFamily: fontMono }]}>
                .{formatMoney(netWorth).split('.')[1]}
              </Text>
            </View>
            <View style={styles.badgeRow}>
              <View style={styles.percentBadge}>
                <ArrowUpIcon />
                <Text style={styles.percentText}>{transactions.length} entries</Text>
              </View>
              <Text style={styles.vsText}>live ledger</Text>
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>INCOME</Text>
                <Text style={[styles.statValue, { color: '#059669', fontFamily: fontMono }]}>
                  {formatMoney(income)}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>EXPENSES</Text>
                <Text style={[styles.statValue, { color: '#EF4444', fontFamily: fontMono }]}>
                  {formatMoney(expenses)}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>SAVINGS</Text>
                <Text style={[styles.statValue, { color: '#1E293B', fontFamily: fontMono }]}>
                  {formatMoney(netWorth)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <Pressable
            style={[styles.actionBtn, styles.greenBtn]}
            onPress={() => handleNavigate('camera')}
          >
            <ScanIcon />
            <Text style={styles.actionBtnText}>Scan Receipt</Text>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, styles.darkBtn]}
            onPress={() => handleNavigate('voice')}
          >
            <MicIcon />
            <Text style={styles.actionBtnText}>Voice Log</Text>
          </Pressable>
        </View>

        {/* Budgets */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Budget overview</Text>
            <Pressable style={styles.manageBtn} onPress={() => setBudgetManageOpen(true)}>
              <Text style={styles.manageBtnText}>Manage</Text>
              <ChevronRight />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScrollContent}
          >
            {budgets.map((b) => {
              const pct = Math.round((b.spent / b.cap) * 100);
              const over = pct >= 80;
              return (
                <Pressable key={b.id} style={styles.budgetCard}>
                  <View style={styles.budgetTopRow}>
                    <Text style={{ fontSize: 18 }}>{b.icon}</Text>
                    <Text
                      style={[
                        styles.pctText,
                        { color: over ? '#EF4444' : '#059669', fontFamily: fontMono },
                      ]}
                    >
                        {Math.round((b.spent / b.cap) * 100)}%
                    </Text>
                  </View>
                  <Text style={styles.budgetLabel}>{b.label}</Text>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${pct}%`,
                          backgroundColor: over ? '#EF4444' : b.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.budgetAmount, { fontFamily: fontMono }]}>
                    ${b.spent} /${b.cap}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Transactions */}
        <View style={styles.transactionsWrapper}>
          <View style={styles.sectionHeaderNoPadding}>
            <Text style={styles.sectionTitle}>Recent transactions</Text>
            <View style={styles.transactionHeaderActions}>
              <Pressable style={styles.resetButton} onPress={resetFinancialData}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </Pressable>
              <Pressable style={styles.manageBtn} onPress={() => setAllTransactionsOpen(true)}>
                <Text style={styles.manageBtnText}>See all</Text>
                <ChevronRight />
              </Pressable>
            </View>
          </View>
          <View style={styles.cardNoPadding}>
            {transactions.map((tx, i) => (
              <View key={tx.id}>
                <Pressable
                  style={styles.txRow}
                  onPress={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                >
                  <View style={styles.txIconBox}>
                    <Text style={{ fontSize: 20 }}>{tx.icon}</Text>
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.txName} numberOfLines={1}>
                      {tx.name}
                    </Text>
                    <Text style={styles.txTime}>{tx.timestamp}</Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      { fontFamily: fontMono },
                      tx.type === 'credit' ? styles.creditText : styles.darkText,
                    ]}
                  >
                    {tx.type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
                  </Text>
                </Pressable>

                {/* Expanded Row */}
                {expandedTx === tx.id && (
                  <View style={styles.expandedBox}>
                    <View>
                      <Text style={styles.expLabel}>Category</Text>
                      <Text style={styles.expValue}>{tx.category}</Text>
                    </View>
                    <View style={styles.btnGroup}>
                      <Pressable style={styles.editBtn}>
                        <Text style={styles.editBtnText}>Edit</Text>
                      </Pressable>
                      <Pressable style={styles.deleteBtn}>
                        <Text style={styles.deleteBtnText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
                {i < transactions.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>

          {/* Add Manual Transaction Button */}
          <Pressable
            style={styles.addTxBtn}
            onPress={() => handleNavigate('review')}
          >
            <PlusIcon />
            <Text style={styles.addTxBtnText}>Add transaction manually</Text>
          </Pressable>
        </View>
      </ScrollView>
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
  reviewContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  reviewTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  reviewBackButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  reviewBackText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  doneBtnText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '500',
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  allTransactionsContent: {
    paddingBottom: 24,
  },
  allTransactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  emptyTransactionsText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 48,
  },
  exportContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  exportButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 13,
  },
  disabledExportButton: {
    opacity: 0.6,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  periodBackdrop: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 24,
  },
  periodCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  periodTitle: {
    color: '#1E293B',
    fontSize: 18,
    fontWeight: '700',
  },
  periodSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 14,
  },
  periodOption: {
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  periodOptionText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '600',
  },
  periodCancel: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  periodCancelText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 12,
  },
  notifUnreadBg: {
    backgroundColor: '#F0FDF4',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669',
    marginTop: 6,
  },
  unreadDotPlaceholder: {
    width: 8,
    height: 8,
  },
  notifItemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  notifItemBody: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  notifItemTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  greetingText: {
    fontSize: 11,
    color: '#94A3B8',
    marginBottom: 2,
  },
  userNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  heroWrapper: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  heroSubtitle: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  balanceMain: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -1,
    lineHeight: 40,
  },
  balanceCents: {
    fontSize: 22,
    fontWeight: '600',
    color: '#94A3B8',
    paddingBottom: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  percentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  percentText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '600',
  },
  vsText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  statsRow: {
    flexDirection: 'row',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  quickActionsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  greenBtn: {
    backgroundColor: '#059669',
  },
  darkBtn: {
    backgroundColor: '#1E293B',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionContainer: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionHeaderNoPadding: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  transactionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resetButton: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  resetButtonText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  manageBtnText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '500',
  },
  horizontalScrollContent: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 4,
  },
  budgetCard: {
    width: 118,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  budgetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pctText: {
    fontSize: 10,
    fontWeight: '700',
  },
  budgetLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  budgetAmount: {
    fontSize: 10,
    color: '#94A3B8',
  },
  transactionsWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  cardNoPadding: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  txIconBox: {
    width: 40,
    height: 40,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  txName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  txTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  creditText: {
    color: '#059669',
  },
  darkText: {
    color: '#1E293B',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
  },
  expandedBox: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  expLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  expValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 1,
  },
  btnGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  editBtnText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#475569',
  },
  deleteBtn: {
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  deleteBtnText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#EF4444',
  },
  addTxBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 14,
  },
  addTxBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
});