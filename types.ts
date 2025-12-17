
export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME'
}

export interface Transaction {
  id: string;
  type: TransactionType;
  category: string;
  amount: number;
  date: string;
  description: string;
}

export interface CategorySummary {
  name: string;
  value: number;
  color: string;
}

export interface FinancialStats {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  expenseByCategory: CategorySummary[];
}
