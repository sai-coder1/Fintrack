/**
 * SpendSense — Robust CSV Bank Statement Parser
 *
 * Uses Papa Parse for client-side streaming and parsing.
 * Supports flexible column mapping, date normalization (DD/MM/YYYY, YYYY-MM-DD, DD-MMM-YYYY),
 * dual Debit/Credit columns, Indian currency notations, and auto-categorization.
 */

import Papa from 'papaparse';
import { DEFAULT_CATEGORIES } from '../data/defaultCategories.js';

/**
 * Fuzzy column auto-detection patterns for standard Indian and international banks.
 */
const COLUMN_PATTERNS = {
  date: [
    /^date$/i,
    /txn[_\s]?date/i,
    /transaction[_\s]?date/i,
    /value[_\s]?date/i,
    /posting[_\s]?date/i,
    /trans[_\s]?date/i
  ],
  description: [
    /narration/i,
    /description/i,
    /particulars/i,
    /remarks/i,
    /merchant/i,
    /transaction[_\s]?remarks/i,
    /details/i,
    /payee/i
  ],
  amount: [
    /^amount$/i,
    /txn[_\s]?amount/i,
    /transaction[_\s]?amount/i,
    /net[_\s]?amount/i,
    /^amt$/i
  ],
  debit: [
    /withdrawal/i,
    /debit/i,
    /^dr$/i,
    /dr[_\s]?amount/i,
    /debit[_\s]?amount/i
  ],
  credit: [
    /deposit/i,
    /credit/i,
    /^cr$/i,
    /cr[_\s]?amount/i,
    /credit[_\s]?amount/i
  ],
  type: [
    /^type$/i,
    /transaction[_\s]?type/i,
    /dr\/cr/i,
    /cr\/dr/i
  ],
  category: [
    /category/i,
    /tag/i,
    /expense[_\s]?type/i
  ]
};

/**
 * Detects the best matching column name from a list of headers.
 */
function findMatchingHeader(headers, regexPatterns) {
  for (const pattern of regexPatterns) {
    const match = headers.find((h) => pattern.test(String(h).trim()));
    if (match) return match;
  }
  return '';
}

/**
 * Analyzes parsed CSV headers and suggests default mapping configuration.
 *
 * @param {Array<string>} headers
 * @returns {object} Suggested mapping
 */
export function suggestColumnMapping(headers) {
  const dateCol = findMatchingHeader(headers, COLUMN_PATTERNS.date);
  const descCol = findMatchingHeader(headers, COLUMN_PATTERNS.description);
  const debitCol = findMatchingHeader(headers, COLUMN_PATTERNS.debit);
  const creditCol = findMatchingHeader(headers, COLUMN_PATTERNS.credit);
  const amountCol = findMatchingHeader(headers, COLUMN_PATTERNS.amount);
  const typeCol = findMatchingHeader(headers, COLUMN_PATTERNS.type);
  const categoryCol = findMatchingHeader(headers, COLUMN_PATTERNS.category);

  // If both debit and credit columns exist, prefer dual-column mode
  const isDualColumn = Boolean(debitCol && creditCol);

  return {
    dateCol: dateCol || headers[0] || '',
    descCol: descCol || headers[1] || '',
    amountMode: isDualColumn ? 'separate' : 'single', // 'separate' | 'single'
    amountCol: amountCol || (!isDualColumn ? debitCol || headers[2] || '' : ''),
    debitCol: debitCol || '',
    creditCol: creditCol || '',
    typeCol: typeCol || '',
    categoryCol: categoryCol || '',
    dateOrder: 'DD/MM/YYYY', // Standard for Indian banking
    signedConvention: 'negative_is_expense' // 'negative_is_expense' | 'positive_is_expense'
  };
}

/**
 * Parses raw text from a CSV file using Papa Parse.
 *
 * @param {File|string} fileOrContent
 * @returns {Promise<{ headers: Array<string>, rows: Array<object>, errors: Array<object> }>}
 */
export function parseCsvFile(fileOrContent) {
  return new Promise((resolve, reject) => {
    Papa.parse(fileOrContent, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        const headers = results.meta.fields || [];
        const rows = results.data || [];
        resolve({
          headers,
          rows,
          errors: results.errors || []
        });
      },
      error: (err) => {
        reject(err);
      }
    });
  });
}

/**
 * Cleans monetary string into a clean float value.
 * Strips '₹', 'INR', 'Rs.', commas, quotes, and handles (brackets) as negative.
 */
export function cleanMonetaryAmount(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  if (!str) return 0;

  // Handle accounting brackets: (1500) -> -1500
  let isNegative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1);
  }

  // Handle CR / DR suffixes
  if (/dr$/i.test(str)) {
    isNegative = true;
    str = str.replace(/dr$/i, '');
  } else if (/cr$/i.test(str)) {
    str = str.replace(/cr$/i, '');
  }

  // Strip currency symbols, commas, and whitespace
  str = str.replace(/[₹$€£\s,]/g, '').replace(/inr|rs\.?/gi, '');

  let num = parseFloat(str);
  if (isNaN(num)) return 0;
  if (isNegative && num > 0) num = -num;

  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Parses and normalizes diverse date representations into standard ISO YYYY-MM-DD.
 * Supports DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY, DD-MMM-YYYY.
 *
 * @param {string} rawDate
 * @param {string} dateOrder - 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'
 * @returns {{ date: string, isValid: boolean, error?: string }}
 */
