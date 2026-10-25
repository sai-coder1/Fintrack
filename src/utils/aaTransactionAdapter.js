import { DEFAULT_CATEGORIES } from '../data/defaultCategories.js';
import { generateTransactionHash, detectBatchDuplicates } from './duplicateDetector.js';
import { toSupabaseTransactionRow } from './transactionAdapter.js';

/**
 * SpendSense — Account Aggregator (AA) Transaction Normalization Adapter (Phase C)
 *
 * Provides isolated, robust normalization for account transactions originating
 * from India's Account Aggregator (AA) ecosystem.
 *
 * DOCUMENTED NORMALIZED INPUT CONTRACT:
 * When financial statement data is retrieved via an AA provider or Edge Function,
 * each transaction record conforms to the following input shape:
 *
 * {
 *   date: string,                     // YYYY-MM-DD or parseable ISO date
 *   narration: string,                // Merchant description or transaction narrative
 *   amount: number | string,          // Strictly positive numeric amount
 *   direction: 'DEBIT' | 'CREDIT',    // Explicit cashflow direction (DEBIT = expense, CREDIT = income)
 *   providerTransactionId?: string,   // Optional provider reference / RRN / UTR
 *   category?: string,                // Optional category override
 *   nature?: string,                  // Optional 'need' | 'want' | 'investment' | 'income'
 *   paymentMode?: string,             // 'UPI' | 'NEFT' | 'IMPS' | 'RTGS' | 'CARD' | 'NET_BANKING'
 *   balance?: number | string,        // Running account balance post-transaction
 *   bankName?: string                 // e.g. 'HDFC Bank'
 * }
 *
 * SAFETY & SECURITY GUARANTEES:
 * 1. Explicit Direction: Never infers direction from negative/signed amounts.
 * 2. Provider Reference Isolation: Preserves external bank reference IDs without
 *    confusing them with PostgreSQL UUIDs.
 * 3. Strict Positive Magnitude: Enforces amount > 0.
 * 4. Structured Error Reporting: Returns actionable validation errors for invalid rows
 *    without silently dropping or corrupting records.
 * 5. Isolated Source Tag: Marks source strictly as 'aa'.
 */

/**
 * Auto-assigns category and nature based on description keywords.
 *
 * @param {string} description
 * @param {boolean} isIncome
 * @returns {{ category: string, nature: string }}
 */
function autoAssignCategoryFromNarration(description, isIncome) {
  if (isIncome) {
    return { category: 'Salary & Income', nature: 'income' };
  }

  const descLower = (description || '').toLowerCase();

  for (const cat of DEFAULT_CATEGORIES) {
    if (cat.type === 'expense' && Array.isArray(cat.keywords)) {
      for (const keyword of cat.keywords) {
        if (descLower.includes(keyword.toLowerCase())) {
          return {
            category: cat.name,
            nature: cat.defaultNature || 'want'
          };
        }
      }
    }
  }

  return {
    category: 'General & Miscellaneous',
    nature: 'want'
  };
}

/**
 * Normalizes payment mode string into SpendSense standard paymentMethod.
 *
 * @param {string} rawMode
 * @param {string} narration
 * @returns {string} Standard payment method string
 */
function normalizePaymentMethod(rawMode, narration) {
  const modeStr = String(rawMode || '').toUpperCase().trim();
  const descStr = String(narration || '').toUpperCase().trim();

  if (modeStr.includes('UPI') || descStr.includes('UPI/')) return 'UPI';
  if (modeStr.includes('CARD') || modeStr.includes('POS') || descStr.includes('POS/')) return 'Credit Card';
  if (modeStr.includes('NET') || modeStr.includes('INTERNET') || modeStr.includes('NB')) return 'Net Banking';
  if (modeStr.includes('NEFT') || descStr.includes('NEFT/')) return 'Net Banking';
  if (modeStr.includes('IMPS') || descStr.includes('IMPS/')) return 'Net Banking';
  if (modeStr.includes('RTGS') || descStr.includes('RTGS/')) return 'Net Banking';
  if (modeStr.includes('ATM')) return 'Cash';

  return 'Net Banking';
}

