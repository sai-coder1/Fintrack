/**
 * SpendSense — Currency & Date Formatters
 * Formats all monetary figures in Indian Rupees (INR) and handles readable dates.
 */

/**
 * Formats a number to Indian Rupee currency format (e.g., ₹24,500.00 or ₹24,500).
 * @param {number|string} amount
 * @param {boolean} [showDecimals=true]
 * @returns {string} Formatted INR currency string
 */
export function formatINR(amount, showDecimals = true) {
  const numeric = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(numeric)) return '₹0.00';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0
  }).format(numeric);
}

/**
 * Formats an ISO date string (YYYY-MM-DD) into a human-readable string (e.g., "18 Oct 2026").
 * @param {string} dateString
 * @returns {string}
 */
export function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const [year, month, day] = dateString.split('-');
    if (!year || !month || !day) return dateString;
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Formats a ratio or percentage number (e.g. 0.42 or 42) into a percentage string "42.0%".
 * @param {number} value
 * @param {boolean} [isFraction=false]
 * @returns {string}
 */
export function formatPercentage(value, isFraction = false) {
  const numeric = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(numeric)) return '0%';
  const finalValue = isFraction ? numeric * 100 : numeric;
  return `${finalValue.toFixed(1)}%`;
}
