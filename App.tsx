
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  Tooltip
} from 'recharts';
import { 
  PlusIcon, 
  TrashIcon, 
  PencilIcon,
  SparklesIcon,
  XMarkIcon,
  WalletIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
  DocumentArrowUpIcon,
  ArrowUpTrayIcon,
  CircleStackIcon,
  FunnelIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { Transaction, TransactionType, FinancialStats } from './types';
import { getFinancialInsights } from './services/geminiService';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#2dd4bf', '#fb7185', '#a855f7'];

const electronAPI = (window as any).electronAPI;

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [categories, setCategories] = useState<string[]>(['Salário', 'Supermercado', 'Renda', 'Lazer', 'Transporte', 'Serviços', 'Saúde', 'Outros']);
  const [insights, setInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isDataQualityModalOpen, setIsDataQualityModalOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');

  const [filters, setFilters] = useState({
    category: 'all',
    startDate: '',
    endDate: '',
    type: 'all' as TransactionType | 'all'
  });

  const [incomeFile, setIncomeFile] = useState<File | null>(null);
  const [expenseFile, setExpenseFile] = useState<File | null>(null);
  const incomeInputRef = useRef<HTMLInputElement>(null);
  const expenseInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      const savedCats = localStorage.getItem('fintrack_categories');
      if (savedCats) setCategories(JSON.parse(savedCats));

      if (electronAPI) {
        try {
          const incomes = await electronAPI.readJson('incomes.json');
          const expenses = await electronAPI.readJson('expenses.json');
          const mappedIncomes = (Array.isArray(incomes) ? incomes : []).map((t: any) => ({ ...t, type: TransactionType.INCOME, id: t.id || Math.random().toString(36).substr(2, 9) }));
          const mappedExpenses = (Array.isArray(expenses) ? expenses : []).map((t: any) => ({ ...t, type: TransactionType.EXPENSE, id: t.id || Math.random().toString(36).substr(2, 9) }));
          setTransactions([...mappedIncomes, ...mappedExpenses]);
        } catch (e) { console.error("Erro ao carregar ficheiros:", e); }
      } else {
        const local = localStorage.getItem('fintrack_transactions');
        if (local) setTransactions(JSON.parse(local));
      }
      setIsLoaded(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('fintrack_transactions', JSON.stringify(transactions));
  }, [transactions, isLoaded]);

  const handleManualSave = async () => {
    if (!electronAPI) {
      alert("A gravação em ficheiro só está disponível na versão desktop.");
      return;
    }

    setSaveStatus('saving');
    const incomes = transactions.filter(t => t.type === TransactionType.INCOME);
    const expenses = transactions.filter(t => t.type === TransactionType.EXPENSE);
    
    try {
      await electronAPI.writeJson('incomes.json', incomes);
      await electronAPI.writeJson('expenses.json', expenses);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error("Erro ao gravar:", error);
      setSaveStatus('idle');
      alert("Erro ao gravar os dados nos ficheiros.");
    }
  };

  const stats: FinancialStats = useMemo(() => {
    const totalIncome = transactions.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
    const expenseMap: Record<string, number> = {};
    transactions.filter(t => t.type === TransactionType.EXPENSE).forEach(t => {
      expenseMap[t.category] = (expenseMap[t.category] || 0) + t.amount;
    });
    const expenseByCategory = Object.entries(expenseMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((item, index) => ({ ...item, color: COLORS[index % COLORS.length] }));

    const categoryBalancesMap: Record<string, number> = {};
    transactions.forEach(t => {
      const amount = t.type === TransactionType.INCOME ? t.amount : -t.amount;
      categoryBalancesMap[t.category] = (categoryBalancesMap[t.category] || 0) + amount;
    });

    const categoryBalances = Object.entries(categoryBalancesMap)
      .map(([name, balance]) => ({ name, balance }))
      .sort((a, b) => b.balance - a.balance);

    return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses, expenseByCategory, categoryBalances };
  }, [transactions]);

  const duplicateTransactions = useMemo(() => {
    const seen = new Map<string, string[]>();
    const duplicates: Transaction[] = [];
    
    transactions.forEach(t => {
      const key = `${t.date}-${t.amount}-${t.category}-${t.description}`;
      if (seen.has(key)) {
        duplicates.push(t);
        seen.get(key)?.push(t.id);
      } else {
        seen.set(key, [t.id]);
      }
    });
    return duplicates;
  }, [transactions]);

  const duplicateCategories = useMemo(() => {
    const counts = new Map<string, number>();
    categories.forEach(c => {
      const normalized = c.toLowerCase().trim();
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    });
    return Array.from(counts.entries())
      .filter(([_, count]) => count > 1)
      .map(([name]) => categories.find(c => c.toLowerCase().trim() === name) || name);
  }, [categories]);

  const sortedTransactions = useMemo(() => {
    let filtered = [...transactions];

    if (filters.category !== 'all') {
      filtered = filtered.filter(t => t.category === filters.category);
    }
    if (filters.type !== 'all') {
      filtered = filtered.filter(t => t.type === filters.type);
    }
    if (filters.startDate) {
      filtered = filtered.filter(t => t.date >= filters.startDate);
    }
    if (filters.endDate) {
      filtered = filtered.filter(t => t.date <= filters.endDate);
    }

    return filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [transactions, filters]);

  const exportData = () => {
    const dataStr = JSON.stringify(transactions, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `fintrack_backup_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const processImportFiles = async () => {
    const newTransactions: Transaction[] = [];
    const readFile = (file: File, type: TransactionType): Promise<void> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const json = JSON.parse(e.target?.result as string);
            const items = (Array.isArray(json) ? json : [json]).map(t => ({
              id: Math.random().toString(36).substr(2, 9),
              type: type,
              amount: Math.abs(t.amount || 0),
              category: t.category || (type === TransactionType.INCOME ? 'Salário' : 'Outros'),
              date: t.date || new Date().toISOString().split('T')[0],
              description: t.description || ''
            }));
            newTransactions.push(...items);
          } catch (err) { console.error("Erro no ficheiro", type, err); }
          resolve();
        };
        reader.readAsText(file);
      });
    };
    if (incomeFile) await readFile(incomeFile, TransactionType.INCOME);
    if (expenseFile) await readFile(expenseFile, TransactionType.EXPENSE);
    if (newTransactions.length > 0) {
      setTransactions(newTransactions);
      setIsImportModalOpen(false);
      setIncomeFile(null);
      setExpenseFile(null);
    }
  };

  const formatCurrency = (v: number) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans">
      <header className="px-4 md:px-12 py-6 md:py-10 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-indigo-600 rounded-xl md:rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-600/40 transform rotate-3">
            <WalletIcon className="w-6 h-6 md:w-7 md:h-7 text-white" />
          </div>
          <h1 className="text-xl md:text-2xl font-[900] tracking-tighter text-white uppercase">
            FINTRACK <span className="text-indigo-500">AI</span>
          </h1>
        </div>
        <div className="flex items-center gap-3 md:gap-4 w-full sm:w-auto">
          <button 
            onClick={handleManualSave}
            title="Gravar nos Ficheiros JSON"
            className={`flex-1 sm:flex-none p-3 transition-all rounded-xl ${
              saveStatus === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800/40 text-slate-400 hover:text-white'
            }`}
          >
            <CircleStackIcon className={`mx-auto w-6 h-6 ${saveStatus === 'saving' ? 'animate-pulse' : ''}`} />
          </button>
          <button 
            onClick={exportData}
            title="Exportar Backup JSON"
            className="flex-1 sm:flex-none p-3 text-slate-400 hover:text-white transition-all bg-slate-800/40 rounded-xl"
          >
            <ArrowUpTrayIcon className="mx-auto w-6 h-6" />
          </button>
          <button 
            onClick={() => setIsCategoryModalOpen(true)} 
            className="flex-1 sm:flex-none p-3 text-slate-400 hover:text-white transition-all bg-slate-800/40 rounded-xl"
          >
            <AdjustmentsHorizontalIcon className="mx-auto w-6 h-6" />
          </button>
          <button 
            onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }} 
            className="flex-[3] sm:flex-none bg-indigo-600 px-6 md:px-8 py-3 md:py-3.5 rounded-xl md:rounded-[1.25rem] text-white font-black text-xs md:text-sm tracking-widest uppercase flex items-center justify-center gap-3 hover:bg-indigo-50 transition-all shadow-xl shadow-indigo-600/20"
          >
            <PlusIcon className="w-5 h-5 stroke-[4px]" />
            <span className="hidden xs:inline">Novo</span> Lançamento
          </button>
        </div>
      </header>

      <main className="px-4 md:px-12 pb-20 max-w-[1500px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-12">
          <div className="bg-[#1e293b] p-4 md:p-6 lg:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-800 shadow-xl flex items-center gap-4 md:gap-6 overflow-hidden">
            <div className="w-10 md:w-14 lg:w-16 h-14 md:h-18 lg:h-20 bg-indigo-500/10 rounded-full flex items-center justify-center border border-indigo-500/20 flex-shrink-0">
              <WalletIcon className="w-6 md:w-8 lg:w-9 h-6 md:h-8 lg:h-9 text-indigo-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-0.5 truncate">Saldo Atual</p>
              <h2 className="text-xl md:text-2xl lg:text-3xl font-black text-white truncate break-all leading-tight">{formatCurrency(stats.balance)}</h2>
            </div>
          </div>
          <div className="bg-[#1e293b] p-4 md:p-6 lg:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-800 shadow-xl flex items-center gap-4 md:gap-6 overflow-hidden">
            <div className="w-10 md:w-14 lg:w-16 h-14 md:h-18 lg:h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 flex-shrink-0">
              <ArrowTrendingUpIcon className="w-6 md:w-8 lg:w-9 h-6 md:h-8 lg:h-9 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-0.5 truncate">Entradas</p>
              <h2 className="text-xl md:text-2xl lg:text-3xl font-black text-white truncate break-all leading-tight">{formatCurrency(stats.totalIncome)}</h2>
            </div>
          </div>
          <div className="bg-[#1e293b] p-4 md:p-6 lg:p-8 rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-800 shadow-xl flex items-center gap-4 md:gap-6 overflow-hidden">
            <div className="w-10 md:w-14 lg:w-16 h-14 md:h-18 lg:h-20 bg-rose-500/10 rounded-full flex items-center justify-center border border-rose-500/20 flex-shrink-0">
              <ArrowTrendingDownIcon className="w-6 md:w-8 lg:w-9 h-6 md:h-8 lg:h-9 text-rose-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-0.5 truncate">Saídas</p>
              <h2 className="text-xl md:text-2xl lg:text-3xl font-black text-white truncate break-all leading-tight">{formatCurrency(stats.totalExpenses)}</h2>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 md:gap-10">
          <div className="col-span-12 lg:col-span-8 space-y-8 md:space-y-12">
            <div className="bg-[#1e293b] p-6 md:p-12 rounded-[2rem] md:rounded-[3rem] border border-slate-800 shadow-2xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
                <h3 className="text-xl md:text-2xl font-black text-white">Análise de Despesas</h3>
                <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-400 px-4 py-1.5 rounded-full uppercase">Top 10 Categorias</span>
              </div>
              <div className="h-[280px] md:h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.expenseByCategory} cx="50%" cy="50%" innerRadius={window.innerWidth < 768 ? 70 : 95} outerRadius={window.innerWidth < 768 ? 100 : 135} paddingAngle={5} dataKey="value" stroke="none">
                      {stats.expenseByCategory.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', backgroundColor: '#0f172a', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-[#1e293b] p-6 md:p-12 rounded-[2rem] md:rounded-[3rem] border border-slate-800 shadow-2xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
                <h3 className="text-xl md:text-2xl font-black text-white">Saldos por Categoria</h3>
                <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-400 px-4 py-1.5 rounded-full uppercase">Resumo por Categoria</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {stats.categoryBalances.length === 0 ? (
                  <div className="col-span-full text-center py-10 text-slate-500 font-bold uppercase tracking-widest text-xs">
                    Sem dados para exibir.
                  </div>
                ) : (
                  stats.categoryBalances.map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-4 md:p-5 bg-slate-800/40 rounded-2xl border border-slate-700/50 hover:border-slate-600 transition-all">
                      <span className="text-xs md:text-sm font-bold text-slate-300 uppercase tracking-wider truncate mr-2">{item.name}</span>
                      <span className={`text-sm md:text-base font-black whitespace-nowrap ${item.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {item.balance >= 0 ? '+' : ''}{item.balance.toFixed(2)}€
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between px-4">
                <h3 className="text-[10px] md:text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Histórico Completo</h3>
                <div className="flex items-center gap-4">
                  <button onClick={() => setIsDataQualityModalOpen(true)} className="text-[10px] md:text-xs font-black text-slate-500 hover:text-white flex items-center gap-2 uppercase tracking-widest transition-colors">
                    <ShieldCheckIcon className="w-4 h-4" /> Qualidade
                  </button>
                  <button onClick={() => setIsFilterModalOpen(true)} className={`text-[10px] md:text-xs font-black flex items-center gap-2 uppercase tracking-widest transition-colors ${filters.category !== 'all' || filters.startDate || filters.endDate || filters.type !== 'all' ? 'text-indigo-400' : 'text-slate-500 hover:text-white'}`}>
                    <FunnelIcon className="w-4 h-4" /> Filtrar
                  </button>
                  <button onClick={() => setIsImportModalOpen(true)} className="text-[10px] md:text-xs font-black text-indigo-400 hover:text-white flex items-center gap-2 uppercase tracking-widest">
                    <ArrowDownTrayIcon className="w-4 h-4" /> Importar
                  </button>
                </div>
              </div>
              <div className="grid gap-4 md:gap-5">
                {sortedTransactions.length === 0 ? (
                  <div className="bg-[#1e293b] p-10 rounded-[2rem] border border-dashed border-slate-800 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">
                    Nenhuma transação registada.
                  </div>
                ) : (
                  sortedTransactions.map((t) => (
                    <div key={t.id} className="group bg-[#1e293b] p-5 md:p-7 rounded-[1.5rem] md:rounded-[2rem] border border-slate-800/40 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 hover:border-slate-600 transition-all shadow-sm">
                      <div className="flex items-center gap-4 md:gap-6">
                        <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center flex-shrink-0 ${t.type === TransactionType.INCOME ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          {t.type === TransactionType.INCOME ? <ArrowTrendingUpIcon className="w-6 h-6 md:w-8 md:h-8"/> : <ArrowTrendingDownIcon className="w-6 h-6 md:w-8 md:h-8"/>}
                        </div>
                        <div>
                          <p className="text-base md:text-lg font-black text-white uppercase truncate max-w-[150px] md:max-w-none">{t.category}</p>
                          <p className="text-[10px] md:text-xs font-bold text-slate-500 truncate">{t.description || 'S/ desc'} • {t.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-6 md:gap-10">
                        <p className={`text-lg md:text-xl font-black ${t.type === TransactionType.INCOME ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.type === TransactionType.INCOME ? '+' : '-'} {t.amount.toFixed(2)}€
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => { setEditingTransaction(t); setIsModalOpen(true); }} className="p-2 text-slate-500 hover:text-indigo-400 transition-colors"><PencilIcon className="w-4 h-4"/></button>
                          <button onClick={() => setTransactions(p => p.filter(x => x.id !== t.id))} className="p-2 text-slate-600 hover:text-rose-500 transition-colors"><TrashIcon className="w-4 h-4"/></button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 md:p-12 rounded-[2rem] md:rounded-[3.5rem] text-white shadow-2xl lg:sticky lg:top-12 flex flex-col min-h-[400px]">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
                  <SparklesIcon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl md:text-3xl font-black tracking-tighter uppercase leading-none">AI Insights</h3>
              </div>
              <p className="text-indigo-100 text-sm md:text-lg font-medium leading-snug mb-10 md:mb-12 opacity-90 italic">Análise baseada nos seus dados reais.</p>
              <button disabled={loadingInsights} onClick={async () => { setLoadingInsights(true); const res = await getFinancialInsights(transactions); setInsights(res); setLoadingInsights(false); }} className="w-full bg-white py-4 md:py-5 rounded-2xl md:rounded-[1.75rem] text-indigo-700 font-black text-xs md:text-sm uppercase tracking-widest hover:bg-indigo-50 transition-all active:scale-95">
                {loadingInsights ? 'A analisar...' : 'Gerar Análise'}
              </button>
              {insights && (
                <div className="flex-1 bg-indigo-950/40 p-6 md:p-8 rounded-[1.5rem] md:rounded-[2rem] border border-white/5 text-xs md:text-sm leading-loose text-indigo-50 italic overflow-y-auto mt-8">
                  <div className="whitespace-pre-wrap">{insights}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modal Importação Rápida */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-6 animate-fade-in">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl" onClick={() => setIsImportModalOpen(false)}></div>
          <div className="relative bg-[#1e293b] w-full max-w-sm rounded-[2rem] md:rounded-[2.5rem] p-8 md:p-10 shadow-2xl border border-slate-800">
            <div className="flex items-center gap-3 mb-8 md:mb-10">
              <ArrowDownTrayIcon className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-bold text-white tracking-tight">Importação Rápida</h3>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Entradas</label>
                <div onClick={() => incomeInputRef.current?.click()} className="border-2 border-dashed border-slate-700/50 rounded-[1.25rem] p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-800/40 transition-all">
                  <DocumentArrowUpIcon className="w-5 h-5 text-slate-400" />
                  <span className="text-[10px] md:text-xs font-semibold text-slate-400 truncate">{incomeFile ? incomeFile.name : 'Selecione o JSON...'}</span>
                </div>
                <input type="file" ref={incomeInputRef} onChange={(e) => setIncomeFile(e.target.files?.[0] || null)} accept=".json" className="hidden" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Saídas</label>
                <div onClick={() => expenseInputRef.current?.click()} className="border-2 border-dashed border-slate-700/50 rounded-[1.25rem] p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-800/40 transition-all">
                  <DocumentArrowUpIcon className="w-5 h-5 text-slate-400" />
                  <span className="text-[10px] md:text-xs font-semibold text-slate-400 truncate">{expenseFile ? expenseFile.name : 'Selecione o JSON...'}</span>
                </div>
                <input type="file" ref={expenseInputRef} onChange={(e) => setExpenseFile(e.target.files?.[0] || null)} accept=".json" className="hidden" />
              </div>
              <button onClick={processImportFiles} disabled={!incomeFile && !expenseFile} className="w-full bg-[#243147] py-4 md:py-5 rounded-[1.25rem] text-[#475569] font-black text-[10px] md:text-xs uppercase tracking-[0.1em] transition-all mt-4 hover:bg-indigo-600 hover:text-white disabled:opacity-50">
                Processar Arquivos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lançamento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 animate-fade-in">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-[#1e293b] w-full max-w-xl rounded-[2.5rem] md:rounded-[3.5rem] p-8 md:p-12 shadow-2xl border border-slate-700 overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl md:text-3xl font-black text-white uppercase mb-8 md:mb-10">{editingTransaction ? 'Editar' : 'Registo'}</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const val = {
                id: editingTransaction?.id || Math.random().toString(36).substr(2, 9),
                type: fd.get('type') as TransactionType,
                amount: parseFloat(fd.get('amount') as string),
                category: fd.get('category') as string,
                date: fd.get('date') as string,
                description: fd.get('description') as string,
              };
              setTransactions(p => editingTransaction ? p.map(x => x.id === val.id ? val : x) : [val, ...p]);
              setIsModalOpen(false);
            }} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <select name="type" defaultValue={editingTransaction?.type || TransactionType.EXPENSE} className="bg-slate-800/40 rounded-2xl p-4 md:p-5 text-white border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value={TransactionType.EXPENSE}>Saída</option>
                  <option value={TransactionType.INCOME}>Entrada</option>
                </select>
                <input type="number" step="0.01" name="amount" required placeholder="0.00 €" defaultValue={editingTransaction?.amount} className="bg-slate-800/40 rounded-2xl p-4 md:p-5 text-white border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <input type="date" name="date" required defaultValue={editingTransaction?.date || new Date().toISOString().split('T')[0]} className="w-full bg-slate-800/40 rounded-2xl p-4 md:p-5 text-white border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" />
              <select name="category" defaultValue={editingTransaction?.category} className="w-full bg-slate-800/40 rounded-2xl p-4 md:p-5 text-white border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <textarea name="description" placeholder="Detalhes..." defaultValue={editingTransaction?.description} className="w-full bg-slate-800/40 rounded-2xl p-5 md:p-6 text-white border border-slate-700 min-h-[100px] resize-none outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="submit" className="w-full bg-indigo-600 py-4 md:py-6 rounded-2xl md:rounded-3xl text-white font-black uppercase tracking-widest shadow-2xl hover:bg-indigo-500 transition-all">Confirmar</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Qualidade de Dados */}
      {isDataQualityModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 animate-fade-in">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl" onClick={() => setIsDataQualityModalOpen(false)}></div>
          <div className="relative bg-[#1e293b] w-full max-w-2xl rounded-[2.5rem] md:rounded-[3.5rem] p-8 md:p-12 shadow-2xl border border-slate-700 overflow-y-auto max-h-[90vh]">
            <h3 className="text-2xl md:text-3xl font-black text-white uppercase mb-8 md:mb-10">Qualidade de Dados</h3>
            
            <div className="space-y-10">
              {/* Duplicados: Transações */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Movimentos Duplicados ({duplicateTransactions.length})</h4>
                  {duplicateTransactions.length > 0 && (
                    <button 
                      onClick={() => setTransactions(p => p.filter(t => !duplicateTransactions.find(d => d.id === t.id)))}
                      className="text-[10px] font-black text-rose-400 uppercase tracking-widest hover:text-rose-300"
                    >
                      Remover Todos
                    </button>
                  )}
                </div>
                {duplicateTransactions.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Nenhum movimento duplicado encontrado.</p>
                ) : (
                  <div className="grid gap-3">
                    {duplicateTransactions.slice(0, 5).map(t => (
                      <div key={t.id} className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-white">{t.description || 'Sem descrição'}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-black">{t.date} • {t.category} • {formatCurrency(t.amount)}</p>
                        </div>
                        <button onClick={() => setTransactions(p => p.filter(x => x.id !== t.id))} className="text-rose-400 hover:text-rose-300">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {duplicateTransactions.length > 5 && <p className="text-[10px] text-slate-500 text-center uppercase font-black">E mais {duplicateTransactions.length - 5} duplicados...</p>}
                  </div>
                )}
              </section>

              {/* Duplicados: Categorias */}
              <section className="space-y-4">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Categorias Duplicadas ({duplicateCategories.length})</h4>
                {duplicateCategories.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Nenhuma categoria duplicada encontrada.</p>
                ) : (
                  <div className="grid gap-3">
                    {duplicateCategories.map(c => (
                      <div key={c} className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700 flex items-center justify-between">
                        <p className="text-sm font-bold text-white">{c}</p>
                        <button 
                          onClick={() => {
                            const normalized = c.toLowerCase().trim();
                            setCategories(p => {
                              const filtered = p.filter(cat => cat.toLowerCase().trim() !== normalized);
                              return [...filtered, c]; // Mantém apenas uma instância
                            });
                          }} 
                          className="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:text-indigo-300"
                        >
                          Fundir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <button onClick={() => setIsDataQualityModalOpen(false)} className="w-full bg-indigo-600 py-4 md:py-6 rounded-2xl md:rounded-3xl text-white font-black uppercase tracking-widest shadow-2xl hover:bg-indigo-500 transition-all mt-10">Fechar</button>
          </div>
        </div>
      )}

      {/* Modal Filtros */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 animate-fade-in">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl" onClick={() => setIsFilterModalOpen(false)}></div>
          <div className="relative bg-[#1e293b] w-full max-w-xl rounded-[2.5rem] md:rounded-[3.5rem] p-8 md:p-12 shadow-2xl border border-slate-700 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-8 md:mb-10">
              <h3 className="text-2xl md:text-3xl font-black text-white uppercase">Filtrar Movimentos</h3>
              <button onClick={() => {
                setFilters({ category: 'all', startDate: '', endDate: '', type: 'all' });
                setIsFilterModalOpen(false);
              }} className="text-[10px] font-black text-rose-400 uppercase tracking-widest hover:text-rose-300 transition-colors">Limpar Filtros</button>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tipo</label>
                  <select 
                    value={filters.type} 
                    onChange={(e) => setFilters(f => ({ ...f, type: e.target.value as any }))}
                    className="w-full bg-slate-800/40 rounded-2xl p-4 md:p-5 text-white border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">Todos os Tipos</option>
                    <option value={TransactionType.INCOME}>Entradas</option>
                    <option value={TransactionType.EXPENSE}>Saídas</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Categoria</label>
                  <select 
                    value={filters.category} 
                    onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-slate-800/40 rounded-2xl p-4 md:p-5 text-white border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">Todas as Categorias</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data Inicial</label>
                  <input 
                    type="date" 
                    value={filters.startDate} 
                    onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full bg-slate-800/40 rounded-2xl p-4 md:p-5 text-white border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data Final</label>
                  <input 
                    type="date" 
                    value={filters.endDate} 
                    onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full bg-slate-800/40 rounded-2xl p-4 md:p-5 text-white border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" 
                  />
                </div>
              </div>

              <button onClick={() => setIsFilterModalOpen(false)} className="w-full bg-indigo-600 py-4 md:py-6 rounded-2xl md:rounded-3xl text-white font-black uppercase tracking-widest shadow-2xl hover:bg-indigo-500 transition-all mt-4">Aplicar Filtros</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
