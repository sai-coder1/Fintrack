/**
 * SpendSense — Stable Duplicate Detection Engine
 *
 * Produces deterministic fingerprints to detect identical transactions
 * across existing stored records and within the incoming batch.
 */

/**
 * Normalizes a transaction description to create a stable merchant fingerprint.
 * Removes transaction IDs, dates, special characters, and excess whitespace.
 * e.g., "UPI/123456/Swiggy Bangalore/01-10-26" -> "swiggybangalore"
 * @param {string} description
 * @returns {string}
 */
export function normalizeDescriptionForHash(description) {
  if (!description || typeof description !== 'string') return '';
  return description
    .toLowerCase()
    .replace(/^upi\/\d+\//i, '')
    .replace(/^pos\/\d+\//i, '')
    .replace(/^neft\/\d+\//i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Generates a stable composite fingerprint hash for a transaction.
 * @param {object} param
 * @param {string} param.date - YYYY-MM-DD
 * @param {number} param.amount - strictly positive number
 * @param {string} param.description
 * @param {string} [param.type] - 'expense' | 'income'
 * @returns {string}
 */
export function generateTransactionHash({ date, amount, description, type = 'expense' }) {
  const normDate = String(date || '').trim();
  const normAmount = Math.abs(Number(amount) || 0).toFixed(2);
  const normDesc = normalizeDescriptionForHash(description);
  const normType = type === 'income' ? 'cr' : 'dr';
  return `${normDate}_${normAmount}_${normType}_${normDesc}`;
}

/**
 * Analyzes a batch of normalized candidate rows against existing transactions
 * and detects duplicates both against storage and within the batch.
 *
 * @param {Array<object>} candidateRows - Array of normalized preview rows
 * @param {Array<object>} existingTransactions - Stored transactions in database
 * @returns {Array<object>} Rows augmented with isDuplicate, duplicateReason, and duplicateSource
 */
export function detectBatchDuplicates(candidateRows, existingTransactions = []) {
  if (!Array.isArray(candidateRows)) return [];

  // Build lookup index of existing transactions
  const existingHashMap = new Map();
  (existingTransactions || []).forEach((t) => {
    if (!t) return;
    const computedHash = generateTransactionHash(t);
    existingHashMap.set(computedHash, t);
    if (t.hash) {
      existingHashMap.set(t.hash, t);
    }
  });

  // Track seen hashes within the current file batch
  const batchSeenMap = new Map();

  return candidateRows.map((row, index) => {
    const hash = generateTransactionHash(row);
    let isDuplicate = false;
    let duplicateReason = '';
    let duplicateSource = null;

    if (existingHashMap.has(hash)) {
      const existing = existingHashMap.get(hash);
      isDuplicate = true;
      duplicateSource = 'existing';
      duplicateReason = `Matches existing ledger entry "${existing.description}" on ${existing.date}`;
    } else if (batchSeenMap.has(hash)) {
      const prevIndex = batchSeenMap.get(hash);
      isDuplicate = true;
      duplicateSource = 'batch';
      duplicateReason = `Duplicate of row #${prevIndex + 1} within this CSV file`;
    } else {
      batchSeenMap.set(hash, index);
    }

    return {
      ...row,
      hash,
      isDuplicate,
      duplicateReason,
      duplicateSource,
      // Default: skip duplicates unless user explicitly checks them
      selected: row.selected !== undefined ? row.selected : !isDuplicate
    };
  });
}
