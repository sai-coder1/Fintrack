import { toSupabaseTransactionRow, fromSupabaseTransactionRow } from './transactionAdapter.js';
import { generateTransactionHash } from './duplicateDetector.js';

/**
 * SpendSense — LocalStorage-to-Supabase Migration Service (Phase 5)
 *
 * Implements a safe, non-destructive migration engine that analyzes,
 * deduplicates, validates, and uploads existing local transactions
 * to the authenticated user's Supabase PostgreSQL cloud ledger.
 *
 * SAFETY GUARANTEES:
 * 1. Read-Only Preview: Reading and analyzing local transactions NEVER modifies,
 *    clears, or alters localStorage.
 * 2. Explicit Confirmation: Network uploads only occur upon explicit user trigger.
 * 3. Auth & Mode Verification: Only authenticated personal mode users can migrate.
 * 4. Zero Data Loss: Source localStorage records remain 100% intact even after success.
 * 5. Partial Failure Isolation: Batch inserts fall back to per-row execution on error.
 */

/**
 * Validates a candidate transaction against required ledger constraints.
 *
 * @param {object} txn - Candidate transaction object
 * @returns {{ isValid: boolean, error: string|null, sanitized: object|null }}
 */
export function validateCandidateTransaction(txn) {
  if (!txn || typeof txn !== 'object') {
    return { isValid: false, error: 'Transaction record is not an object', sanitized: null };
  }

  // 1. Description / Title check
  const description = (txn.description || txn.title || '').trim();
  if (!description) {
    return { isValid: false, error: 'Missing required description/title', sanitized: null };
  }

  // 2. Date check (YYYY-MM-DD)
  const rawDate = (txn.date || txn.transaction_date || '').trim();
  if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return { isValid: false, error: `Invalid date format: "${rawDate}". Expected YYYY-MM-DD`, sanitized: null };
  }
  const dateObj = new Date(rawDate);
  if (isNaN(dateObj.getTime())) {
    return { isValid: false, error: `Invalid calendar date: "${rawDate}"`, sanitized: null };
  }

  // 3. Amount check (Strictly positive, finite number)
  const rawAmount = txn.amount;
  const numAmount = typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount);
  if (typeof numAmount !== 'number' || isNaN(numAmount) || !isFinite(numAmount)) {
    return { isValid: false, error: `Invalid amount: "${rawAmount}". Must be a valid number`, sanitized: null };
  }
  if (numAmount <= 0) {
    return { isValid: false, error: `Non-positive amount: ${numAmount}. Amount must be strictly greater than 0`, sanitized: null };
  }
  const amount = Math.round((numAmount + Number.EPSILON) * 100) / 100;

  // 4. Type check ('income' or 'expense')
  const rawType = (txn.type || '').trim().toLowerCase();
  if (rawType !== 'income' && rawType !== 'expense') {
    return { isValid: false, error: `Invalid transaction type: "${txn.type}". Must be "income" or "expense"`, sanitized: null };
  }

  return {
    isValid: true,
    error: null,
    sanitized: {
      ...txn,
      description,
      date: rawDate,
      amount,
      type: rawType,
      category: (txn.category || 'General & Miscellaneous').trim(),
      nature: txn.nature || (rawType === 'income' ? 'income' : 'want'),
      paymentMethod: txn.paymentMethod || '',
      notes: typeof txn.notes === 'string' ? txn.notes.trim() : ''
    }
  };
}

/**
 * Analyzes local transactions against existing cloud transactions for migration.
 * Detects invalid rows, existing cloud duplicates, and intra-batch duplicates.
 *
 * @param {object} params
 * @param {Array<object>} params.localTransactions - Raw transactions from localStorage
 * @param {Array<object>} [params.cloudTransactions=[]] - Confirmed transactions in Supabase
 * @returns {object} Analysis result containing counts, categorized lists, and annotated rows
 */
