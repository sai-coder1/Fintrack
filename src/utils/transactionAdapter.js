import { DEFAULT_CATEGORIES } from '../data/defaultCategories.js';
import { generateTransactionHash } from './duplicateDetector.js';

/**
 * SpendSense — Supabase Transaction Adapter
 *
 * Provides bidirectional translation between SpendSense client-side transaction
 * models and Supabase PostgreSQL `transactions` table rows.
 *
 * Enforces strict validation:
 * - Amounts must be strictly positive numbers (> 0).
 * - Types must strictly be 'income' or 'expense'.
 * - Client-generated string IDs are omitted on insert to allow Supabase to assign UUIDs.
 * - Inferred values for missing columns (nature, paymentMethod) are handled non-destructively.
 */

/**
 * Converts a frontend transaction object into a Supabase database row payload.
 *
 * @param {object} clientTxn - Frontend transaction object
 * @param {string} userId - Authenticated user UUID
 * @returns {object} Supabase insert/update payload (omitting client ID)
 * @throws {Error} If required fields are missing or invalid
 */
export function toSupabaseTransactionRow(clientTxn, userId) {
  if (!clientTxn || typeof clientTxn !== 'object') {
    throw new Error('[transactionAdapter] Invalid transaction: input must be an object.');
  }

  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new Error('[transactionAdapter] Missing required userId: A valid user ID is required to save to Supabase.');
  }

  // Description / Title validation
  const title = (clientTxn.description || clientTxn.title || '').trim();
  if (!title) {
    throw new Error('[transactionAdapter] Invalid transaction description: Title/description is required.');
  }

  // Date validation (must be non-empty and formatted YYYY-MM-DD or parseable ISO date)
  const dateStr = (clientTxn.date || clientTxn.transaction_date || '').trim();
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    throw new Error(`[transactionAdapter] Invalid transaction date: "${dateStr}". Expected YYYY-MM-DD format.`);
  }
  const transaction_date = dateStr.slice(0, 10);

  // Amount validation: Strictly positive, numeric, finite (no silent Math.abs or auto-repair)
  const rawAmount = clientTxn.amount;
  const numAmount = typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount);
  if (typeof numAmount !== 'number' || isNaN(numAmount) || !isFinite(numAmount)) {
    throw new Error(`[transactionAdapter] Invalid transaction amount: "${rawAmount}". Amount must be a valid number.`);
  }
  if (numAmount <= 0) {
    throw new Error(`[transactionAdapter] Invalid transaction amount: ${numAmount}. Amount must be strictly greater than 0.`);
  }
  const amount = Math.round((numAmount + Number.EPSILON) * 100) / 100;

  // Type validation: Strictly 'income' or 'expense'
  const rawType = clientTxn.type;
  if (rawType !== 'income' && rawType !== 'expense') {
    throw new Error(`[transactionAdapter] Invalid transaction type: "${rawType}". Type must be either "income" or "expense".`);
  }
  const type = rawType;

  // Category
  const category = (clientTxn.category || 'General & Miscellaneous').trim();

  // Notes
  const notes = typeof clientTxn.notes === 'string' ? clientTxn.notes.trim() : '';

  // Created at timestamp
  const created_at = clientTxn.createdAt || clientTxn.created_at || new Date().toISOString();

  // Return Supabase DB row (id is omitted so Supabase generates a native UUID)
  return {
    user_id: userId.trim(),
    title,
    transaction_date,
    amount,
    type,
    category,
    notes,
    created_at
  };
}

/**
 * Converts a Supabase database row into a complete frontend transaction object.
 *
 * @param {object} row - Supabase database row
 * @param {object|null} [existingLocalTxn=null] - Optional matching local transaction to preserve custom user attributes
 * @returns {object} Frontend transaction model
 * @throws {Error} If database row is missing primary key or critical fields
 */
