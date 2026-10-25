import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { SAMPLE_TRANSACTIONS, SAMPLE_BUDGETS, SAMPLE_GOALS } from '../data/sampleData';
import {
  STORAGE_KEYS,
  STORAGE_VERSION,
  safeGet,
  safeSet,
  sanitizeTransaction,
  sanitizeTransactionsArray,
  sanitizeBudget,
  sanitizeGoal,
  validateBackupData,
  migrateLegacyStorage
} from '../utils/storage';
import {
  filterTransactionsByMonth,
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateNetBalance,
  calculateSavingsRate,
  aggregateSpendingByCategory,
  aggregateNeedsVsWants,
  aggregateMonthlyTotals,
  calculateBudgetUtilization,
  calculateGoalPacing,
  roundINR
} from '../utils/calculations';
import { calculateMonthEndForecast } from '../utils/forecasting';
import { generateActionableAlerts } from '../utils/alerts';
import { useAuth } from '../hooks/useAuth';
import { getPageFromPath, getPathFromPage } from '../utils/navigation';

const FinanceContext = createContext(null);

export function FinanceProvider({ children }) {
  const { user } = useAuth();

  // Run legacy storage migration once
  useEffect(() => {
    migrateLegacyStorage();
  }, []);

  // 1. Navigation State with URL & History synchronization
  const [currentPage, setCurrentPageRaw] = useState(() => {
    if (typeof window !== 'undefined') {
      const page = getPageFromPath(window.location.pathname, window.location.hash);
      return page;
    }
    return 'root';
  });

  const setCurrentPage = useCallback((newPage) => {
    setCurrentPageRaw(newPage);
    if (typeof window !== 'undefined') {
      const targetPath = getPathFromPage(newPage);
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const page = getPageFromPath(window.location.pathname, window.location.hash);
      setCurrentPageRaw(page);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 2. Active Mode: 'sample' | 'personal'
  const [activeMode, setActiveMode] = useState(() => {
    const saved = safeGet(STORAGE_KEYS.ACTIVE_MODE, 'sample');
    return saved === 'personal' ? 'personal' : 'sample';
  });

  const isSampleMode = activeMode === 'sample';

  // 3. Application Settings & Preferences
  const [settings, setSettings] = useState(() => {
    return safeGet(STORAGE_KEYS.SETTINGS, {
      displayName: 'Sai',
      currency: 'INR',
      activeMonth: '2026-10',
      notificationThreshold: 0.85
    });
  });

  // 4. Data Stores: Strictly Isolated User Data vs. Demo Sample Data
  const [userTransactions, setUserTransactions] = useState(() => {
    const raw = safeGet(STORAGE_KEYS.USER_TRANSACTIONS, []);
    return sanitizeTransactionsArray(raw);
  });

  const [userBudgets, setUserBudgets] = useState(() => {
    const raw = safeGet(STORAGE_KEYS.USER_BUDGETS, []);
    return Array.isArray(raw) ? raw.map(sanitizeBudget).filter(Boolean) : [];
  });

  const [userGoals, setUserGoals] = useState(() => {
    const raw = safeGet(STORAGE_KEYS.USER_GOALS, []);
    return Array.isArray(raw) ? raw.map(sanitizeGoal).filter(Boolean) : [];
  });

  // Sample Data Stores
  const [sampleTransactions, setSampleTransactions] = useState(() => {
    const raw = safeGet(STORAGE_KEYS.SAMPLE_TRANSACTIONS, SAMPLE_TRANSACTIONS);
    return sanitizeTransactionsArray(raw);
  });

  const [sampleBudgets, setSampleBudgets] = useState(() => {
    const raw = safeGet(STORAGE_KEYS.SAMPLE_BUDGETS, SAMPLE_BUDGETS);
    return Array.isArray(raw) ? raw.map(sanitizeBudget).filter(Boolean) : SAMPLE_BUDGETS;
  });

  const [sampleGoals, setSampleGoals] = useState(() => {
    const raw = safeGet(STORAGE_KEYS.SAMPLE_GOALS, SAMPLE_GOALS);
    return Array.isArray(raw) ? raw.map(sanitizeGoal).filter(Boolean) : SAMPLE_GOALS;
  });

  // 5. Active Collections (Read by current mode)
  const transactions = isSampleMode ? sampleTransactions : userTransactions;
  const budgets = isSampleMode ? sampleBudgets : userBudgets;
  const goals = isSampleMode ? sampleGoals : userGoals;

  // 6. Persistence Side-Effects
  useEffect(() => {
    safeSet(STORAGE_KEYS.ACTIVE_MODE, activeMode);
  }, [activeMode]);

  useEffect(() => {
    safeSet(STORAGE_KEYS.SETTINGS, settings);
  }, [settings]);

  // Sync Supabase Auth user full name into settings if available
  useEffect(() => {
    const fullName = user?.user_metadata?.full_name?.trim();
    if (fullName && (!settings.displayName || settings.displayName === 'Sai')) {
      setSettings((prev) => ({
        ...prev,
        displayName: fullName
      }));
    }
  }, [user]);

  useEffect(() => {
    safeSet(STORAGE_KEYS.USER_TRANSACTIONS, userTransactions);
  }, [userTransactions]);

  useEffect(() => {
    safeSet(STORAGE_KEYS.USER_BUDGETS, userBudgets);
  }, [userBudgets]);

  useEffect(() => {
    safeSet(STORAGE_KEYS.USER_GOALS, userGoals);
  }, [userGoals]);

  useEffect(() => {
    safeSet(STORAGE_KEYS.SAMPLE_TRANSACTIONS, sampleTransactions);
  }, [sampleTransactions]);

  useEffect(() => {
    safeSet(STORAGE_KEYS.SAMPLE_BUDGETS, sampleBudgets);
  }, [sampleBudgets]);

  useEffect(() => {
    safeSet(STORAGE_KEYS.SAMPLE_GOALS, sampleGoals);
  }, [sampleGoals]);

  // 7. Transaction Operations (Add, Edit, Delete)
  const addTransaction = useCallback((rawTxn) => {
    const sanitized = sanitizeTransaction(rawTxn);
    if (!sanitized) return null;

    if (isSampleMode) {
      setSampleTransactions((prev) => [sanitized, ...prev]);
    } else {
      setUserTransactions((prev) => [sanitized, ...prev]);
    }
    return sanitized;
  }, [isSampleMode]);

  const addTransactionsBatch = useCallback((rawTxnsList) => {
    if (!Array.isArray(rawTxnsList) || rawTxnsList.length === 0) return 0;
    const sanitizedList = rawTxnsList
      .map(sanitizeTransaction)
      .filter(Boolean);

    if (sanitizedList.length === 0) return 0;

    if (isSampleMode) {
      setSampleTransactions((prev) => [...sanitizedList, ...prev]);
    } else {
      setUserTransactions((prev) => [...sanitizedList, ...prev]);
    }
    return sanitizedList.length;
  }, [isSampleMode]);

  const updateTransaction = useCallback((id, updatedFields) => {
    const updater = (prevList) =>
      prevList.map((t) => {
        if (t.id === id) {
          const merged = { ...t, ...updatedFields };
          return sanitizeTransaction(merged) || t;
        }
        return t;
      });

    if (isSampleMode) {
      setSampleTransactions(updater);
    } else {
      setUserTransactions(updater);
    }
  }, [isSampleMode]);

  const deleteTransaction = useCallback((id) => {
    const remover = (prevList) => prevList.filter((t) => t.id !== id);
    if (isSampleMode) {
      setSampleTransactions(remover);
    } else {
      setUserTransactions(remover);
    }
  }, [isSampleMode]);

  // 8. Budget Operations
  const addBudget = useCallback((rawBudget) => {
    const sanitized = sanitizeBudget(rawBudget);
    if (!sanitized) return null;

    const updater = (prev) => {
      const idx = prev.findIndex((b) => b.category === sanitized.category && b.month === sanitized.month);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = sanitized;
        return copy;
      }
      return [sanitized, ...prev];
    };

    if (isSampleMode) {
      setSampleBudgets(updater);
    } else {
      setUserBudgets(updater);
    }
    return sanitized;
  }, [isSampleMode]);

  const updateBudget = useCallback((id, updatedFields) => {
    const updater = (prev) =>
      prev.map((b) => (b.id === id ? sanitizeBudget({ ...b, ...updatedFields }) || b : b));

    if (isSampleMode) {
      setSampleBudgets(updater);
    } else {
      setUserBudgets(updater);
    }
  }, [isSampleMode]);

  const deleteBudget = useCallback((id) => {
    const remover = (prev) => prev.filter((b) => b.id !== id);
    if (isSampleMode) {
      setSampleBudgets(remover);
    } else {
      setUserBudgets(remover);
    }
  }, [isSampleMode]);

  // 9. Savings Goal Operations
  const addGoal = useCallback((rawGoal) => {
    const sanitized = sanitizeGoal(rawGoal);
    if (!sanitized) return null;

    if (isSampleMode) {
      setSampleGoals((prev) => [sanitized, ...prev]);
    } else {
      setUserGoals((prev) => [sanitized, ...prev]);
    }
    return sanitized;
  }, [isSampleMode]);

  const updateGoal = useCallback((id, updatedFields) => {
    const updater = (prev) =>
      prev.map((g) => (g.id === id ? sanitizeGoal({ ...g, ...updatedFields }) || g : g));

    if (isSampleMode) {
      setSampleGoals(updater);
    } else {
      setUserGoals(updater);
    }
  }, [isSampleMode]);

  const deleteGoal = useCallback((id) => {
    const remover = (prev) => prev.filter((g) => g.id !== id);
    if (isSampleMode) {
      setSampleGoals(remover);
    } else {
      setUserGoals(remover);
    }
  }, [isSampleMode]);

  /**
   * Adjusts funds for a savings goal (contribute or withdraw).
   * STRICT FINTECH CONVENTION:
   * Goal contributions directly adjust the goal balance without creating
   * artificial expense transactions that would distort cash flow or budgets.
   *
   * @param {string} goalId
   * @param {number|string} amount
   * @param {'add' | 'withdraw'} [mode='add']
   * @returns {{ success: boolean, newAmount?: number, error?: string }}
   */
  const contributeToGoal = useCallback(
    (goalId, amount, mode = 'add') => {
      const delta = Math.abs(Number(amount)) || 0;
      if (delta <= 0) {
        return { success: false, error: 'Contribution amount must be greater than zero.' };
      }

      let updatedRecord = null;
      const updater = (prevGoals) =>
        prevGoals.map((g) => {
          if (g.id === goalId) {
            const current = Math.max(0, Number(g.currentAmount) || 0);
            const newAmount =
              mode === 'withdraw'
                ? Math.max(0, roundINR(current - delta))
                : roundINR(current + delta);

            updatedRecord = { ...g, currentAmount: newAmount };
            return updatedRecord;
          }
          return g;
        });

      if (isSampleMode) {
        setSampleGoals(updater);
      } else {
        setUserGoals(updater);
      }

      return { success: true, goal: updatedRecord };
    },
    [isSampleMode]
  );

  /**
   * Sets the globally active simulation / filtering month.
   * @param {string} monthStr - "YYYY-MM"
   */
  const setActiveMonth = useCallback((monthStr) => {
    if (typeof monthStr === 'string' && monthStr.match(/^\d{4}-\d{2}$/)) {
      setSettings((prev) => ({ ...prev, activeMonth: monthStr }));
    }
  }, []);

  /**
   * Updates application preferences and settings.
   * @param {object} partialSettings
   */
  const updateSettings = useCallback((partialSettings) => {
    if (partialSettings && typeof partialSettings === 'object') {
      setSettings((prev) => ({
        ...prev,
        ...partialSettings,
        currency: 'INR' // Fixed to INR for this edition
      }));
    }
  }, []);

  /**
   * Updates user display name.
   * @param {string} name
   */
  const updateDisplayName = useCallback((name) => {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (trimmed) {
      setSettings((prev) => ({ ...prev, displayName: trimmed }));
    }
  }, []);

  // 10. Sample Mode & State Switching
  const switchToSampleMode = useCallback(() => {
    setActiveMode('sample');
  }, []);

  const switchToPersonalMode = useCallback(() => {
    setActiveMode('personal');
  }, []);

  const toggleSampleMode = useCallback((forcedState) => {
    if (forcedState !== undefined) {
      setActiveMode(forcedState ? 'sample' : 'personal');
    } else {
      setActiveMode((prev) => (prev === 'sample' ? 'personal' : 'sample'));
    }
  }, []);

  const resetDemoData = useCallback(() => {
    const freshSample = sanitizeTransactionsArray(SAMPLE_TRANSACTIONS);
    const freshBudgets = SAMPLE_BUDGETS.map(sanitizeBudget).filter(Boolean);
    const freshGoals = SAMPLE_GOALS.map(sanitizeGoal).filter(Boolean);

    setSampleTransactions(freshSample);
    setSampleBudgets(freshBudgets);
    setSampleGoals(freshGoals);
    setActiveMode('sample');
  }, []);

  const clearPersonalData = useCallback(() => {
    setUserTransactions([]);
    setUserBudgets([]);
    setUserGoals([]);
  }, []);

  // 11. Global Add/Edit Transaction Modal Controls
  const [isTxnModalOpen, setIsTxnModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);

  const openAddTxnModal = useCallback((initialData = null) => {
    setEditingTransaction(initialData);
    setIsTxnModalOpen(true);
  }, []);

  const closeTxnModal = useCallback(() => {
    setEditingTransaction(null);
    setIsTxnModalOpen(false);
  }, []);

  // 12. Active Month & Financial Metrics Calculations
  const activeMonth = settings.activeMonth || '2026-10';

  const monthTransactions = useMemo(
    () => filterTransactionsByMonth(transactions, activeMonth),
    [transactions, activeMonth]
  );

  const totalIncome = useMemo(() => calculateTotalIncome(monthTransactions), [monthTransactions]);
  const totalExpenses = useMemo(() => calculateTotalExpenses(monthTransactions), [monthTransactions]);
  const netBalance = useMemo(() => calculateNetBalance(totalIncome, totalExpenses), [totalIncome, totalExpenses]);
  const savingsRate = useMemo(() => calculateSavingsRate(totalIncome, totalExpenses), [totalIncome, totalExpenses]);

  const categorySpending = useMemo(
    () => aggregateSpendingByCategory(monthTransactions),
    [monthTransactions]
  );

  const needsVsWants = useMemo(
    () => aggregateNeedsVsWants(monthTransactions),
    [monthTransactions]
  );

  const yearlyTotals = useMemo(
    () => aggregateMonthlyTotals(transactions, 2026),
    [transactions]
  );

  const forecast = useMemo(
    () =>
      calculateMonthEndForecast({
        transactions,
        budgets,
        targetMonth: activeMonth,
        asOfDate: `${activeMonth}-24`
      }),
    [transactions, budgets, activeMonth]
  );

  // 13. Dynamic Actionable Alerts Engine
  const alerts = useMemo(
    () =>
      generateActionableAlerts({
        transactions,
        budgets,
        goals,
        targetMonth: activeMonth,
        asOfDate: `${activeMonth}-24`
      }),
    [transactions, budgets, goals, activeMonth]
  );

  // 13. JSON Export & Restore Portability
  const exportDataJSON = useCallback(() => {
    const payload = {
      app: 'SpendSense',
      version: STORAGE_VERSION,
      exportedAt: new Date().toISOString(),
      activeMode,
      settings,
      userTransactions,
      userBudgets,
      userGoals
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spendsense_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeMode, settings, userTransactions, userBudgets, userGoals]);

  const importDataJSON = useCallback((jsonData) => {
    try {
      const validation = validateBackupData(jsonData);
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const { validTxns, validBudgets, validGoals, settings: importedSettings } = validation.preview;

      setUserTransactions(validTxns);
      setUserBudgets(validBudgets);
      setUserGoals(validGoals);

      if (importedSettings && typeof importedSettings === 'object') {
        setSettings((prev) => ({
          ...prev,
          ...importedSettings,
          currency: 'INR' // Locked to INR for hackathon MVP
        }));
      }

      setActiveMode('personal');
      return { success: true, preview: validation.preview };
    } catch (err) {
      console.error('[SpendSense] Error restoring backup:', err);
      return { success: false, error: err.message };
    }
  }, []);

  const value = {
    // Navigation & Mode
    currentPage,
    setCurrentPage,
    activeMode,
    isSampleMode,
    switchToSampleMode,
    switchToPersonalMode,
    toggleSampleMode,
    resetDemoData,
    clearPersonalData,

    // Settings & Filtering
    settings,
    setSettings,
    updateSettings,
    updateDisplayName,
    activeMonth,
    setActiveMonth,
    validateBackupData,

    // Current Active Collections
    transactions,
    monthTransactions,
    budgets,
    goals,

    // Raw User Stores
    userTransactions,
    userBudgets,
    userGoals,

    // Transaction Operations
    addTransaction,
    addTransactionsBatch,
    updateTransaction,
    deleteTransaction,

    // Budget Operations
    addBudget,
    updateBudget,
    deleteBudget,

    // Goal Operations
    addGoal,
    updateGoal,
    deleteGoal,
    contributeToGoal,

    // Modal State
    isTxnModalOpen,
    openAddTxnModal,
    closeTxnModal,
    editingTransaction,

    // Computed Financial Metrics & Intelligence
    totalIncome,
    totalExpenses,
    netBalance,
    savingsRate,
    categorySpending,
    needsVsWants,
    yearlyTotals,
    forecast,
    alerts,

    // Portability
    exportDataJSON,
    importDataJSON
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}