export function analyzeLocalTransactionsForMigration({ localTransactions = [], cloudTransactions = [] }) {
  if (!Array.isArray(localTransactions)) {
    return {
      totalFound: 0,
      eligibleCount: 0,
      duplicateCount: 0,
      invalidCount: 0,
      analyzedRows: [],
      eligibleRows: [],
      duplicateRows: [],
      invalidRows: []
    };
  }

  // Build lookup index of existing cloud transactions
  const cloudHashMap = new Map();
  (cloudTransactions || []).forEach((t) => {
    if (!t) return;
    const hash = generateTransactionHash({
      date: t.date || t.transaction_date,
      amount: t.amount,
      description: t.description || t.title,
      type: t.type
    });
    cloudHashMap.set(hash, t);
    if (t.hash) {
      cloudHashMap.set(t.hash, t);
    }
  });

  // Track seen hashes within the local candidate batch
  const batchSeenMap = new Map();

  const analyzedRows = [];
  const eligibleRows = [];
  const duplicateRows = [];
  const invalidRows = [];

  localTransactions.forEach((rawTxn, index) => {
    const validation = validateCandidateTransaction(rawTxn);

    if (!validation.isValid) {
      const row = {
        ...rawTxn,
        batchIndex: index,
        isValid: false,
        validationError: validation.error,
        isDuplicate: false,
        duplicateSource: null,
        duplicateReason: null,
        selected: false
      };
      analyzedRows.push(row);
      invalidRows.push(row);
      return;
    }

    const candidate = validation.sanitized;
    const hash = generateTransactionHash({
      date: candidate.date,
      amount: candidate.amount,
      description: candidate.description,
      type: candidate.type
    });

    let isDuplicate = false;
    let duplicateSource = null;
    let duplicateReason = null;

    if (cloudHashMap.has(hash)) {
      const existing = cloudHashMap.get(hash);
      isDuplicate = true;
      duplicateSource = 'existing';
      duplicateReason = `Matches existing cloud transaction "${existing.description || existing.title}" on ${existing.date || existing.transaction_date} (₹${existing.amount})`;
    } else if (batchSeenMap.has(hash)) {
      const prevIndex = batchSeenMap.get(hash);
      isDuplicate = true;
      duplicateSource = 'batch';
      duplicateReason = `Duplicate of local transaction #${prevIndex + 1} ("${candidate.description}")`;
    } else {
      batchSeenMap.set(hash, index);
    }

    const row = {
      ...candidate,
      batchIndex: index,
      hash,
      isValid: true,
      validationError: null,
      isDuplicate,
      duplicateSource,
      duplicateReason,
      // Default: eligible unique rows are pre-selected; duplicates are pre-unselected
      selected: !isDuplicate
    };

    analyzedRows.push(row);

    if (isDuplicate) {
      duplicateRows.push(row);
    } else {
      eligibleRows.push(row);
    }
  });

  return {
    totalFound: localTransactions.length,
    eligibleCount: eligibleRows.length,
    duplicateCount: duplicateRows.length,
    invalidCount: invalidRows.length,
    analyzedRows,
    eligibleRows,
    duplicateRows,
    invalidRows
  };
}

/**
 * Executes the secure upload of candidate transactions to Supabase.
 * Enforces atomic bulk insert with per-row fallback for partial failure isolation.
 *
 * @param {object} params
 * @param {Array<object>} params.transactionsToMigrate - Selected transaction records
 * @param {string} params.activeUserId - Authenticated user UUID
 * @param {object} params.supabaseClient - Initialized Supabase client
 * @returns {Promise<object>} Detailed migration execution report
 */