export function parseAndNormalizeDate(rawDate, dateOrder = 'DD/MM/YYYY') {
  if (!rawDate || typeof rawDate !== 'string') {
    return { date: '', isValid: false, error: 'Empty date field' };
  }

  const str = rawDate.trim();

  // 1. Direct ISO match: YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return {
        date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        isValid: true
      };
    }
  }

  // 2. Named month match: e.g. 18-Oct-2026, 18 Oct 2026, 18/Oct/2026
  const MONTH_MAP = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };
  const namedMatch = str.match(/^(\d{1,2})[-/\s.]([a-zA-Z]{3,9})[-/\s.](\d{2,4})/);
  if (namedMatch) {
    const d = parseInt(namedMatch[1], 10);
    const mStr = namedMatch[2].toLowerCase().slice(0, 3);
    let y = parseInt(namedMatch[3], 10);
    if (y < 100) y += 2000;
    const m = MONTH_MAP[mStr];
    if (m && d >= 1 && d <= 31) {
      return {
        date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        isValid: true
      };
    }
  }

  // 3. Delimited numeric: DD/MM/YYYY or MM/DD/YYYY
  const parts = str.split(/[-/.\s]/).filter(Boolean);
  if (parts.length >= 3) {
    let p1 = parseInt(parts[0], 10);
    let p2 = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (y < 100) y += 2000;

    let day, month;
    if (dateOrder === 'MM/DD/YYYY') {
      month = p1;
      day = p2;
    } else {
      // Default Indian convention: DD/MM/YYYY
      day = p1;
      month = p2;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        date: `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        isValid: true
      };
    }
  }

  return { date: '', isValid: false, error: `Unparseable date: "${str}"` };
}

/**
 * Evaluates transaction description against the predefined category keyword dictionary.
 */
export function autoAssignCategory(description, isIncome = false) {
  if (isIncome) {
    return {
      category: 'Salary & Income',
      nature: 'income'
    };
  }

  const desc = String(description || '').toLowerCase();

  for (const cat of DEFAULT_CATEGORIES) {
    if (cat.type === 'expense' && Array.isArray(cat.keywords)) {
      for (const kw of cat.keywords) {
        if (desc.includes(kw)) {
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
 * Normalizes and validates raw CSV rows into candidate transactions.
 *
 * @param {Array<object>} rawRows - Rows produced by Papa Parse
 * @param {object} mapping - User-selected column mapping
 * @returns {Array<object>} Array of preview candidate transactions with row validation flags
 */
export function normalizeCsvRows(rawRows, mapping) {
  if (!Array.isArray(rawRows)) return [];

  const {
    dateCol,
    descCol,
    amountMode,
    amountCol,
    debitCol,
    creditCol,
    typeCol,
    categoryCol,
    dateOrder,
    signedConvention
  } = mapping;

  return rawRows.map((row, idx) => {
    const rowIndex = idx + 1;
    const rawDate = row[dateCol] || '';
    const rawDesc = row[descCol] || '';

    // Date normalization
    const dateResult = parseAndNormalizeDate(rawDate, dateOrder);

    // Amount & Type determination
    let amount = 0;
    let type = 'expense';
    let amountError = null;

    if (amountMode === 'separate') {
      const debitRaw = cleanMonetaryAmount(row[debitCol]);
      const creditRaw = cleanMonetaryAmount(row[creditCol]);

      if (creditRaw > 0 && debitRaw === 0) {
        amount = creditRaw;
        type = 'income';
      } else if (debitRaw > 0 && creditRaw === 0) {
        amount = debitRaw;
        type = 'expense';
      } else if (debitRaw > 0 && creditRaw > 0) {
        // Both columns populated (edge case): take larger as net
        if (creditRaw > debitRaw) {
          amount = creditRaw - debitRaw;
          type = 'income';
        } else {
          amount = debitRaw - creditRaw;
          type = 'expense';
        }
      } else {
        amountError = 'Both debit and credit values are zero or blank';
      }
    } else {
      // Single amount column mode
      const rawAmtVal = cleanMonetaryAmount(row[amountCol]);
      if (rawAmtVal === 0) {
        amountError = 'Amount is zero or missing';
      } else {
        amount = Math.abs(rawAmtVal);
        // Check optional Type column first
        if (typeCol && row[typeCol]) {
          const typeStr = String(row[typeCol]).toLowerCase();
          if (/cr|credit|deposit|income/i.test(typeStr)) {
            type = 'income';
          } else {
            type = 'expense';
          }
        } else {
          // Use signed convention
          if (signedConvention === 'positive_is_expense') {
            type = rawAmtVal > 0 ? 'expense' : 'income';
          } else {
            // Default: negative is expense, positive is income
            type = rawAmtVal < 0 ? 'expense' : 'income';
          }
        }
      }
    }

    // Description validation
    const description = String(rawDesc).trim();
    let descError = null;
    if (!description) {
      descError = 'Description is empty';
    }

    // Category auto-assignment or mapping override
    let category = '';
    let nature = '';
    if (categoryCol && row[categoryCol]) {
      category = String(row[categoryCol]).trim();
      const matched = DEFAULT_CATEGORIES.find((c) => c.name === category);
      nature = matched ? matched.defaultNature : type === 'income' ? 'income' : 'want';
    } else {
      const autoCat = autoAssignCategory(description, type === 'income');
      category = autoCat.category;
      nature = autoCat.nature;
    }

    // Determine overall row validity
    const errors = [];
    if (!dateResult.isValid) errors.push(dateResult.error || 'Invalid date');
    if (amountError) errors.push(amountError);
    if (descError) errors.push(descError);

    const isValid = errors.length === 0;

    return {
      rowIndex,
      id: `import_row_${Date.now()}_${idx}`,
      date: dateResult.date || rawDate,
      description: description || 'Untitled Entry',
      amount: Math.round(amount * 100) / 100,
      type,
      category,
      nature,
      paymentMethod: 'Net Banking',
      source: 'csv_import',
      rawRow: row,
      isValid,
      errors,
      selected: isValid // Default select only valid rows
    };
  });
}
