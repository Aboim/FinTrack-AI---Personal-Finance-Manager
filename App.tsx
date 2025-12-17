
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
  CheckIcon,
  WalletIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import { Transaction, TransactionType, FinancialStats } from './types';
import { getFinancialInsights } from './services/geminiService';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#2dd4bf', '#fb7185', '#a855f7'];

type SortKey = keyof Transaction;
type SortDirection = 'asc' | 'desc';

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<string[]>(['Salário', 'Supermercado', 'Renda', 'Lazer', 'Transporte', 'Serviços', 'Saúde']);
  const [insights, setInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'date',
    direction: 'desc'
  });

  const [newCategoryName, setNewCategoryName] = useState('');

  const [selectedIncomeFile, setSelectedIncomeFile] = useState<File | null>(null);
  const [selectedExpenseFile, setSelectedExpenseFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const incomeInputRef = useRef<HTMLInputElement>(null);
  const expenseInputRef = useRef<HTMLInputElement>(null);

  // Helper for currency formatting
  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
  };

  useEffect(() => {
    const hour = new Date().getHours();
    const isNight = hour >= 19 || hour < 7;
    setTheme(isNight ? 'dark' : 'light');
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const uniqueFromTransactions = Array.from(new Set(transactions.map(t => t.category)));
    setCategories(prev => {
      const combined = Array.from(new Set([...prev, ...uniqueFromTransactions]));
      return combined.sort();
    });
  }, [transactions]);

  const sortedAndFilteredTransactions = useMemo(() => {
    let result = [...transactions];
    if (selectedCategory) result = result.filter(t => t.category === selectedCategory);
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

  const stats: FinancialStats = useMemo(() => {
    const totalIncome = transactions.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);
    const expenseMap: Record<string, number> = {};
    transactions.filter(t => t.type === TransactionType.EXPENSE).forEach(t => {
      expenseMap[t.category] = (expenseMap[t.category] || 0) + t.amount;
    });
    const expenseByCategory = Object.entries(expenseMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((item, index) => ({ ...item, color: COLORS[index % COLORS.length] }));
    return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses, expenseByCategory };
  }, [transactions]);

  const handleExecuteImport = async () => {
    if (!selectedIncomeFile && !selectedExpenseFile) return;
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
      setSelectedIncomeFile(null); setSelectedExpenseFile(null);
      if (incomeInputRef.current) incomeInputRef.current.value = '';
      if (expenseInputRef.current) expenseInputRef.current.value = '';
      setInsights(null);
    } catch (err) { alert("Erro ao processar JSON."); }
    finally { setIsImporting(false); }
  };

  const readFileAsTransactions = (file: File, type: TransactionType): Promise<Transaction[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          const data = Array.isArray(json) ? json : [json];
          resolve(data.map((item: any) => ({
            id: Math.random().toString(36).substr(2, 9),
            type,
            category: item.category || 'Outros',
            amount: parseFloat(item.amount) || 0,
            date: item.date || new Date().toISOString().split('T')[0],
            description: item.description || ''
          })));
        } catch (err) { reject(err); }
      };
      reader.readAsText(file);
    });
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
    setTransactions(prev => editingTransaction ? prev.map(t => t.id === updated.id ? updated : t) : [updated, ...prev]);
    setIsModalOpen(false); setEditingTransaction(null);
  };

  const deleteTransaction = (id: string) => setTransactions(prev => prev.filter(t => t.id !== id));
  const handleEditClick = (t: Transaction) => { setEditingTransaction(t); setIsModalOpen(true); };
  const handleSort = (key: SortKey) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));

  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories(prev => [...prev, trimmed].sort());
      setNewCategoryName('');
    }
  };

  const handleDeleteCategory = (categoryToDelete: string) => {
    setCategories(prev => prev.filter(cat => cat !== categoryToDelete));
  };

  const generateAIInsights = async () => {
    if (transactions.length === 0) return;
    setLoadingInsights(true);
    setInsights(await getFinancialInsights(transactions));
    setLoadingInsights(false);
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortConfig.key !== column) return <ChevronDownIcon className="w-3 h-3 ml-1 opacity-20" />;
    return sortConfig.direction === 'asc' ? <ChevronUpIcon className="w-3 h-3 ml-1 text-indigo-500" /> : <ChevronDownIcon className="w-3 h-3 ml-1 text-indigo-500" />;
  };

  return (
    <div className="min-h-screen transition-all duration-500 selection:bg-indigo-100 dark:selection:bg-indigo-900/40">
      
      {/* Navigation */}
      <nav className="sticky top-0 z-40 glass-panel border-b border-slate-200/50 dark:border-slate-800/50 h-20 flex items-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-none">
              <WalletIcon className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white uppercase">
              FinTrack <span className="text-indigo-600 dark:text-indigo-400">AI</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400"
            >
              {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setIsCategoryModalOpen(true)}
              className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500 dark:text-slate-400"
            >
              <AdjustmentsHorizontalIcon className="w-5 h-5" />
            </button>
            <button 
              onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }}
              className="ml-2 flex items-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 dark:shadow-none active:scale-95"
            >
              <PlusIcon className="w-5 h-5 mr-1.5" />
              Lançamento
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20 space-y-8 animate-slide-up">
        
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800/80 p-7 rounded-3xl card-shadow card-hover transition-all border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
                <WalletIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saldo Atual</p>
                <p className={`text-2xl font-black ${stats.balance >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'}`}>
                  {formatCurrency(stats.balance)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800/80 p-7 rounded-3xl card-shadow card-hover transition-all border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl text-emerald-600 dark:text-emerald-400">
                <ArrowTrendingUpIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Entradas</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  {formatCurrency(stats.totalIncome)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800/80 p-7 rounded-3xl card-shadow card-hover transition-all border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-50 dark:bg-rose-900/30 rounded-2xl text-rose-600 dark:text-rose-400">
                <ArrowTrendingDownIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saídas</p>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  {formatCurrency(stats.totalExpenses)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Visualizations Column */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* Charts & Table Header */}
            <div className="bg-white dark:bg-slate-800/80 p-8 rounded-[2rem] card-shadow border border-slate-100 dark:border-slate-800 overflow-hidden relative">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  Análise de Despesas
                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Top 10 Categorias</span>
                </h2>
              </div>
              
              <div className="h-[320px] w-full">
                {stats.expenseByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={stats.expenseByCategory} 
                        cx="50%" cy="50%" 
                        innerRadius={80} outerRadius={120} 
                        paddingAngle={4} 
                        dataKey="value"
                        onClick={(data) => setSelectedCategory(selectedCategory === data.name ? null : data.name)}
                      >
                        {stats.expenseByCategory.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color} 
                            className="cursor-pointer focus:outline-none transition-all duration-300"
                            style={{ 
                              opacity: !selectedCategory || selectedCategory === entry.name ? 1 : 0.2,
                              filter: selectedCategory === entry.name ? 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.4))' : 'none'
                            }} 
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 text-sm">
                                <p className="font-black text-slate-900 dark:text-white mb-1">{payload[0].name}</p>
                                <p className="text-indigo-600 dark:text-indigo-400 font-bold">{formatCurrency(payload[0].value as number)}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
                    <DocumentArrowUpIcon className="w-12 h-12 opacity-20" />
                    <p className="font-medium">Nenhum dado de despesa para exibir.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Transactions List */}
            <div className="bg-white dark:bg-slate-800/80 rounded-[2rem] card-shadow border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Últimas Atividades</h2>
                  {selectedCategory && (
                    <button 
                      onClick={() => setSelectedCategory(null)}
                      className="flex items-center px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl border border-indigo-100 dark:border-indigo-800/50 hover:scale-105 transition-transform"
                    >
                      <FunnelIcon className="w-3 h-3 mr-1.5" />
                      Filtrado: {selectedCategory}
                      <XMarkIcon className="w-3.5 h-3.5 ml-2" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 text-[10px] uppercase font-black tracking-[0.15em]">
                    <tr>
                      <th className="px-8 py-5 cursor-pointer hover:text-indigo-500 transition-colors" onClick={() => handleSort('date')}>
                        Data <SortIcon column="date" />
                      </th>
                      <th className="px-8 py-5 cursor-pointer hover:text-indigo-500 transition-colors" onClick={() => handleSort('description')}>
                        Descrição <SortIcon column="description" />
                      </th>
                      <th className="px-8 py-5 cursor-pointer hover:text-indigo-500 transition-colors" onClick={() => handleSort('category')}>
                        Categoria <SortIcon column="category" />
                      </th>
                      <th className="px-8 py-5 cursor-pointer hover:text-indigo-500 transition-colors" onClick={() => handleSort('amount')}>
                        Valor <SortIcon column="amount" />
                      </th>
                      <th className="px-8 py-5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {sortedAndFilteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-8 py-20 text-center">
                          <p className="text-slate-400 font-medium">Nenhuma transação encontrada.</p>
                        </td>
                      </tr>
                    ) : (
                      sortedAndFilteredTransactions.map((t) => (
                        <tr key={t.id} className="group hover:bg-slate-50/80 dark:hover:bg-slate-700/20 transition-all">
                          <td className="px-8 py-5 text-sm font-medium text-slate-500 dark:text-slate-400">{t.date}</td>
                          <td className="px-8 py-5 text-sm font-bold text-slate-900 dark:text-white">{t.description}</td>
                          <td className="px-8 py-5">
                            <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[11px] font-bold uppercase tracking-tight">
                              {t.category}
                            </span>
                          </td>
                          <td className={`px-8 py-5 text-sm font-black ${t.type === TransactionType.INCOME ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {t.type === TransactionType.INCOME ? '+' : '-'} {formatCurrency(t.amount)}
                          </td>
                          <td className="px-8 py-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleEditClick(t)} className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors">
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button onClick={() => deleteTransaction(t.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors">
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* AI Insights Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-900 p-8 rounded-[2rem] text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden group">
              <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-10 group-hover:rotate-12 transition-transform duration-700">
                <SparklesIcon className="w-48 h-48" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <SparklesIcon className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-black">AI Insights</h3>
                </div>
                <p className="text-indigo-100 text-sm mb-8 leading-relaxed font-medium">
                  Análise preditiva e comportamental baseada em seus gastos reais.
                </p>
                <button 
                  onClick={generateAIInsights} 
                  disabled={loadingInsights || transactions.length === 0}
                  className="w-full bg-white hover:bg-indigo-50 text-indigo-700 font-extrabold py-3.5 px-6 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                >
                  {loadingInsights ? (
                    <svg className="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : 'Gerar Análise'}
                </button>
                
                {insights && (
                  <div className="mt-8 p-5 bg-black/20 rounded-2xl backdrop-blur-md border border-white/10 animate-fade-in text-sm italic leading-loose">
                    {insights}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions / Batch Import */}
            <div className="bg-white dark:bg-slate-800/80 p-8 rounded-[2rem] card-shadow border border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <ArrowUpTrayIcon className="w-5 h-5 text-indigo-500" />
                Importação Rápida
              </h3>
              
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Entradas (Receitas)</label>
                  <div 
                    onClick={() => incomeInputRef.current?.click()} 
                    className={`p-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all flex items-center gap-3 ${selectedIncomeFile ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-slate-100 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500'}`}
                  >
                    {selectedIncomeFile ? <CheckCircleIcon className="w-6 h-6 text-emerald-500" /> : <DocumentArrowUpIcon className="w-6 h-6 text-slate-300" />}
                    <span className="text-sm truncate font-bold text-slate-600 dark:text-slate-400">
                      {selectedIncomeFile ? selectedIncomeFile.name : 'Selecione o JSON...'}
                    </span>
                    <input type="file" ref={incomeInputRef} className="hidden" accept=".json" onChange={(e) => setSelectedIncomeFile(e.target.files?.[0] || null)} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Saídas (Despesas)</label>
                  <div 
                    onClick={() => expenseInputRef.current?.click()} 
                    className={`p-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all flex items-center gap-3 ${selectedExpenseFile ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-900/10' : 'border-slate-100 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500'}`}
                  >
                    {selectedExpenseFile ? <CheckCircleIcon className="w-6 h-6 text-rose-500" /> : <DocumentArrowUpIcon className="w-6 h-6 text-slate-300" />}
                    <span className="text-sm truncate font-bold text-slate-600 dark:text-slate-400">
                      {selectedExpenseFile ? selectedExpenseFile.name : 'Selecione o JSON...'}
                    </span>
                    <input type="file" ref={expenseInputRef} className="hidden" accept=".json" onChange={(e) => setSelectedExpenseFile(e.target.files?.[0] || null)} />
                  </div>
                </div>

                <button 
                  onClick={handleExecuteImport} 
                  disabled={isImporting || (!selectedIncomeFile && !selectedExpenseFile)}
                  className="w-full mt-4 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-indigo-600 text-white font-black py-4 rounded-2xl transition-all disabled:opacity-20 flex items-center justify-center gap-2 shadow-xl shadow-slate-100 dark:shadow-none"
                >
                  {isImporting ? <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : 'Processar Arquivos'}
                </button>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="bg-white dark:bg-slate-800/80 p-8 rounded-[2rem] card-shadow border border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-4">Dicas Rápidas</h3>
              <ul className="space-y-4 text-xs font-medium text-slate-500 dark:text-slate-400">
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1 flex-shrink-0" />
                  Clique no gráfico de pizza para filtrar as transações por categoria específica.
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1 flex-shrink-0" />
                  Clique nos títulos da tabela para ordenar por data, valor ou descrição.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Category Modal - Modernized */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md transition-all">
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300 border border-slate-100 dark:border-slate-800">
            <div className="px-10 py-8 flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">Gerenciar Categorias</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-colors"><XMarkIcon className="w-6 h-6 text-slate-400" /></button>
            </div>
            <div className="px-10 pb-10">
              <div className="mb-8 flex gap-3">
                <input 
                  type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nova categoria..."
                  className="flex-1 rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-700 text-slate-900 dark:text-white px-5 py-3.5 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                />
                <button onClick={handleAddCategory} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black transition-all active:scale-95 shadow-lg shadow-indigo-100 dark:shadow-none"><PlusIcon className="w-5 h-5" /></button>
              </div>
              <div className="max-h-72 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {categories.map((cat) => (
                  <div key={cat} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all group">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{cat}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleDeleteCategory(cat)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Form Modal - Modernized */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md transition-all">
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300 border border-slate-100 dark:border-slate-800">
            <div className="px-10 py-8 flex items-center justify-between border-b border-slate-50 dark:border-slate-800">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">{editingTransaction ? 'Editar' : 'Novo'} Registro</h3>
              <button onClick={() => { setIsModalOpen(false); setEditingTransaction(null); }} className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl transition-colors"><XMarkIcon className="w-6 h-6 text-slate-400" /></button>
            </div>
            <form onSubmit={saveTransaction} className="p-10 space-y-6">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Tipo</label>
                  <select name="type" defaultValue={editingTransaction?.type || TransactionType.EXPENSE} className="w-full rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-700 text-slate-900 dark:text-white px-4 py-3 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 font-bold">
                    <option value={TransactionType.EXPENSE}>Saída (Despesa)</option>
                    <option value={TransactionType.INCOME}>Entrada (Receita)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Valor (€)</label>
                  <input type="number" name="amount" step="0.01" required defaultValue={editingTransaction?.amount} className="w-full rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-700 text-slate-900 dark:text-white px-4 py-3 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 font-bold" />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Data</label>
                  <input type="date" name="date" required defaultValue={editingTransaction?.date || new Date().toISOString().split('T')[0]} className="w-full rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-700 text-slate-900 dark:text-white px-4 py-3 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 font-bold" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Categoria</label>
                <select 
                  name="category" required 
                  defaultValue={editingTransaction?.category || (categories.length > 0 ? categories[0] : '')}
                  className="w-full rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-700 text-slate-900 dark:text-white px-4 py-3 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 font-bold"
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Descrição</label>
                <textarea name="description" rows={2} defaultValue={editingTransaction?.description} className="w-full rounded-2xl border-none ring-1 ring-slate-200 dark:ring-slate-700 text-slate-900 dark:text-white px-4 py-3 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 font-bold" />
              </div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingTransaction(null); }} className="flex-1 px-6 py-4 border border-slate-200 dark:border-slate-700 text-slate-400 font-black rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
