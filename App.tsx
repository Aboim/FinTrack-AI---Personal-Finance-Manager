
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
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { Transaction, TransactionType, FinancialStats } from './types';
import { getFinancialInsights } from './services/geminiService';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#2dd4bf', '#fb7185', '#a855f7'];

// Verificação de ambiente (Electron vs Web/Mobile)
const electronAPI = (window as any).electronAPI;

type SortKey = keyof Transaction;
type SortDirection = 'asc' | 'desc';

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [categories, setCategories] = useState<string[]>(['Salário', 'Supermercado', 'Renda', 'Lazer', 'Transporte', 'Serviços', 'Saúde', 'Outros']);
  const [insights, setInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportChoiceOpen, setIsImportChoiceOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'date', direction: 'desc' });
  const [pendingImportType, setPendingImportType] = useState<TransactionType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregamento de Dados
  useEffect(() => {
    const init = async () => {
      const savedCats = localStorage.getItem('fintrack_categories');
      if (savedCats) setCategories(JSON.parse(savedCats));

      if (electronAPI) {
        try {
          const incomes = await electronAPI.readJson('incomes.json');
          const expenses = await electronAPI.readJson('expenses.json');
          
          const mappedIncomes = (Array.isArray(incomes) ? incomes : []).map((t: any) => ({ 
            ...t, 
            type: TransactionType.INCOME,
            id: t.id || Math.random().toString(36).substr(2, 9)
          }));
          
          const mappedExpenses = (Array.isArray(expenses) ? expenses : []).map((t: any) => ({ 
            ...t, 
            type: TransactionType.EXPENSE,
            id: t.id || Math.random().toString(36).substr(2, 9)
          }));

          setTransactions([...mappedIncomes, ...mappedExpenses]);
        } catch (e) {
          console.error("Erro Electron FS:", e);
        }
      } else {
        // Fallback para Mobile/Web LocalStorage
        const local = localStorage.getItem('fintrack_transactions');
        if (local) setTransactions(JSON.parse(local));
      }
      setIsLoaded(true);
    };
    init();
  }, []);

  // Persistência de Dados
  useEffect(() => {
    if (!isLoaded) return;
    
    // Guardar sempre no LocalStorage (Funciona em todos os ambientes)
    localStorage.setItem('fintrack_transactions', JSON.stringify(transactions));

    // Se estiver no Electron, guardar também nos ficheiros JSON físicos
    if (electronAPI) {
      const incomes = transactions.filter(t => t.type === TransactionType.INCOME);
      const expenses = transactions.filter(t => t.type === TransactionType.EXPENSE);
      electronAPI.writeJson('incomes.json', incomes);
      electronAPI.writeJson('expenses.json', expenses);
    }
  }, [transactions, isLoaded]);

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
    return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses, expenseByCategory };
  }, [transactions]);

  const processImportedData = (data: any[], type: TransactionType) => {
    if (!Array.isArray(data)) return;
    const newItems = data.map(t => ({
      ...t,
      id: Math.random().toString(36).substr(2, 9),
      type: type,
      amount: Math.abs(t.amount),
      category: t.category || 'Outros',
      date: t.date || new Date().toISOString().split('T')[0],
      description: t.description || ''
    }));
    setTransactions(prev => [...newItems, ...prev]);
    setIsImportChoiceOpen(false);
    alert(`${newItems.length} movimentos importados!`);
  };

  const handleStartImport = (type: TransactionType) => {
    setPendingImportType(type);
    if (electronAPI) {
      electronAPI.selectFile().then((data: any) => {
        if (data) processImportedData(data, type);
      });
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingImportType) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        processImportedData(json, pendingImportType);
      } catch (err) {
        alert("Erro no ficheiro JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const aV = a[sortConfig.key];
      const bV = b[sortConfig.key];
      if (aV < bV) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aV > bV) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [transactions, sortConfig]);

  const formatCurrency = (v: number) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">FinTrack a iniciar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen dark bg-slate-900 text-slate-200 selection:bg-indigo-500/30">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />

      <header className="sticky top-0 z-30 bg-slate-800/80 backdrop-blur-lg border-b border-slate-700 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <WalletIcon className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-black text-white uppercase tracking-tighter">FinTrack</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsImportChoiceOpen(true)} title="Importar JSON" className="p-2 text-indigo-400 hover:bg-slate-700 rounded-xl transition-colors">
            <ArrowDownTrayIcon className="w-6 h-6" />
          </button>
          <button onClick={() => setIsCategoryModalOpen(true)} className="p-2 text-slate-400 hover:text-white transition-colors">
            <AdjustmentsHorizontalIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="pb-32 px-4 pt-6 space-y-6 max-w-lg mx-auto">
        <div className="space-y-3 animate-slide-up">
          <div className="bg-indigo-600 p-6 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-900/40 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-colors"></div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 relative z-10">Saldo Disponível</p>
            <h2 className="text-4xl font-black mt-1 tracking-tighter relative z-10">{formatCurrency(stats.balance)}</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-emerald-600 p-5 rounded-[2rem] text-white shadow-lg active:scale-95 transition-transform">
              <div className="flex items-center gap-1 opacity-80 mb-1">
                <ArrowTrendingUpIcon className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase">Entradas</span>
              </div>
              <p className="text-xl font-black tracking-tight">{formatCurrency(stats.totalIncome)}</p>
            </div>
            <div className="bg-rose-600 p-5 rounded-[2rem] text-white shadow-lg active:scale-95 transition-transform">
              <div className="flex items-center gap-1 opacity-80 mb-1">
                <ArrowTrendingDownIcon className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase">Saídas</span>
              </div>
              <p className="text-xl font-black tracking-tight">{formatCurrency(stats.totalExpenses)}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-[2rem] border border-slate-700 shadow-sm animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h3 className="text-xs font-black mb-4 text-white uppercase tracking-widest text-slate-400">Distribuição</h3>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stats.expenseByCategory} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={6} dataKey="value" stroke="none">
                  {stats.expenseByCategory.map((entry, index) => <Cell key={`c-${index}`} fill={entry.color} />)}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: '#1e293b', color: '#fff' }} 
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white overflow-hidden relative border border-slate-800 shadow-inner animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-2 mb-3 relative z-10">
            <SparklesIcon className="w-5 h-5 text-indigo-400" />
            <span className="text-xs font-black uppercase tracking-widest text-indigo-300">Sugestões IA</span>
          </div>
          <div className="text-[12px] leading-relaxed text-slate-300 italic relative z-10">
            {insights ? (
              <div className="space-y-2 whitespace-pre-wrap">{insights}</div>
            ) : (
              <button 
                onClick={async () => { setLoadingInsights(true); setInsights(await getFinancialInsights(transactions)); setLoadingInsights(false); }} 
                className="w-full py-4 bg-indigo-600/10 hover:bg-indigo-600/20 rounded-2xl font-black text-indigo-400 transition-all border border-indigo-600/20 uppercase text-[10px] tracking-widest"
              >
                {loadingInsights ? 'A processar...' : 'Gerar Relatório Inteligente'}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-white uppercase tracking-widest text-slate-400">Atividade</h3>
            <button onClick={() => setSortConfig(p => ({ key: 'date', direction: p.direction === 'asc' ? 'desc' : 'asc' }))} className="text-[10px] font-black text-indigo-400 uppercase flex items-center gap-1 bg-slate-800 py-1 px-3 rounded-full border border-slate-700">
              Data {sortConfig.direction === 'asc' ? '↑' : '↓'}
            </button>
          </div>
          
          <div className="space-y-3">
            {sortedTransactions.length === 0 ? (
              <div className="text-center py-16 opacity-10 flex flex-col items-center gap-4">
                <WalletIcon className="w-12 h-12" />
                <p className="text-xs font-black uppercase tracking-widest">Sem movimentos</p>
              </div>
            ) : (
              sortedTransactions.map(t => (
                <div key={t.id} className="bg-slate-800 p-4 rounded-3xl border border-slate-700 flex items-center justify-between active:scale-[0.98] transition-transform shadow-sm group">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${t.type === TransactionType.INCOME ? 'bg-emerald-900/30 text-emerald-400' : 'bg-rose-900/30 text-rose-400'}`}>
                      {t.type === TransactionType.INCOME ? <ArrowTrendingUpIcon className="w-6 h-6"/> : <ArrowTrendingDownIcon className="w-6 h-6"/>}
                    </div>
                    <div>
                      <p className="text-sm font-black text-white uppercase tracking-tight">{t.category}</p>
                      <p className="text-[10px] font-bold text-slate-500 leading-tight">
                        {t.description ? `${t.description} • ` : ''}{t.date}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <p className={`text-sm font-black ${t.type === TransactionType.INCOME ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.type === TransactionType.INCOME ? '+' : '-'} {t.amount.toFixed(2)}€
                    </p>
                    <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingTransaction(t); setIsModalOpen(true); }} className="text-slate-500 hover:text-indigo-400"><PencilIcon className="w-4 h-4"/></button>
                      <button onClick={() => setTransactions(p => p.filter(x => x.id !== t.id))} className="text-slate-500 hover:text-rose-400"><TrashIcon className="w-4 h-4"/></button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Botão Flutuante (FAB) */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
        <button onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }} className="w-16 h-16 bg-indigo-600 rounded-full shadow-2xl shadow-indigo-600/40 flex items-center justify-center text-white active:scale-90 transition-transform">
          <PlusIcon className="w-8 h-8" strokeWidth={3} />
        </button>
      </div>

      {/* Modal de Importação */}
      {isImportChoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-6">
          <div className="bg-slate-800 w-full max-w-xs rounded-[3rem] p-8 animate-slide-up shadow-2xl border border-slate-700">
            <h3 className="text-center text-xs font-black text-white uppercase tracking-widest mb-8 opacity-50">Escolha o Tipo</h3>
            <div className="space-y-4">
              <button onClick={() => handleStartImport(TransactionType.INCOME)} className="w-full bg-emerald-600 p-5 rounded-2xl text-white font-black flex items-center justify-center gap-3 active:scale-95 transition-transform shadow-lg shadow-emerald-900/20">
                <ArrowTrendingUpIcon className="w-5 h-5" />
                Receitas
              </button>
              <button onClick={() => handleStartImport(TransactionType.EXPENSE)} className="w-full bg-rose-600 p-5 rounded-2xl text-white font-black flex items-center justify-center gap-3 active:scale-95 transition-transform shadow-lg shadow-rose-900/20">
                <ArrowTrendingDownIcon className="w-5 h-5" />
                Despesas
              </button>
              <button onClick={() => setIsImportChoiceOpen(false)} className="w-full text-slate-500 text-xs font-bold uppercase tracking-widest mt-4">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lançamento */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-800 w-full max-w-md rounded-t-[3.5rem] p-8 animate-slide-up shadow-2xl border-t border-slate-700">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black text-white tracking-tight uppercase">{editingTransaction ? 'Editar' : 'Novo'} Lançamento</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-3 bg-slate-700 rounded-full active:scale-90 transition-transform"><XMarkIcon className="w-6 h-6 text-slate-300" /></button>
            </div>
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
            }} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <select name="type" defaultValue={editingTransaction?.type || TransactionType.EXPENSE} className="bg-slate-700 rounded-2xl p-5 text-sm font-black text-white outline-none border-2 border-transparent focus:border-indigo-500 transition-all appearance-none">
                  <option value={TransactionType.EXPENSE}>Saída</option>
                  <option value={TransactionType.INCOME}>Entrada</option>
                </select>
                <input type="number" step="0.01" name="amount" required placeholder="0.00 €" defaultValue={editingTransaction?.amount} className="bg-slate-700 rounded-2xl p-5 text-sm font-black text-white outline-none border-2 border-transparent focus:border-indigo-500 transition-all" />
              </div>
              <input type="date" name="date" required defaultValue={editingTransaction?.date || new Date().toISOString().split('T')[0]} className="w-full bg-slate-700 rounded-2xl p-5 text-sm font-black text-white outline-none border-2 border-transparent focus:border-indigo-500 transition-all" />
              <select name="category" defaultValue={editingTransaction?.category} className="w-full bg-slate-700 rounded-2xl p-5 text-sm font-black text-white outline-none border-2 border-transparent focus:border-indigo-500 transition-all appearance-none">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <textarea name="description" placeholder="Algum detalhe extra?" defaultValue={editingTransaction?.description} className="w-full bg-slate-700 rounded-2xl p-5 text-sm font-black text-white outline-none border-2 border-transparent focus:border-indigo-500 transition-all min-h-[100px] resize-none" />
              <button type="submit" className="w-full bg-indigo-600 py-6 rounded-[2rem] text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-900/40 active:scale-95 transition-transform">Salvar Movimento</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Categorias */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-800 w-full max-w-md rounded-t-[3.5rem] p-8 animate-slide-up border-t border-slate-700">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Etiquetas</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="p-3 bg-slate-700 rounded-full"><XMarkIcon className="w-6 h-6 text-slate-300" /></button>
            </div>
            <div className="flex gap-3 mb-8">
              <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Nova etiqueta..." className="flex-1 bg-slate-700 rounded-2xl p-5 text-sm font-black text-white outline-none border-2 border-transparent focus:border-indigo-500 transition-all" />
              <button onClick={() => { if(newCategoryName) { setCategories(p => { const n = [...p, newCategoryName]; localStorage.setItem('fintrack_categories', JSON.stringify(n)); return n; }); setNewCategoryName(''); } }} className="bg-indigo-600 text-white px-8 rounded-2xl font-black transition-transform active:scale-90"><PlusIcon className="w-6 h-6"/></button>
            </div>
            <div className="grid grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto pr-2 pb-8 custom-scrollbar">
              {categories.map(c => (
                <div key={c} className="bg-slate-700 p-5 rounded-2xl flex items-center justify-between text-xs font-black text-white group border border-slate-600 hover:border-indigo-500 transition-all">
                  {c}
                  <button onClick={() => setCategories(p => { const n = p.filter(x => x !== c); localStorage.setItem('fintrack_categories', JSON.stringify(n)); return n; })} className="text-slate-500 hover:text-rose-500 transition-colors"><TrashIcon className="w-4 h-4"/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;
