export interface User {
  id: string;
  email: string;
  currency: string;
}

export interface Session {
  accessToken: string;
  user: User;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  openingBalance: number;
  balance: number;
  currency: string;
}

export interface Category {
  id: string;
  name: string;
  type: string;
  color: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  type: string;
  amount: number;
  description: string;
  transactionDate: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  month: string;
  limit: number;
  spent: number;
}

export interface Recurring {
  id: string;
  accountId: string;
  categoryId: string;
  type: string;
  amount: number;
  description: string;
  frequency: string;
  nextOccurrence: string;
  isActive: boolean;
}

export interface CategorySpending {
  categoryId: string;
  name: string;
  color: string;
  amount: number;
}

export interface Summary {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  previousIncome: number;
  previousExpenses: number;
  previousNet: number;
  transactionCount: number;
  byCategory: CategorySpending[];
  recent: Transaction[];
}

export interface Trend {
  month: string;
  income: number;
  expenses: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ImportRow {
  row: number;
  description: string;
  date: string;
  amount: string;
  type: string;
  category: string;
  status: string;
  error: string | null;
}

export interface Preview {
  previewId: string;
  fileName: string;
  validCount: number;
  duplicateCount: number;
  failedCount: number;
  rows: ImportRow[];
}

export interface ImportBatch {
  id: string;
  fileName: string;
  importedCount: number;
  duplicateCount: number;
  failedCount: number;
  createdAt: string;
}