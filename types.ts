export type Screen = 'home' | 'camera' | 'voice' | 'review' | 'profile';

export type Profile = {
  name: string;
  email: string;
};

export type ParsedReceipt = {
  vendor: string;
  date: string;
  amount: string;
  tags: string[];
  note: string;
  type: 'income' | 'expense';
};

export type BudgetItem = {
  id: string;
  icon: string;
  label: string;
  spent: number;
  cap: number;
  color: string;
};

export type TransactionItem = {
  id: string;
  date: string;
  icon: string;
  name: string;
  type: 'credit' | 'debit';
  amount: number;
  timestamp: string;
  category: string;
};
