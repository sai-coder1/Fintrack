/**
 * SpendSense — Centralized Persistent Storage Layer (v2)
 *
 * CONVENTION DOCUMENTATION:
 * 1. Transaction Amounts:
 *    All transaction `amount` values are stored as STRICTLY POSITIVE numbers (amount > 0).
 *    The `type` field ('income' | 'expense') determines cashflow direction:
 *    - 'income' adds to net balance / inflows.
 *    - 'expense' subtracts from net balance / outflows.
 *    - 'refunds' are recorded with nature: 'refund' or type: 'income'.
 *
 * 2. Separation of Modes:
 *    Personal user data is stored in separate keys from demo/sample data.
 *    Switching to Sample Mode never overwrites personal transactions.
 *    Resetting demo data only affects the sample dataset.
 *
 * 3. Schema & Corruption Safety:
 *    All reads validate records against expected schemas. Corrupted records
 *    are repaired or discarded with fallback defaults.
 */

export const STORAGE_VERSION = 'v2';

export const STORAGE_KEYS = {
  ACTIVE_MODE: `spendsense_mode_${STORAGE_VERSION}`,                // 'sample' | 'personal'
  SETTINGS: `spendsense_settings_${STORAGE_VERSION}`,
  USER_TRANSACTIONS: `spendsense_user_txns_${STORAGE_VERSION}`,
  USER_BUDGETS: `spendsense_user_budgets_${STORAGE_VERSION}`,
  USER_GOALS: `spendsense_user_goals_${STORAGE_VERSION}`,
  SAMPLE_TRANSACTIONS: `spendsense_sample_txns_${STORAGE_VERSION}`,
  SAMPLE_BUDGETS: `spendsense_sample_budgets_${STORAGE_VERSION}`,
  SAMPLE_GOALS: `spendsense_sample_goals_${STORAGE_VERSION}`
};

// In-memory fallback if localStorage is disabled or throws
const memoryStorage = new Map();

/**
 * Safely writes a value to localStorage with memory fallback.
 */
export function safeSet(key, value) {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch (err) {
    console.warn(`[SpendSense Storage] Failed to write to localStorage for key: ${key}. Using memory fallback.`, err);
    memoryStorage.set(key, value);
  }
}

/**
 * Safely reads a value from localStorage with memory fallback and error recovery.
 */
export function safeGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) {
      return memoryStorage.has(key) ? memoryStorage.get(key) : fallback;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[SpendSense Storage] Corrupted or invalid JSON for key: ${key}. Recovering with fallback.`, err);
    return fallback;
  }
}

/**
 * Safely removes a key from storage.
 */
export function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore error
  }
  memoryStorage.delete(key);
}

/**
 * Sanitizes and validates an individual transaction object.
 * Enforces strictly positive amounts, valid ISO dates, and known types.
 */
export function sanitizeTransaction(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  // Ensure ID
  const id = typeof raw.id === 'string' && raw.id.trim()
    ? raw.id.trim()
    : `txn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Ensure Date (YYYY-MM-DD format)
  let date = typeof raw.date === 'string' ? raw.date.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    date = new Date().toISOString().split('T')[0];
  }

  // Ensure Description
  const description = typeof raw.description === 'string' && raw.description.trim()
    ? raw.description.trim()
    : 'Untitled Transaction';

  // Enforce POSITIVE amount convention
  let parsedAmount = typeof raw.amount === 'number' ? raw.amount : parseFloat(raw.amount);
  if (isNaN(parsedAmount) || !isFinite(parsedAmount)) {
    parsedAmount = 0;
  }
  const amount = Math.round((Math.abs(parsedAmount) + Number.EPSILON) * 100) / 100;

  // Type: 'income' or 'expense'
  const type = raw.type === 'income' ? 'income' : 'expense';

  // Category
  const category = typeof raw.category === 'string' && raw.category.trim()
    ? raw.category.trim()
    : 'General & Miscellaneous';

  // Nature
  let nature = typeof raw.nature === 'string' ? raw.nature.toLowerCase().trim() : 'want';
  if (!['need', 'want', 'investment', 'income', 'refund'].includes(nature)) {
    nature = type === 'income' ? 'income' : 'want';
  }

  // Payment Method
  const paymentMethod = typeof raw.paymentMethod === 'string' && raw.paymentMethod.trim()
    ? raw.paymentMethod.trim()
    : 'UPI';

  return {
    id,
    date,
    description,
    amount,
    type,
    category,
    nature,
    paymentMethod,
    notes: typeof raw.notes === 'string' ? raw.notes.trim() : '',
    source: typeof raw.source === 'string' ? raw.source : 'manual',
    hash: typeof raw.hash === 'string' ? raw.hash : `${date}_${amount.toFixed(2)}_${description.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString()
  };
}

/**
 * Validates and sanitizes an array of transactions.
 */
export function sanitizeTransactionsArray(list) {
  if (!Array.isArray(list)) return [];
  return list.map(sanitizeTransaction).filter(Boolean);
}

/**
 * Validates and sanitizes a budget item.
 */
export function sanitizeBudget(raw) {
  if (!raw || typeof raw !== 'object' || !raw.category) return null;
  const allocatedAmount = Math.max(0, Math.round((Number(raw.allocatedAmount) || 0) * 100) / 100);
  return {
    id: raw.id || `bgt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    category: String(raw.category).trim(),
    allocatedAmount,
    month: typeof raw.month === 'string' ? raw.month : '2026-10',
    alertThreshold: typeof raw.alertThreshold === 'number' ? raw.alertThreshold : 0.85
  };
}

