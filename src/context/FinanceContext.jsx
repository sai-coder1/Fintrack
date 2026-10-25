import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SAMPLE_TRANSACTIONS, SAMPLE_BUDGETS, SAMPLE_GOALS } from '../data/sampleData';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { toSupabaseTransactionRow, fromSupabaseTransactionRow } from '../utils/transactionAdapter';
import { executeLocalTransactionsMigration } from '../utils/migrationService';
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
  const { user, profile } = useAuth();

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

  // 4b. Cloud Transaction Store for Authenticated Personal Mode (Phase 2)
  const [cloudTransactions, setCloudTransactions] = useState([]);
  const [cloudTxnStatus, setCloudTxnStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [cloudTxnError, setCloudTxnError] = useState(null);
  const activeFetchIdRef = useRef(0);
  const userTransactionsRef = useRef(userTransactions);
  const userRef = useRef(user);

  useEffect(() => {
    userTransactionsRef.current = userTransactions;
  }, [userTransactions]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const fetchCloudTransactions = useCallback(async () => {
    // Only fetch when in personal mode, user is authenticated, and Supabase is configured
    if (isSampleMode || !user || !isSupabaseConfigured || !supabase) {
      activeFetchIdRef.current++;
      setCloudTransactions([]);
      setCloudTxnStatus('idle');
      setCloudTxnError(null);
      return;
    }

    const fetchId = ++activeFetchIdRef.current;
    setCloudTxnStatus('loading');
    setCloudTxnError(null);

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: false });

      // Stale response guard: If another fetch was started, or user signed out/switched, discard result
      if (fetchId !== activeFetchIdRef.current) return;

      if (error) {
        console.error('[SpendSense FinanceContext] Supabase fetch error:', error.message);
        setCloudTxnError(error.message || 'Failed to fetch cloud transactions');
        setCloudTxnStatus('error');
        return;
      }

      // Build lookup of local transactions to preserve any custom nature or paymentMethod
      const localMap = new Map();
      (userTransactionsRef.current || []).forEach((t) => {
        if (t.id) localMap.set(t.id, t);
        if (t.hash) localMap.set(t.hash, t);
      });

      const converted = (data || []).map((row) => {
        const localMatch = localMap.get(String(row.id)) || null;
        return fromSupabaseTransactionRow(row, localMatch);
      });

      setCloudTransactions(converted);
      setCloudTxnStatus('success');
      setCloudTxnError(null);
    } catch (err) {
      if (fetchId !== activeFetchIdRef.current) return;
      console.error('[SpendSense FinanceContext] Unexpected fetch error:', err);
      setCloudTxnError(err.message || 'Network error while fetching cloud transactions');
      setCloudTxnStatus('error');
    }
  }, [user?.id, isSampleMode]);

  useEffect(() => {
    // When signed out or switching to sample mode, immediately purge cloud transactions from memory
    if (!user || isSampleMode) {
      activeFetchIdRef.current++;
      setCloudTransactions([]);
      setCloudTxnStatus('idle');
      setCloudTxnError(null);
      return;
    }

    // Initiate fetch for authenticated user in personal mode
    fetchCloudTransactions();

    return () => {
      // Invalidate in-flight fetch on unmount or user change
      activeFetchIdRef.current++;
    };
  }, [user?.id, isSampleMode, fetchCloudTransactions]);

  // 5. Active Collections (Read by current mode & auth state)
  const transactions = isSampleMode
    ? sampleTransactions
    : (user && cloudTxnStatus === 'success')
      ? cloudTransactions
      : userTransactions;
  const budgets = isSampleMode ? sampleBudgets : userBudgets;
  const goals = isSampleMode ? sampleGoals : userGoals;

  // 6. Persistence Side-Effects
  useEffect(() => {
    safeSet(STORAGE_KEYS.ACTIVE_MODE, activeMode);
  }, [activeMode]);

  useEffect(() => {
    safeSet(STORAGE_KEYS.SETTINGS, settings);
  }, [settings]);

  // Sync authenticated user / profile full name into settings
  useEffect(() => {
    if (!user) {
      // When signed out, reset personal display name so it doesn't linger across user accounts
      setSettings((prev) => {
        if (!prev.displayName || prev.displayName === 'Sai') return prev;
        return { ...prev, displayName: '' };
      });
      return;
    }

    const resolvedName = profile?.full_name?.trim() ||
      user?.user_metadata?.full_name?.trim() ||
      (user?.email ? user.email.split('@')[0] : '');

    if (resolvedName) {
      setSettings((prev) => {
        if (prev.displayName === resolvedName) return prev;
        return { ...prev, displayName: resolvedName };
      });
    }
  }, [user, profile]);

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
  const addTransaction = useCallback(async (rawTxn) => {
    const sanitized = sanitizeTransaction(rawTxn);
    if (!sanitized) {
      return { data: null, error: 'Invalid transaction data.' };
    }

    // A. Demo Mode: Local memory only, 100% isolated
    if (isSampleMode) {
      setSampleTransactions((prev) => [sanitized, ...prev]);
      return { data: sanitized, error: null };
    }

    // B. Purely Local / Offline Mode (when Supabase credentials are not configured)
    if (!isSupabaseConfigured || !supabase) {
      setUserTransactions((prev) => [sanitized, ...prev]);
      return { data: sanitized, error: null };
    }

    // C. Authenticated Personal Mode: Resolve current user session
    let activeUser = userRef.current || user;
    if (!activeUser?.id) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        activeUser = sessionData?.session?.user || null;
      } catch (authErr) {
        console.error('[SpendSense FinanceContext] Error checking session:', authErr);
      }
    }

    if (!activeUser?.id) {
      return {
        data: null,
        error: 'Active user session not found. Please verify you are signed in to save transactions to your cloud ledger.'
      };
    }

    const activeUserId = activeUser.id;

    try {
      const dbRowPayload = toSupabaseTransactionRow(sanitized, activeUserId);

      const { data, error } = await supabase
        .from('transactions')
        .insert(dbRowPayload)
        .select()
        .single();

      if (error) {
        console.error('[SpendSense] Supabase insert error:', error.message);
        return { data: null, error: error.message || 'Failed to save transaction to cloud.' };
      }

      if (!data) {
        return { data: null, error: 'No confirmation data returned from database.' };
      }

      // Guard: prevent stale write if user changed/signed out during in-flight call
      const currentLatestUser = userRef.current || user;
      if (currentLatestUser && currentLatestUser.id !== activeUserId) {
        return { data: null, error: 'User session changed during transaction save.' };
      }

      // Convert returned database row (with Supabase native UUID) to frontend model
      const createdTxn = fromSupabaseTransactionRow(data, sanitized);

      // Confirmed update: update cloud transactions in memory
      setCloudTransactions((prev) => [createdTxn, ...prev]);
      setCloudTxnStatus('success');

      return { data: createdTxn, error: null };
    } catch (err) {
      console.error('[SpendSense] Unexpected error during transaction creation:', err);
      return { data: null, error: err.message || 'Network error while creating transaction.' };
    }
  }, [isSampleMode, user]);

  const addTransactionsBatch = useCallback(async (rawTxnsList) => {
    if (!Array.isArray(rawTxnsList) || rawTxnsList.length === 0) {
      return { success: true, count: 0, imported: 0, failed: 0, errors: [] };
    }

    const sanitizedList = rawTxnsList
      .map(sanitizeTransaction)
      .filter(Boolean);

    if (sanitizedList.length === 0) {
      return { success: false, error: 'No valid transactions found in batch.', count: 0, imported: 0, failed: rawTxnsList.length, errors: [] };
    }

    // A. Demo Mode: Local memory only, 100% isolated
    if (isSampleMode) {
      setSampleTransactions((prev) => [...sanitizedList, ...prev]);
      return { success: true, count: sanitizedList.length, imported: sanitizedList.length, failed: 0, errors: [] };
    }

    // B. Purely Local / Offline Mode (when Supabase credentials are not configured)
    if (!isSupabaseConfigured || !supabase) {
      setUserTransactions((prev) => [...sanitizedList, ...prev]);
      return { success: true, count: sanitizedList.length, imported: sanitizedList.length, failed: 0, errors: [] };
    }

    // C. Authenticated Personal Mode: Resolve current active user session
    let activeUser = userRef.current || user;
    if (!activeUser?.id) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        activeUser = sessionData?.session?.user || null;
      } catch (authErr) {
        console.error('[SpendSense FinanceContext] Error checking session for batch import:', authErr);
      }
    }

    if (!activeUser?.id) {
      return {
        success: false,
        error: 'Active user session not found. Please verify you are signed in to import transactions to your cloud ledger.',
        count: 0,
        imported: 0,
        failed: sanitizedList.length,
        errors: [{ message: 'User session not found' }]
      };
    }

    const activeUserId = activeUser.id;

    // Convert candidate transactions to Supabase rows
    const validRowsToInsert = [];
    const clientConversionErrors = [];

    sanitizedList.forEach((t, idx) => {
      try {
        const rowPayload = toSupabaseTransactionRow(t, activeUserId);
        validRowsToInsert.push({ payload: rowPayload, clientTxn: t });
      } catch (convErr) {
        clientConversionErrors.push({
          index: idx,
          description: t.description,
          error: convErr.message
        });
      }
    });

    if (validRowsToInsert.length === 0) {
      return {
        success: false,
        error: 'All transactions failed validation before database insertion.',
        count: 0,
        imported: 0,
        failed: sanitizedList.length,
        errors: clientConversionErrors
      };
    }

    const confirmedCreatedTxns = [];
    const insertFailures = [...clientConversionErrors];

    try {
      // Attempt 1: Fast atomic bulk insert
      const rowsPayload = validRowsToInsert.map((item) => item.payload);
      const { data, error } = await supabase
        .from('transactions')
        .insert(rowsPayload)
        .select();

      if (!error && Array.isArray(data)) {
        // Full batch success
        data.forEach((row, i) => {
          const matchingClientTxn = validRowsToInsert[i]?.clientTxn || null;
          confirmedCreatedTxns.push(fromSupabaseTransactionRow(row, matchingClientTxn));
        });
      } else {
        // Attempt 2: Row-by-row fallback for partial failure isolation
        console.warn('[SpendSense Batch Import] Bulk insert encountered issue, falling back to per-row insert for error isolation:', error?.message);

        for (const item of validRowsToInsert) {
          try {
            const { data: singleData, error: singleError } = await supabase
              .from('transactions')
              .insert(item.payload)
              .select()
              .single();

            if (singleError || !singleData) {
              insertFailures.push({
                description: item.clientTxn.description,
                error: singleError?.message || 'Database insert failed'
              });
            } else {
              confirmedCreatedTxns.push(fromSupabaseTransactionRow(singleData, item.clientTxn));
            }
          } catch (rowErr) {
            insertFailures.push({
              description: item.clientTxn.description,
              error: rowErr.message || 'Network error on row insert'
            });
          }
        }
      }
    } catch (batchErr) {
      console.error('[SpendSense] Batch import network error:', batchErr);
      return {
        success: false,
        error: batchErr.message || 'Network error during batch transaction import.',
        count: 0,
        imported: 0,
        failed: sanitizedList.length,
        errors: [{ message: batchErr.message }]
      };
    }

    // Stale guard: check if user switched during in-flight network calls
    const currentLatestUser = userRef.current || user;
    if (currentLatestUser && currentLatestUser.id !== activeUserId) {
      return {
        success: false,
        error: 'User session changed during batch transaction import.',
        count: 0,
        imported: 0,
        failed: sanitizedList.length,
        errors: [{ message: 'User session changed during import' }]
      };
    }

    // Only update in-memory state with transactions confirmed by Supabase
    if (confirmedCreatedTxns.length > 0) {
      setCloudTransactions((prev) => [...confirmedCreatedTxns, ...prev]);
      setCloudTxnStatus('success');
    }

    return {
      success: confirmedCreatedTxns.length > 0,
      count: confirmedCreatedTxns.length,
      imported: confirmedCreatedTxns.length,
      failed: insertFailures.length,
      errors: insertFailures,
      data: confirmedCreatedTxns
    };
  }, [isSampleMode, user]);

  /**
   * Phase 5: Safely migrates existing localStorage transactions to Supabase.
   * Enforces authenticated personal mode, never alters or deletes source localStorage,
   * updates in-memory cloud transactions upon confirmation.
   */
  const migrateLocalStorageTransactions = useCallback(async (candidateTxnsList) => {
    // 1. Availability Guards
    if (isSampleMode) {
      return {
        success: false,
        error: 'Demo sample mode transactions cannot be migrated to Supabase. Please switch to Personal Mode.',
        totalAttempted: 0,
        migratedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        confirmedTxns: [],
        errors: [{ message: 'Demo mode cannot migrate' }]
      };
    }

    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        error: 'Supabase credentials are not configured. Cloud migration is unavailable.',
        totalAttempted: 0,
        migratedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        confirmedTxns: [],
        errors: [{ message: 'Supabase unconfigured' }]
      };
    }

    // 2. Resolve authenticated user session
    let activeUser = userRef.current || user;
    if (!activeUser?.id) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        activeUser = sessionData?.session?.user || null;
      } catch (authErr) {
        console.error('[SpendSense FinanceContext] Error checking session for migration:', authErr);
      }
    }

    if (!activeUser?.id) {
      return {
        success: false,
        error: 'Active authenticated session required. Please sign in to migrate your transactions.',
        totalAttempted: 0,
        migratedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        confirmedTxns: [],
        errors: [{ message: 'User not authenticated' }]
      };
    }

    const activeUserId = activeUser.id;

    // 3. Execute migration via migration service
    const result = await executeLocalTransactionsMigration({
      transactionsToMigrate: candidateTxnsList,
      activeUserId,
      supabaseClient: supabase
    });

    // 4. Stale-write guard
    const currentLatestUser = userRef.current || user;
    if (currentLatestUser && currentLatestUser.id !== activeUserId) {
      return {
        success: false,
        error: 'User session changed during transaction migration.',
        totalAttempted: Array.isArray(candidateTxnsList) ? candidateTxnsList.length : 0,
        migratedCount: 0,
        failedCount: Array.isArray(candidateTxnsList) ? candidateTxnsList.length : 0,
        skippedCount: 0,
        confirmedTxns: [],
        errors: [{ message: 'User session changed during migration' }]
      };
    }

    // 5. Update in-memory cloud transactions with confirmed records
    // CRITICAL: NEVER delete or modify userTransactions or localStorage!
    if (result.confirmedTxns && result.confirmedTxns.length > 0) {
      setCloudTransactions((prev) => [...result.confirmedTxns, ...prev]);
      setCloudTxnStatus('success');
    }

    return result;
  }, [isSampleMode, user]);

  const updateTransaction = useCallback(async (id, updatedFields) => {
    // A. Demo Mode: Local memory only
    if (isSampleMode) {
      const updater = (prevList) =>
        prevList.map((t) => {
          if (t.id === id) {
            const merged = { ...t, ...updatedFields };
            return sanitizeTransaction(merged) || t;
          }
          return t;
        });
      setSampleTransactions(updater);
      return { success: true, error: null };
    }

    // B. Purely Local / Offline Mode (when Supabase credentials are not configured)
    if (!isSupabaseConfigured || !supabase) {
      const updater = (prevList) =>
        prevList.map((t) => {
          if (t.id === id) {
            const merged = { ...t, ...updatedFields };
            return sanitizeTransaction(merged) || t;
          }
          return t;
        });
      setUserTransactions(updater);
      return { success: true, error: null };
    }

    // C. Authenticated Personal Mode: Resolve current user session
    let activeUser = userRef.current || user;
    if (!activeUser?.id) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        activeUser = sessionData?.session?.user || null;
      } catch (authErr) {
        console.error('[SpendSense FinanceContext] Error checking session:', authErr);
      }
    }

    if (!activeUser?.id) {
      return {
        success: false,
        error: 'Active user session not found. Please verify you are signed in to update cloud records.'
      };
    }

    const activeUserId = activeUser.id;

    // Find existing transaction in cloudTransactions
    const existing = cloudTransactions.find((t) => t.id === id);
    if (!existing) {
      return { success: false, error: 'Transaction not found in cloud records.' };
    }

    const merged = { ...existing, ...updatedFields };
    const sanitized = sanitizeTransaction(merged);
    if (!sanitized) {
      return { success: false, error: 'Invalid transaction update payload.' };
    }

    try {
      const dbRowPayload = toSupabaseTransactionRow(sanitized, activeUserId);

      // Update in Supabase, scoped by both record id and user_id for defense-in-depth alongside RLS
      const { data, error } = await supabase
        .from('transactions')
        .update(dbRowPayload)
        .eq('id', id)
        .eq('user_id', activeUserId)
        .select()
        .single();

      if (error) {
        console.error('[SpendSense] Supabase update error:', error.message);
        return { success: false, error: error.message || 'Failed to update transaction in cloud.' };
      }

      if (!data) {
        return { success: false, error: 'No confirmation data returned from database update.' };
      }

      // Guard: prevent stale update if user changed/signed out during in-flight call
      const currentLatestUser = userRef.current || user;
      if (currentLatestUser && currentLatestUser.id !== activeUserId) {
        return { success: false, error: 'User session changed during transaction update.' };
      }

      const updatedTxn = fromSupabaseTransactionRow(data, sanitized);

      // Confirmed update: update cloud transactions in memory
      setCloudTransactions((prev) =>
        prev.map((t) => (t.id === id ? updatedTxn : t))
      );

      return { success: true, data: updatedTxn, error: null };
    } catch (err) {
      console.error('[SpendSense] Unexpected error during transaction update:', err);
      return { success: false, error: err.message || 'Network error while updating transaction.' };
    }
  }, [isSampleMode, user, cloudTransactions]);

  const deleteTransaction = useCallback(async (id) => {
    // A. Demo Mode: Local memory only
    if (isSampleMode) {
      setSampleTransactions((prev) => prev.filter((t) => t.id !== id));
      return { success: true, error: null };
    }

    // B. Purely Local / Offline Mode (when Supabase credentials are not configured)
    if (!isSupabaseConfigured || !supabase) {
      setUserTransactions((prev) => prev.filter((t) => t.id !== id));
      return { success: true, error: null };
    }

    // C. Authenticated Personal Mode: Resolve current user session
    let activeUser = userRef.current || user;
    if (!activeUser?.id) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        activeUser = sessionData?.session?.user || null;
      } catch (authErr) {
        console.error('[SpendSense FinanceContext] Error checking session:', authErr);
      }
    }

    if (!activeUser?.id) {
      return {
        success: false,
        error: 'Active user session not found. Please verify you are signed in to delete cloud records.'
      };
    }

    const activeUserId = activeUser.id;

    try {
      // Scoped by both record id and user_id for defense-in-depth alongside RLS
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id)
        .eq('user_id', activeUserId);

      if (error) {
        console.error('[SpendSense] Supabase delete error:', error.message);
        return { success: false, error: error.message || 'Failed to delete transaction from cloud.' };
      }

      // Guard: prevent stale delete if user changed/signed out during in-flight call
      const currentLatestUser = userRef.current || user;
      if (currentLatestUser && currentLatestUser.id !== activeUserId) {
        return { success: false, error: 'User session changed during transaction delete.' };
      }

      // Confirmed delete: only remove from state after database confirms deletion
      setCloudTransactions((prev) => prev.filter((t) => t.id !== id));

      return { success: true, error: null };
    } catch (err) {
      console.error('[SpendSense] Unexpected error during transaction delete:', err);
      return { success: false, error: err.message || 'Network error while deleting transaction.' };
    }
  }, [isSampleMode, user]);

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

    // Cloud Sync State & Operations (Phase 2)
    cloudTransactions,
    cloudTxnStatus,
    cloudTxnLoading: cloudTxnStatus === 'loading',
    cloudTxnError,
    refetchCloudTransactions: fetchCloudTransactions,

    // Transaction Operations
    addTransaction,
    addTransactionsBatch,
    migrateLocalStorageTransactions,
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
