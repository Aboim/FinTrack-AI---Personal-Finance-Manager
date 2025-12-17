
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  Tooltip
} from 'recharts';
import { 
  PlusIcon, 
  ArrowUpIcon, 
  ArrowDownIcon, 
  TrashIcon, 
  PencilIcon,
  ArrowUpTrayIcon,
  SparklesIcon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  FunnelIcon,
  TagIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { Transaction, TransactionType, FinancialStats } from './types';
import { getFinancialInsights } from './services/geminiService';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#2dd4bf', '#fb7185', '#a855f7'];

type SortKey = keyof Transaction;
type SortDirection = 'asc' | 'desc';

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<string[]>(['Salary', 'Groceries', 'Rent', 'Entertainment', 'Transport', 'Utilities', 'Healthcare']);
  const [insights, setInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'date',
    direction: 'desc'
  });

  // Category management temporary state
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryName, setEditingCategoryName] = useState<{ old: string; current: string } | null>(null);

  // File selection state
  const [selectedIncomeFile, setSelectedIncomeFile] = useState<File | null>(null);
  const [selectedExpenseFile, setSelectedExpenseFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const incomeInputRef = useRef<HTMLInputElement>(null);
  const expenseInputRef = useRef<HTMLInputElement>(null);

  // Theme Detection and Application
  useEffect(() => {
    const hour = new Date().getHours();
    const isNight = hour >= 19 || hour < 7;
    const initialTheme = isNight ? 'dark' : 'light';
    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#0f172a';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '#f8fafc';
    }
  }, [theme]);

  // Ensure categories list matches transactions
  useEffect(() => {
    const uniqueFromTransactions = Array.from(new Set(transactions.map(t => t.category)));
    setCategories(prev => {
      const combined = Array.from(new Set([...prev, ...uniqueFromTransactions]));
      return combined.sort();
    });
  }, [transactions]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Sorting logic
  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedAndFilteredTransactions = useMemo(() => {
    let result = [...transactions];
    
    if (selectedCategory) {
      result = result.filter(t => t.category === selectedCategory);
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [transactions, sortConfig, selectedCategory]);

  // Stats Calculation
  const stats: FinancialStats = useMemo(() => {
    const totalIncome = transactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = transactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.amount, 0);

    const expenseMap: Record<string, number> = {};
    transactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .forEach(t => {
        expenseMap[t.category] = (expenseMap[t.category] || 0) + t.amount;
      });

    const expenseByCategory = Object.entries(expenseMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((item, index) => ({
        ...item,
        color: COLORS[index % COLORS.length]
      }));

    return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses, expenseByCategory };
  }, [transactions]);

  const readFileAsTransactions = (file: File, type: TransactionType): Promise<Transaction[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          const data = Array.isArray(json) ? json : [json];
          const mapped: Transaction[] = data.map((item: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            type: type,
            category: item.category || (type === TransactionType.INCOME ? 'Salary' : 'General'),
            amount: parseFloat(item.amount) || 0,
            date: item.date || new Date().toISOString().split('T')[0],
            description: item.description || ''
          }));
          resolve(mapped);
        } catch (err) { reject(err); }
      };
      reader.onerror = () => reject(new Error("File read error"));
      reader.readAsText(file);
    });
  };

  const handleExecuteImport = async () => {
    if (!selectedIncomeFile && !selectedExpenseFile) {
      alert("Please select at least one file to import.");
      return;
    }
    setIsImporting(true);
    let newTransactions: Transaction[] = [];
    try {
      if (selectedIncomeFile) {
        const incomeData = await readFileAsTransactions(selectedIncomeFile, TransactionType.INCOME);
        newTransactions = [...newTransactions, ...incomeData];
      }
      if (selectedExpenseFile) {
        const expenseData = await readFileAsTransactions(selectedExpenseFile, TransactionType.EXPENSE);
        newTransactions = [...newTransactions, ...expenseData];
      }
      setTransactions(newTransactions);
      setSelectedIncomeFile(null);
      setSelectedExpenseFile(null);
      setSelectedCategory(null);
      if (incomeInputRef.current) incomeInputRef.current.value = '';
      if (expenseInputRef.current) expenseInputRef.current.value = '';
      setInsights(null);
      alert("Data imported successfully! Existing records were replaced.");
    } catch (err) {
      alert("Error processing JSON files. Please check the format.");
    } finally { setIsImporting(false); }
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const handleEditClick = (t: Transaction) => {
    setEditingTransaction(t);
    setIsModalOpen(true);
  };

  const saveTransaction = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const updated: Transaction = {
      id: editingTransaction?.id || Math.random().toString(36).substr(2, 9),
      type: formData.get('type') as TransactionType,
      category: formData.get('category') as string,
      amount: parseFloat(formData.get('amount') as string),
      date: formData.get('date') as string,
      description: formData.get('description') as string,
    };
    if (editingTransaction) {
      setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));
    } else {
      setTransactions(prev => [updated, ...prev]);
    }
    setIsModalOpen(false);
    setEditingTransaction(null);
  };

  const generateAIInsights = async () => {
    if (transactions.length === 0) return;
    setLoadingInsights(true);
    const text = await getFinancialInsights(transactions);
    setInsights(text);
    setLoadingInsights(false);
  };

  // Category Management Functions
  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    if (categories.includes(newCategoryName.trim())) {
      alert("Category already exists.");
      return;
    }
    setCategories(prev => [...prev, newCategoryName.trim()].sort());
    setNewCategoryName('');
  };

  const handleDeleteCategory = (cat: string) => {
    if (window.confirm(`Are you sure you want to delete "${cat}"? Transactions using this category will be moved to "Uncategorized".`)) {
      setCategories(prev => prev.filter(c => c !== cat));
      setTransactions(prev => prev.map(t => t.category === cat ? { ...t, category: 'Uncategorized' } : t));
      if (selectedCategory === cat) setSelectedCategory(null);
    }
  };

  const handleRenameCategory = () => {
    if (!editingCategoryName || !editingCategoryName.current.trim()) return;
    const { old, current } = editingCategoryName;
    if (old === current) {
      setEditingCategoryName(null);
      return;
    }
    setCategories(prev => prev.map(c => c === old ? current : c).sort());
    setTransactions(prev => prev.map(t => t.category === old ? { ...t, category: current } : t));
    if (selectedCategory === old) setSelectedCategory(current);
    setEditingCategoryName(null);
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return null;
    return sortConfig.direction === 'asc' ? 
      <ChevronUpIcon className="w-3 h-3 ml-1" /> : 
      <ChevronDownIcon className="w-3 h-3 ml-1" />;
  };

  return (
    <div className={`min-h-screen pb-12 transition-colors duration-300 ${theme === 'dark' ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">FinTrack <span className="text-indigo-600">AI</span></h1>
          </div>
          
          <div className="flex items-center space-x-3">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setIsCategoryModalOpen(true)}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center"
              title="Manage Categories"
            >
              <TagIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              <span>Add Transaction</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        {/* KPI Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Balance</span>
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeWidth="2" /></svg>
              </div>
            </div>
            <div className={`text-3xl font-bold ${stats.balance >= 0 ? 'text-slate-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
              ${stats.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Income</span>
              <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-600 dark:text-green-400"><ArrowUpIcon className="w-5 h-5" /></div>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">
              ${stats.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Expenses</span>
              <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400"><ArrowDownIcon className="w-5 h-5" /></div>
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">
              ${stats.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Data Import Section */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 mb-8 transition-colors">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <DocumentArrowUpIcon className="w-6 h-6 text-indigo-600" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Batch Import Data</h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Income JSON (Receitas)</label>
              <div onClick={() => incomeInputRef.current?.click()} className={`flex items-center justify-between px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-all ${selectedIncomeFile ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400'}`}>
                <div className="flex items-center overflow-hidden">
                  {selectedIncomeFile ? <CheckCircleIcon className="w-5 h-5 text-emerald-500 mr-2 flex-shrink-0" /> : <ArrowUpTrayIcon className="w-5 h-5 text-slate-400 mr-2 flex-shrink-0" />}
                  <span className={`text-sm truncate ${selectedIncomeFile ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}`}>{selectedIncomeFile ? selectedIncomeFile.name : 'Select file...'}</span>
                </div>
                <input type="file" ref={incomeInputRef} className="hidden" accept=".json" onChange={(e) => setSelectedIncomeFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Expenses JSON (Despesas)</label>
              <div onClick={() => expenseInputRef.current?.click()} className={`flex items-center justify-between px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-all ${selectedExpenseFile ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/10' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400'}`}>
                <div className="flex items-center overflow-hidden">
                  {selectedExpenseFile ? <CheckCircleIcon className="w-5 h-5 text-amber-500 mr-2 flex-shrink-0" /> : <ArrowUpTrayIcon className="w-5 h-5 text-slate-400 mr-2 flex-shrink-0" />}
                  <span className={`text-sm truncate ${selectedExpenseFile ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400'}`}>{selectedExpenseFile ? selectedExpenseFile.name : 'Select file...'}</span>
                </div>
                <input type="file" ref={expenseInputRef} className="hidden" accept=".json" onChange={(e) => setSelectedExpenseFile(e.target.files?.[0] || null)} />
              </div>
            </div>
            <button onClick={handleExecuteImport} disabled={isImporting || (!selectedIncomeFile && !selectedExpenseFile)} className="w-full bg-slate-900 dark:bg-indigo-600 text-white font-bold py-3.5 px-6 rounded-xl hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center shadow-md active:scale-[0.98]">
              {isImporting ? <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <><DocumentArrowUpIcon className="w-5 h-5 mr-2" />Import Selected Files</>}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Expense Breakdown (Top 10)</h2>
                {selectedCategory && <span className="text-xs font-medium text-slate-400 flex items-center">Click slice to filter table</span>}
              </div>
              <div className="h-[300px] w-full">
                {stats.expenseByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.expenseByCategory} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} onClick={(data) => setSelectedCategory(selectedCategory === data.name ? null : data.name)}>
                        {stats.expenseByCategory.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke={selectedCategory === entry.name ? '#4f46e5' : 'none'} strokeWidth={3} style={{ cursor: 'pointer', outline: 'none', opacity: !selectedCategory || selectedCategory === entry.name ? 1 : 0.3, transition: 'opacity 300ms, stroke 300ms' }} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, 'Amount']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', color: theme === 'dark' ? '#ffffff' : '#1e293b' }} itemStyle={{ color: theme === 'dark' ? '#cbd5e1' : '#475569' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500"><p>No expense data to visualize.</p></div>}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden transition-colors">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-semibold text-slate-900 dark:text-white">Transactions</h2></div>
                {selectedCategory && (
                  <div className="flex items-center space-x-2 animate-fade-in">
                    <div className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold border border-indigo-100 dark:border-indigo-800">
                      <FunnelIcon className="w-3 h-3 mr-1.5" />Showing: {selectedCategory}
                      <button onClick={() => setSelectedCategory(null)} className="ml-2 hover:text-indigo-800 dark:hover:text-indigo-200"><XMarkIcon className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">
                    <tr>
                      <th className="px-6 py-4 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('date')}><div className="flex items-center">Date <SortIcon column="date" /></div></th>
                      <th className="px-6 py-4 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('description')}><div className="flex items-center">Description <SortIcon column="description" /></div></th>
                      <th className="px-6 py-4 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('category')}><div className="flex items-center">Category <SortIcon column="category" /></div></th>
                      <th className="px-6 py-4 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('amount')}><div className="flex items-center">Amount <SortIcon column="amount" /></div></th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {sortedAndFilteredTransactions.length === 0 ? <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">{selectedCategory ? `No transactions for "${selectedCategory}"` : 'No transactions found.'}</td></tr> : sortedAndFilteredTransactions.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{t.date}</td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{t.description}</td>
                        <td className="px-6 py-4"><span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-xs font-medium">{t.category}</span></td>
                        <td className={`px-6 py-4 text-sm font-semibold ${t.type === TransactionType.INCOME ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{t.type === TransactionType.INCOME ? '+' : '-'}${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button onClick={() => handleEditClick(t)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg"><PencilIcon className="w-4 h-4" /></button>
                          <button onClick={() => deleteTransaction(t.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"><TrashIcon className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 opacity-10"><SparklesIcon className="w-32 h-32" /></div>
              <div className="relative z-10">
                <h3 className="text-lg font-bold mb-2 flex items-center"><SparklesIcon className="w-5 h-5 mr-2" />AI Insights</h3>
                <p className="text-indigo-100 text-sm mb-6 leading-relaxed">Get personalized analysis on your spending habits.</p>
                <button onClick={generateAIInsights} disabled={loadingInsights || transactions.length === 0} className="w-full bg-white text-indigo-600 font-semibold py-2.5 px-4 rounded-xl hover:bg-indigo-50 transition-colors disabled:opacity-50">
                  {loadingInsights ? <svg className="animate-spin h-5 w-5 text-indigo-600 mx-auto" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : 'Generate Insights'}
                </button>
                {insights && <div className="mt-6 p-4 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20 animate-fade-in text-sm italic">{insights}</div>}
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Quick Tips</h3>
              <ul className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-start"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 mr-2"></div>Click on a pie slice to filter.</li>
                <li className="flex items-start"><div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 mr-2"></div>Use the <TagIcon className="w-4 h-4 inline" /> icon to manage your categories.</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Category Management Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200 border dark:border-slate-700">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Manage Categories</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <div className="p-6">
              <div className="mb-6 flex space-x-2">
                <input 
                  type="text" 
                  value={newCategoryName} 
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category name..."
                  className="flex-1 rounded-xl border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white shadow-sm px-3 py-2 bg-slate-50 dark:bg-slate-700 border"
                />
                <button onClick={handleAddCategory} className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors flex items-center">
                  <PlusIcon className="w-4 h-4 mr-1" /> Add
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2 pr-2">
                {categories.map((cat) => (
                  <div key={cat} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl group transition-colors hover:bg-slate-100 dark:hover:bg-slate-700">
                    {editingCategoryName?.old === cat ? (
                      <div className="flex-1 flex space-x-2">
                        <input 
                          type="text" 
                          value={editingCategoryName.current} 
                          onChange={(e) => setEditingCategoryName({ ...editingCategoryName, current: e.target.value })}
                          className="flex-1 rounded-lg border-slate-300 dark:border-slate-500 text-sm px-2 py-1 bg-white dark:bg-slate-600 text-white"
                          autoFocus
                        />
                        <button onClick={handleRenameCategory} className="text-emerald-500 hover:text-emerald-600"><CheckIcon className="w-5 h-5" /></button>
                        <button onClick={() => setEditingCategoryName(null)} className="text-slate-400 hover:text-slate-600"><XMarkIcon className="w-5 h-5" /></button>
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{cat}</span>
                        <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditingCategoryName({ old: cat, current: cat })} className="p-1 text-slate-400 hover:text-indigo-600"><PencilIcon className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteCategory(cat)} className="p-1 text-slate-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border dark:border-slate-700">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{editingTransaction ? 'Edit Transaction' : 'New Transaction'}</h3>
              <button onClick={() => { setIsModalOpen(false); setEditingTransaction(null); }} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400"><XMarkIcon className="w-6 h-6" /></button>
            </div>
            <form onSubmit={saveTransaction} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Type</label>
                <select name="type" defaultValue={editingTransaction?.type || TransactionType.EXPENSE} className="w-full rounded-xl border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 px-3 py-2 bg-slate-50 dark:bg-slate-700 border">
                  <option value={TransactionType.EXPENSE}>Expense</option>
                  <option value={TransactionType.INCOME}>Income</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Amount ($)</label>
                  <input type="number" name="amount" step="0.01" required defaultValue={editingTransaction?.amount} className="w-full rounded-xl border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 px-3 py-2 bg-slate-50 dark:bg-slate-700 border" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Date</label>
                  <input type="date" name="date" required defaultValue={editingTransaction?.date || new Date().toISOString().split('T')[0]} className="w-full rounded-xl border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 px-3 py-2 bg-slate-50 dark:bg-slate-700 border" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select 
                  name="category" 
                  required 
                  defaultValue={editingTransaction?.category || (categories.length > 0 ? categories[0] : '')}
                  className="w-full rounded-xl border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 px-3 py-2 bg-slate-50 dark:bg-slate-700 border"
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <textarea name="description" rows={2} defaultValue={editingTransaction?.description} className="w-full rounded-xl border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 px-3 py-2 bg-slate-50 dark:bg-slate-700 border" />
              </div>
              <div className="pt-4 flex space-x-3">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingTransaction(null); }} className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-50 font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium shadow-sm">{editingTransaction ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