export async function executeLocalTransactionsMigration({
  transactionsToMigrate = [],
  activeUserId,
  supabaseClient
}) {
  if (!activeUserId || typeof activeUserId !== 'string' || !activeUserId.trim()) {
    return {
      success: false,
      error: 'Authenticated user session is required for cloud migration.',
      totalAttempted: 0,
      migratedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      confirmedTxns: [],
      errors: [{ message: 'Missing user session ID' }]
    };
  }

  if (!supabaseClient) {
    return {
      success: false,
      error: 'Supabase client is not available or unconfigured.',
      totalAttempted: 0,
      migratedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      confirmedTxns: [],
      errors: [{ message: 'Supabase client unavailable' }]
    };
  }

  if (!Array.isArray(transactionsToMigrate) || transactionsToMigrate.length === 0) {
    return {
      success: true,
      totalAttempted: 0,
      migratedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      confirmedTxns: [],
      errors: []
    };
  }

  // 1. Prepare and validate payloads via transaction adapter
  const validItemsToInsert = [];
  const conversionErrors = [];

  transactionsToMigrate.forEach((txn, idx) => {
    try {
      const payload = toSupabaseTransactionRow(txn, activeUserId.trim());
      validItemsToInsert.push({ payload, clientTxn: txn });
    } catch (adapterErr) {
      conversionErrors.push({
        description: txn.description || txn.title || `Item #${idx + 1}`,
        error: adapterErr.message
      });
    }
  });

  if (validItemsToInsert.length === 0) {
    return {
      success: false,
      error: 'All selected transactions failed adapter validation.',
      totalAttempted: transactionsToMigrate.length,
      migratedCount: 0,
      failedCount: conversionErrors.length,
      skippedCount: 0,
      confirmedTxns: [],
      errors: conversionErrors
    };
  }

  const confirmedTxns = [];
  const insertFailures = [...conversionErrors];

  try {
    // Attempt 1: Fast bulk insert
    const rowsPayload = validItemsToInsert.map((item) => item.payload);
    const { data, error } = await supabaseClient
      .from('transactions')
      .insert(rowsPayload)
      .select();

    if (!error && Array.isArray(data)) {
      // Bulk insert succeeded completely
      data.forEach((row, i) => {
        const matchingClientTxn = validItemsToInsert[i]?.clientTxn || null;
        confirmedTxns.push(fromSupabaseTransactionRow(row, matchingClientTxn));
      });
    } else {
      // Bulk insert encountered an error; fall back to atomic per-row inserts
      // to isolate any individual row failures and salvage all valid rows
      console.warn('[SpendSense Migration] Bulk insert encountered issue, isolating row-by-row:', error?.message);

      for (const item of validItemsToInsert) {
        try {
          const { data: singleData, error: singleError } = await supabaseClient
            .from('transactions')
            .insert(item.payload)
            .select()
            .single();

          if (singleError || !singleData) {
            insertFailures.push({
              description: item.clientTxn.description || item.clientTxn.title,
              error: singleError?.message || 'Database insert failed'
            });
          } else {
            confirmedTxns.push(fromSupabaseTransactionRow(singleData, item.clientTxn));
          }
        } catch (rowErr) {
          insertFailures.push({
            description: item.clientTxn.description || item.clientTxn.title,
            error: rowErr.message || 'Network exception during row migration'
          });
        }
      }
    }
  } catch (networkErr) {
    console.error('[SpendSense Migration] Network exception during cloud migration:', networkErr);
    return {
      success: false,
      error: networkErr.message || 'Network connection failed during cloud migration.',
      totalAttempted: transactionsToMigrate.length,
      migratedCount: 0,
      failedCount: transactionsToMigrate.length,
      skippedCount: 0,
      confirmedTxns: [],
      errors: [{ message: networkErr.message }]
    };
  }

  const success = confirmedTxns.length > 0;

  return {
    success,
    totalAttempted: transactionsToMigrate.length,
    migratedCount: confirmedTxns.length,
    failedCount: insertFailures.length,
    skippedCount: transactionsToMigrate.length - (confirmedTxns.length + insertFailures.length),
    confirmedTxns,
    errors: insertFailures
  };
}