export function fromSupabaseTransactionRow(row, existingLocalTxn = null) {
  if (!row || typeof row !== 'object') {
    throw new Error('[transactionAdapter] Invalid database row: input must be an object.');
  }

  if (!row.id) {
    throw new Error('[transactionAdapter] Database row missing primary key "id".');
  }

  const id = String(row.id);

  // Description / Title
  const description = (row.title || row.description || '').trim();
  if (!description) {
    throw new Error(`[transactionAdapter] Database row #${id} missing title/description.`);
  }

  // Date
  const dateStr = (row.transaction_date || row.date || '').trim();
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    throw new Error(`[transactionAdapter] Database row #${id} has invalid transaction_date: "${dateStr}".`);
  }
  const date = dateStr.slice(0, 10);

  // Amount validation: Strictly positive, numeric, finite
  const rawAmount = row.amount;
  const numAmount = typeof rawAmount === 'number' ? rawAmount : parseFloat(rawAmount);
  if (typeof numAmount !== 'number' || isNaN(numAmount) || !isFinite(numAmount)) {
    throw new Error(`[transactionAdapter] Database row #${id} has invalid amount: "${rawAmount}".`);
  }
  if (numAmount <= 0) {
    throw new Error(`[transactionAdapter] Database row #${id} has non-positive amount: ${numAmount}. Expected amount > 0.`);
  }
  const amount = Math.round((numAmount + Number.EPSILON) * 100) / 100;

  // Type validation: Strictly 'income' or 'expense'
  const rawType = row.type;
  if (rawType !== 'income' && rawType !== 'expense') {
    throw new Error(`[transactionAdapter] Database row #${id} has invalid type: "${rawType}". Expected "income" or "expense".`);
  }
  const type = rawType;

  // Category
  const category = (row.category || 'General & Miscellaneous').trim();

  // Nature resolution:
  // 1. If an existing local transaction exists with a custom nature, NEVER overwrite it.
  // 2. If row has a nature field (future-proofed for DB schema changes), use row.nature.
  // 3. Fallback: infer from canonical DEFAULT_CATEGORIES.
  // 4. Unknown category fallback: 'income' if type === 'income', or 'want' if type === 'expense'.
  let nature;
  if (existingLocalTxn && typeof existingLocalTxn.nature === 'string' && existingLocalTxn.nature.trim()) {
    nature = existingLocalTxn.nature.trim().toLowerCase();
  } else if (typeof row.nature === 'string' && row.nature.trim()) {
    nature = row.nature.trim().toLowerCase();
  } else {
    const matchedCategory = DEFAULT_CATEGORIES.find(
      (c) => c.name.toLowerCase() === category.toLowerCase()
    );
    if (matchedCategory && matchedCategory.defaultNature) {
      nature = matchedCategory.defaultNature;
    } else {
      nature = type === 'income' ? 'income' : 'want';
    }
  }

  // Payment Method resolution:
  // 1. If existing local transaction has paymentMethod, preserve it.
  // 2. If row has payment_method or paymentMethod, use it.
  // 3. Neutral fallback: '' (empty string, handled gracefully without breaking UI).
  let paymentMethod = '';
  if (existingLocalTxn && typeof existingLocalTxn.paymentMethod === 'string' && existingLocalTxn.paymentMethod.trim()) {
    paymentMethod = existingLocalTxn.paymentMethod.trim();
  } else if (typeof row.payment_method === 'string' && row.payment_method.trim()) {
    paymentMethod = row.payment_method.trim();
  } else if (typeof row.paymentMethod === 'string' && row.paymentMethod.trim()) {
    paymentMethod = row.paymentMethod.trim();
  }

  // Notes
  const notes = typeof row.notes === 'string' ? row.notes.trim() : '';

  // Created at timestamp
  const createdAt = row.created_at || row.createdAt || new Date().toISOString();

  // Stable fingerprint
  const hash = generateTransactionHash({ date, amount, description, type });

  return {
    id,
    date,
    description,
    amount,
    type,
    category,
    nature,
    paymentMethod,
    notes,
    source: 'supabase',
    hash,
    createdAt
  };
}

/**
 * Converts an array of frontend transactions to Supabase rows.
 */
export function batchToSupabaseTransactionRows(clientTxnsList, userId) {
  if (!Array.isArray(clientTxnsList)) return [];
  return clientTxnsList.map((t) => toSupabaseTransactionRow(t, userId));
}

/**
 * Converts an array of Supabase rows to frontend transactions.
 */
export function batchFromSupabaseTransactionRows(rowsList, existingLocalTxnsMap = null) {
  if (!Array.isArray(rowsList)) return [];
  return rowsList.map((row) => {
    const existing = existingLocalTxnsMap ? existingLocalTxnsMap.get(String(row.id)) || existingLocalTxnsMap.get(row.title) : null;
    return fromSupabaseTransactionRow(row, existing);
  });
}