/**
 * Normalizes a single Account Aggregator transaction record into SpendSense's frontend model.
 *
 * @param {object} rawInput - Candidate transaction conforming to the AA input contract
 * @returns {{ success: boolean, transaction: object|null, error: string|null, errors: Array<string> }}
 */
export function normalizeAATransaction(rawInput) {
  const errors = [];

  if (!rawInput || typeof rawInput !== 'object') {
    return {
      success: false,
      transaction: null,
      error: '[aaTransactionAdapter] Invalid input: Transaction record must be an object.',
      errors: ['Transaction record must be an object']
    };
  }

  // 1. Description / Narration validation
  const description = String(
    rawInput.narration || rawInput.description || rawInput.title || ''
  ).trim();

  if (!description) {
    errors.push('Missing required transaction description/narration.');
  }

  // 2. Date validation (must extract valid YYYY-MM-DD calendar date)
  const rawDate = String(
    rawInput.date || rawInput.transaction_date || rawInput.txnDate || rawInput.bookingDate || rawInput.valueDate || ''
  ).trim();

  let date = '';
  if (!rawDate) {
    errors.push('Missing required transaction date.');
  } else {
    // Match leading YYYY-MM-DD from ISO string or standard format
    const isoMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      date = isoMatch[0];
      const parsed = new Date(date);
      if (isNaN(parsed.getTime())) {
        errors.push(`Invalid calendar date: "${rawDate}".`);
      }
    } else {
      errors.push(`Invalid date format: "${rawDate}". Expected YYYY-MM-DD or ISO 8601.`);
    }
  }

  // 3. Amount validation (strictly positive finite number)
  const rawAmount = rawInput.amount !== undefined ? rawInput.amount : rawInput.txnAmount;
  let numAmount = typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount);

  let amount = 0;
  if (typeof numAmount !== 'number' || isNaN(numAmount) || !isFinite(numAmount)) {
    errors.push(`Invalid transaction amount: "${rawAmount}". Amount must be a valid number.`);
  } else if (numAmount <= 0) {
    errors.push(`Non-positive transaction amount: ${numAmount}. Amount must be strictly greater than 0.`);
  } else {
    amount = Math.round((numAmount + Number.EPSILON) * 100) / 100;
  }

  // 4. Direction validation: Explicit DEBIT or CREDIT
  // Never guess from signed amount!
  const rawDirection = String(
    rawInput.direction || rawInput.type || rawInput.txnType || ''
  ).trim().toUpperCase();

  let type = '';
  if (rawDirection === 'DEBIT' || rawDirection === 'DR' || rawDirection === 'EXPENSE') {
    type = 'expense';
  } else if (rawDirection === 'CREDIT' || rawDirection === 'CR' || rawDirection === 'INCOME') {
    type = 'income';
  } else {
    errors.push(
      `Invalid transaction direction: "${rawInput.direction || rawInput.type || ''}". Direction must explicitly be "DEBIT" or "CREDIT".`
    );
  }

  // If critical validation errors exist, return structured failure
  if (errors.length > 0) {
    return {
      success: false,
      transaction: null,
      error: errors[0],
      errors
    };
  }

  // 5. Provider Reference Isolation
  // Preserved in `providerReference` without confusing it with the internal SpendSense UUID
  const providerReference = String(
    rawInput.providerTransactionId || rawInput.providerReference || rawInput.txnId || rawInput.referenceId || rawInput.rrn || ''
  ).trim() || null;

  // 6. Category & Nature Resolution
  let category = '';
  let nature = '';

  if (rawInput.category && typeof rawInput.category === 'string' && rawInput.category.trim()) {
    category = rawInput.category.trim();
    const matchedCategory = DEFAULT_CATEGORIES.find((c) => c.name.toLowerCase() === category.toLowerCase());
    nature = rawInput.nature || (matchedCategory ? matchedCategory.defaultNature : type === 'income' ? 'income' : 'want');
  } else {
    const autoCat = autoAssignCategoryFromNarration(description, type === 'income');
    category = autoCat.category;
    nature = rawInput.nature || autoCat.nature;
  }

  // 7. Payment Mode resolution
  const paymentMethod = normalizePaymentMethod(
    rawInput.paymentMode || rawInput.mode || rawInput.paymentMethod,
    description
  );

  // 8. Notes Formatting
  const existingNotes = typeof rawInput.notes === 'string' ? rawInput.notes.trim() : '';
  const noteParts = [];
  if (existingNotes) noteParts.push(existingNotes);
  if (providerReference) noteParts.push(`Ref: ${providerReference}`);
  if (rawInput.bankName) noteParts.push(`Bank: ${rawInput.bankName}`);
  if (rawInput.balance !== undefined && rawInput.balance !== null && !isNaN(parseFloat(rawInput.balance))) {
    noteParts.push(`Bal: ₹${parseFloat(rawInput.balance).toFixed(2)}`);
  }
  if (!existingNotes.includes('[src:aa]')) {
    noteParts.push('[src:aa]');
  }
  const notes = noteParts.join(' | ');

  // 9. Stable Composite Fingerprint Hash
  const hash = generateTransactionHash({
    date,
    amount,
    description,
    type
  });

  // 10. Generate internal temporary client ID
  // Note: Client ID is replaced by Supabase native UUID upon cloud insertion
  const id = `aa_txn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = rawInput.createdAt || new Date().toISOString();

  const transaction = {
    id,
    date,
    description,
    amount,
    type,
    category,
    nature,
    paymentMethod,
    notes,
    source: 'aa',
    hash,
    providerReference,
    createdAt
  };

  return {
    success: true,
    transaction,
    error: null,
    errors: []
  };
}

/**
 * Batch-normalizes an array of Account Aggregator transactions.
 * Categorizes rows into valid, invalid, and duplicate records.
 *
 * @param {Array<object>} rawInputsList - Array of candidate transactions
 * @param {Array<object>} [existingTransactions=[]] - Stored transactions for deduplication
 * @returns {object} Batch normalization result
 */
export function batchNormalizeAATransactions(rawInputsList, existingTransactions = []) {
  if (!Array.isArray(rawInputsList)) {
    return {
      total: 0,
      validCount: 0,
      invalidCount: 0,
      duplicateCount: 0,
      validTransactions: [],
      invalidTransactions: [],
      duplicateTransactions: []
    };
  }

  const validCandidates = [];
  const invalidTransactions = [];

  rawInputsList.forEach((raw, idx) => {
    const result = normalizeAATransaction(raw);
    if (result.success && result.transaction) {
      validCandidates.push({
        ...result.transaction,
        batchIndex: idx
      });
    } else {
      invalidTransactions.push({
        batchIndex: idx,
        input: raw,
        errors: result.errors
      });
    }
  });

  // Run duplicate detection against existing transactions and intra-batch collisions
  const deduplicated = detectBatchDuplicates(validCandidates, existingTransactions);

  const validTransactions = [];
  const duplicateTransactions = [];

  deduplicated.forEach((item) => {
    if (item.isDuplicate) {
      duplicateTransactions.push(item);
    } else {
      validTransactions.push(item);
    }
  });

  return {
    total: rawInputsList.length,
    validCount: validTransactions.length,
    invalidCount: invalidTransactions.length,
    duplicateCount: duplicateTransactions.length,
    validTransactions,
    invalidTransactions,
    duplicateTransactions
  };
}

/**
 * Converts a normalized AA transaction into a Supabase database row payload.
 * Reuses the canonical toSupabaseTransactionRow adapter for guaranteed schema parity.
 *
 * @param {object} clientAATxn - Normalized AA transaction
 * @param {string} userId - Authenticated user UUID
 * @returns {object} Supabase insert row payload (omitting client ID)
 */
export function toSupabaseAATransactionRow(clientAATxn, userId) {
  if (!clientAATxn || typeof clientAATxn !== 'object') {
    throw new Error('[aaTransactionAdapter] Invalid AA transaction: input must be an object.');
  }

  // Ensure transaction is in SpendSense client model
  const normalized = clientAATxn.source === 'aa' && clientAATxn.date && clientAATxn.description
    ? clientAATxn
    : normalizeAATransaction(clientAATxn).transaction;

  if (!normalized) {
    throw new Error('[aaTransactionAdapter] Cannot convert invalid AA transaction to Supabase row.');
  }

  // Delegate to the battle-tested toSupabaseTransactionRow adapter
  return toSupabaseTransactionRow(normalized, userId);
}