/**
 * Validates and sanitizes a savings goal item.
 */
export function sanitizeGoal(raw) {
  if (!raw || typeof raw !== 'object' || !raw.title) return null;
  return {
    id: raw.id || `goal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    title: String(raw.title).trim(),
    targetAmount: Math.max(0, Math.round((Number(raw.targetAmount) || 0) * 100) / 100),
    currentAmount: Math.max(0, Math.round((Number(raw.currentAmount) || 0) * 100) / 100),
    monthlyAllocation: Math.max(0, Math.round((Number(raw.monthlyAllocation) || 0) * 100) / 100),
    targetDate: typeof raw.targetDate === 'string' ? raw.targetDate : '2027-04-30',
    color: typeof raw.color === 'string' ? raw.color : '#4338ca',
    notes: typeof raw.notes === 'string' ? raw.notes.trim() : ''
  };
}

/**
 * Automatic migration helper from older v1 schema keys.
 */
export function migrateLegacyStorage() {
  try {
    const v1Txns = localStorage.getItem('spendsense_txns_v1');
    const v2UserTxns = localStorage.getItem(STORAGE_KEYS.USER_TRANSACTIONS);

    // If v1 exists and v2 doesn't yet have user transactions
    if (v1Txns && !v2UserTxns) {
      const parsed = JSON.parse(v1Txns);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Check if v1 was sample or user data
        const v1Settings = localStorage.getItem('spendsense_settings_v1');
        const settingsParsed = v1Settings ? JSON.parse(v1Settings) : null;
        const isSample = settingsParsed ? settingsParsed.isSampleMode : true;

        if (!isSample) {
          safeSet(STORAGE_KEYS.USER_TRANSACTIONS, sanitizeTransactionsArray(parsed));
          safeSet(STORAGE_KEYS.ACTIVE_MODE, 'personal');
        }
      }
    }
  } catch (err) {
    console.warn('[SpendSense Migration] Notice: migration completed or skipped.', err);
  }
}

/**
 * Validates a parsed backup payload structure before restoring.
 * Checks that it is an object and contains recognizable SpendSense collections.
 *
 * @param {any} jsonData - Parsed JSON content
 * @returns {{ valid: boolean, preview?: object, error?: string }}
 */
export function validateBackupData(jsonData) {
  if (!jsonData || typeof jsonData !== 'object' || Array.isArray(jsonData)) {
    return {
      valid: false,
      error: 'Invalid backup format: The file must contain a valid JSON root object.'
    };
  }

  // Acceptable keys in SpendSense schema (supports flat or nested .data root)
  const rawTxns = jsonData.userTransactions || jsonData.transactions || jsonData.data?.userTransactions || jsonData.data?.transactions;
  const rawBudgets = jsonData.userBudgets || jsonData.budgets || jsonData.data?.userBudgets || jsonData.data?.budgets;
  const rawGoals = jsonData.userGoals || jsonData.goals || jsonData.data?.userGoals || jsonData.data?.goals;
  const rawSettings = jsonData.settings || jsonData.data?.settings;

  const hasTxns = Array.isArray(rawTxns);
  const hasBudgets = Array.isArray(rawBudgets);
  const hasGoals = Array.isArray(rawGoals);
  const hasSettings = rawSettings && typeof rawSettings === 'object';

  if (!hasTxns && !hasBudgets && !hasGoals && !hasSettings) {
    return {
      valid: false,
      error: 'Unrecognized backup structure: File does not contain any FinTrack transactions, budgets, goals, or settings.'
    };
  }

  const validTxns = hasTxns ? sanitizeTransactionsArray(rawTxns) : [];
  const validBudgets = hasBudgets ? rawBudgets.map(sanitizeBudget).filter(Boolean) : [];
  const validGoals = hasGoals ? rawGoals.map(sanitizeGoal).filter(Boolean) : [];

  const displayName =
    hasSettings && typeof rawSettings.displayName === 'string' && rawSettings.displayName.trim()
      ? rawSettings.displayName.trim()
      : 'Friend';

  return {
    valid: true,
    preview: {
      app: jsonData.app || 'FinTrack',
      version: jsonData.version || STORAGE_VERSION,
      exportedAt: jsonData.exportedAt || null,
      transactionCount: validTxns.length,
      budgetCount: validBudgets.length,
      goalCount: validGoals.length,
      displayName,
      validTxns,
      validBudgets,
      validGoals,
      settings: hasSettings ? rawSettings : { displayName }
    }
  };
}
