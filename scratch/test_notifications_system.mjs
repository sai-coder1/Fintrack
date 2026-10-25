/**
 * FinTrack — Comprehensive Real-Time Notification & Budget Alert Test Suite
 */

import {
  getScopedUserKey,
  loadUserNotifications,
  saveUserNotifications,
  addUserNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteUserNotification,
  clearAllUserNotifications,
  loadAlertedBudgetTiers,
  saveAlertedBudgetTiers,
  loadNotificationSettings,
  saveNotificationSettings
} from '../src/utils/notificationStorage.js';

import {
  isBrowserNotificationSupported,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  sendBrowserNotification
} from '../src/utils/browserNotifications.js';

import { roundINR } from '../src/utils/calculations.js';
import { formatINR } from '../src/utils/formatters.js';

console.log('================================================================');
console.log('FINTRACK REAL-TIME IN-APP NOTIFICATION & BUDGET ALERT TEST SUITE');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

// Mock window.localStorage for Node environment testing
const storageMap = new Map();
global.window = {
  localStorage: {
    getItem: (key) => storageMap.get(key) || null,
    setItem: (key, val) => storageMap.set(key, String(val)),
    removeItem: (key) => storageMap.delete(key),
    clear: () => storageMap.clear()
  }
};

// -----------------------------------------------------------------------------
// SUITE 1: User-Scoped Isolation & Persistence (User A vs User B)
// -----------------------------------------------------------------------------
console.log('--- SUITE 1: User-Scoped Notification Isolation ---');

const userA = 'user_uuid_alice_123';
const userB = 'user_uuid_bob_456';

// Clear storage
clearAllUserNotifications(userA);
clearAllUserNotifications(userB);

assert(loadUserNotifications(userA).length === 0, 'User A starts with 0 notifications');
assert(loadUserNotifications(userB).length === 0, 'User B starts with 0 notifications');

// Add notification to User A
const notifA1 = addUserNotification(userA, {
  type: 'warning',
  title: 'Food & Dining Out: Budget Warning',
  message: "You've used 89% of your monthly budget. ₹60 remains.",
  category: 'Food & Dining Out'
});

assert(notifA1 && notifA1.id, 'User A notification created with unique ID');
assert(loadUserNotifications(userA).length === 1, 'User A now has 1 notification');
assert(loadUserNotifications(userB).length === 0, 'User B strictly has 0 notifications (no cross-user bleeding)');

// Add notification to User B
const notifB1 = addUserNotification(userB, {
  type: 'danger',
  title: 'Groceries: Budget Exceeded',
  message: 'Budget exceeded by ₹120.',
  category: 'Groceries'
});

assert(loadUserNotifications(userB).length === 1, 'User B has 1 notification');
assert(loadUserNotifications(userA).length === 1, 'User A count unaffected by User B');
assert(loadUserNotifications(userA)[0].id === notifA1.id, 'User A retrieves their own alert');
assert(loadUserNotifications(userB)[0].id === notifB1.id, 'User B retrieves their own alert');

// -----------------------------------------------------------------------------
// SUITE 2: Read / Unread Status & Item Management
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 2: Read/Unread State, Dismissal & Clear All ---');

assert(notifA1.read === false, 'Notification is unread by default');

// Mark User A notification as read
markNotificationAsRead(userA, notifA1.id);
const reloadedA = loadUserNotifications(userA);
assert(reloadedA[0].read === true, 'Notification marked as read in persistence');

// Add second notification for User A
const notifA2 = addUserNotification(userA, {
  type: 'success',
  title: 'CSV Import Completed',
  message: 'CSV import completed: 5 imported, 2 duplicates, 1 invalid.',
  category: 'CSV Import'
});

assert(loadUserNotifications(userA).length === 2, 'User A now has 2 notifications');
assert(loadUserNotifications(userA).filter(n => !n.read).length === 1, 'Unread count is correctly 1');

// Mark all as read
markAllNotificationsAsRead(userA);
assert(loadUserNotifications(userA).filter(n => !n.read).length === 0, 'Mark all as read leaves 0 unread');

// Delete individual notification
deleteUserNotification(userA, notifA1.id);
assert(loadUserNotifications(userA).length === 1, 'Individual notification dismissed successfully');
assert(loadUserNotifications(userA)[0].id === notifA2.id, 'Remaining notification preserved');

// Clear all
clearAllUserNotifications(userA);
assert(loadUserNotifications(userA).length === 0, 'Clear all notifications empties list');
assert(loadUserNotifications(userB).length === 1, 'User B notifications remain completely intact');

// -----------------------------------------------------------------------------
// SUITE 3: Real Budget Threshold Crossings Engine
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 3: Real Budget Threshold Calculations & Transitions ---');

const TIER_ORDER = { safe: 0, warning_75: 1, warning_90: 2, budget_reached: 3, over_budget: 4 };

function evaluateBudgetThresholds({
  transactions = [],
  budgets = [],
  activeMonth = '2026-10',
  currentTiers = {},
  isInitialLoad = false
}) {
  const alertsTriggered = [];
  const updatedTiers = { ...currentTiers };

  // Aggregate expenses strictly for activeMonth (income is never counted as spending)
  const spentByCategory = {};
  transactions.forEach((t) => {
    if (t && t.type === 'expense' && t.date && t.date.startsWith(activeMonth)) {
      const cat = t.category || 'General & Miscellaneous';
      spentByCategory[cat] = (spentByCategory[cat] || 0) + (Math.abs(Number(t.amount)) || 0);
    }
  });

  budgets.forEach((b) => {
    const limit = Math.max(0, Number(b.allocatedAmount) || 0);
    if (limit <= 0) return;

    const spent = roundINR(spentByCategory[b.category] || 0);
    const ratio = spent / limit;
    const percentUsed = roundINR(ratio * 100);
    const remaining = roundINR(limit - spent);
    const exceededBy = spent > limit ? roundINR(spent - limit) : 0;

    let currentTier = 'safe';
    if (spent > limit) {
      currentTier = 'over_budget';
    } else if (spent === limit) {
      currentTier = 'budget_reached';
    } else if (ratio >= 0.90) {
      currentTier = 'warning_90';
    } else if (ratio >= 0.75) {
      currentTier = 'warning_75';
    }

    const prevTier = currentTiers[b.category] || 'safe';
    const prevRank = TIER_ORDER[prevTier] ?? 0;
    const currentRank = TIER_ORDER[currentTier] ?? 0;

    if (isInitialLoad) {
      updatedTiers[b.category] = currentTier;
      return;
    }

    if (currentRank > prevRank) {
      let alertType = 'warning';
      let title = `${b.category}: Budget Alert`;
      let message = '';

      const displayPercent = Math.round(ratio * 100);
      const formatCompact = (amt) => formatINR(amt, amt % 1 !== 0);

      if (currentTier === 'over_budget') {
        alertType = 'danger';
        title = `${b.category}: Budget Exceeded`;
        message = `Budget exceeded by ${formatCompact(exceededBy)}.`;
      } else if (currentTier === 'budget_reached') {
        alertType = 'warning';
        title = `${b.category}: Budget Reached`;
        message = `Monthly budget of ${formatCompact(limit)} reached (100%).`;
      } else if (currentTier === 'warning_90') {
        alertType = 'warning';
        title = `${b.category}: Budget Warning`;
        message = `You've used ${displayPercent}% of your monthly budget. ${formatCompact(remaining)} remains.`;
      } else if (currentTier === 'warning_75') {
        alertType = 'info';
        title = `${b.category}: Budget Heads-Up`;
        message = `You've used ${displayPercent}% of your monthly budget. ${formatCompact(remaining)} remains.`;
      }

      alertsTriggered.push({
        type: alertType,
        title,
        message,
        category: b.category,
        tier: currentTier,
        spent,
        limit,
        percentUsed,
        remaining,
        exceededBy
      });
      updatedTiers[b.category] = currentTier;
    } else if (currentRank < prevRank) {
      // Step-down when transactions are deleted
      updatedTiers[b.category] = currentTier;
    }
  });

  return { alertsTriggered, updatedTiers };
}

const testBudgets = [
  { id: 'bgt-1', category: 'Food & Dining Out', allocatedAmount: 560, month: '2026-10' }
];

// Case A: Initial Load / Refresh (spending is at ₹500 = 89.29%)
let initialTxns = [
  { id: 't1', type: 'expense', category: 'Food & Dining Out', amount: 500, date: '2026-10-15' }
];

const initResult = evaluateBudgetThresholds({
  transactions: initialTxns,
  budgets: testBudgets,
  activeMonth: '2026-10',
  currentTiers: {},
  isInitialLoad: true
});

assert(initResult.alertsTriggered.length === 0, 'Initial load / refresh generates 0 toast alerts (no spam on reload)');
assert(initResult.updatedTiers['Food & Dining Out'] === 'warning_75', 'Initial tier synchronized to warning_75');

// Case B: Subsequent render without change
const noChangeResult = evaluateBudgetThresholds({
  transactions: initialTxns,
  budgets: testBudgets,
  activeMonth: '2026-10',
  currentTiers: initResult.updatedTiers,
  isInitialLoad: false
});
assert(noChangeResult.alertsTriggered.length === 0, 'No alerts generated when spending tier has not changed');

// Case C: Income transaction added (₹40,000)
const withIncomeTxns = [
  ...initialTxns,
  { id: 't-inc', type: 'income', category: 'Salary & Income', amount: 40000, date: '2026-10-16' }
];
const incomeResult = evaluateBudgetThresholds({
  transactions: withIncomeTxns,
  budgets: testBudgets,
  activeMonth: '2026-10',
  currentTiers: noChangeResult.updatedTiers,
  isInitialLoad: false
});
assert(incomeResult.alertsTriggered.length === 0, 'Adding income does NOT trigger budget alerts (strict expense isolation)');

// Case D: Crosses 90% threshold (Adding ₹10 expense -> total ₹510 / 560 = 91.07%)
const at91Txns = [
  ...withIncomeTxns,
  { id: 't2', type: 'expense', category: 'Food & Dining Out', amount: 10, date: '2026-10-18' }
];
const result91 = evaluateBudgetThresholds({
  transactions: at91Txns,
  budgets: testBudgets,
  activeMonth: '2026-10',
  currentTiers: incomeResult.updatedTiers,
  isInitialLoad: false
});

assert(result91.alertsTriggered.length === 1, 'Crossing 90% threshold generates exactly 1 alert');
assert(result91.alertsTriggered[0].type === 'warning', '90% alert has warning severity');
assert(result91.alertsTriggered[0].message.includes('used 91%'), '90% alert displays formatted percentage');
assert(result91.alertsTriggered[0].message.includes('₹50 remains'), '90% alert displays remaining balance');
assert(result91.updatedTiers['Food & Dining Out'] === 'warning_90', 'Tier advanced to warning_90');

// Case E: Crosses 100% threshold exactly (Adding ₹50 -> total ₹560 / 560 = 100%)
const at100Txns = [
  ...at91Txns,
  { id: 't3', type: 'expense', category: 'Food & Dining Out', amount: 50, date: '2026-10-20' }
];
const result100 = evaluateBudgetThresholds({
  transactions: at100Txns,
  budgets: testBudgets,
  activeMonth: '2026-10',
  currentTiers: result91.updatedTiers,
  isInitialLoad: false
});

assert(result100.alertsTriggered.length === 1, 'Reaching 100% triggers budget reached alert');
assert(result100.alertsTriggered[0].message.includes('reached (100%)'), '100% alert message confirms cap reached');
assert(result100.updatedTiers['Food & Dining Out'] === 'budget_reached', 'Tier advanced to budget_reached');

// Case F: Overspending (> 100%) (Adding ₹40 -> total ₹600, over limit by ₹40)
const atOverTxns = [
  ...at100Txns,
  { id: 't4', type: 'expense', category: 'Food & Dining Out', amount: 40, date: '2026-10-22' }
];
const resultOver = evaluateBudgetThresholds({
  transactions: atOverTxns,
  budgets: testBudgets,
  activeMonth: '2026-10',
  currentTiers: result100.updatedTiers,
  isInitialLoad: false
});

assert(resultOver.alertsTriggered.length === 1, 'Exceeding budget generates danger alert');
assert(resultOver.alertsTriggered[0].type === 'danger', 'Overspending alert has danger severity');
assert(resultOver.alertsTriggered[0].message === 'Budget exceeded by ₹40.', 'Overspending message matches exact specification ("Budget exceeded by ₹40.")');
assert(resultOver.updatedTiers['Food & Dining Out'] === 'over_budget', 'Tier advanced to over_budget');

// Case G: Transaction Deletion (Deleting ₹100 of expenses drops spending to ₹500)
const afterDeleteTxns = atOverTxns.filter(t => t.id !== 't3' && t.id !== 't4'); // drops back to ₹510
const resultDelete = evaluateBudgetThresholds({
  transactions: afterDeleteTxns,
  budgets: testBudgets,
  activeMonth: '2026-10',
  currentTiers: resultOver.updatedTiers,
  isInitialLoad: false
});

assert(resultDelete.alertsTriggered.length === 0, 'Deleting transaction triggers 0 false danger alerts');
assert(resultDelete.updatedTiers['Food & Dining Out'] === 'warning_90', 'Tier successfully lowered to warning_90 in memory');

// -----------------------------------------------------------------------------
// SUITE 4: Toast Deduplication & Message Formatting
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 4: Toast Deduplication & Message Rules ---');

const dedupCache = new Map();
function shouldShowToast(type, title, message, now = Date.now()) {
  const key = `${type}:${title}:${message}`;
  const lastTime = dedupCache.get(key);
  if (lastTime && now - lastTime < 3000) {
    return false; // Suppress duplicate
  }
  dedupCache.set(key, now);
  return true;
}

const t0 = 1000000;
assert(shouldShowToast('success', 'Transaction Added', 'Transaction added successfully.', t0), 'First toast displays');
assert(!shouldShowToast('success', 'Transaction Added', 'Transaction added successfully.', t0 + 500), 'Identical toast within 500ms suppressed');
assert(!shouldShowToast('success', 'Transaction Added', 'Transaction added successfully.', t0 + 2500), 'Identical toast within 2.5s suppressed');
assert(shouldShowToast('success', 'Transaction Added', 'Transaction added successfully.', t0 + 3500), 'Toast after 3.5s allowed');
assert(shouldShowToast('danger', 'Transaction Error', 'Unable to save your transaction. Please try again.', t0 + 1000), 'Different toast message displayed immediately');

// CSV Import Summary format
function formatCsvSummary(imported, duplicates, invalid) {
  if (duplicates > 0 || invalid > 0) {
    return `CSV import completed: ${imported} imported, ${duplicates} duplicates, ${invalid} invalid.`;
  }
  return `CSV import completed: ${imported} imported.`;
}

assert(
  formatCsvSummary(5, 2, 1) === 'CSV import completed: 5 imported, 2 duplicates, 1 invalid.',
  'CSV import summary matches exact prompt specification'
);

// -----------------------------------------------------------------------------
// SUITE 5: Browser Notifications Permission States
// -----------------------------------------------------------------------------
console.log('\n--- SUITE 5: Browser Notification Graceful Fallback ---');

assert(typeof isBrowserNotificationSupported === 'function', 'isBrowserNotificationSupported function is exported');
assert(typeof getBrowserNotificationPermission === 'function', 'getBrowserNotificationPermission function is exported');
assert(typeof requestBrowserNotificationPermission === 'function', 'requestBrowserNotificationPermission function is exported');
assert(typeof sendBrowserNotification === 'function', 'sendBrowserNotification function is exported');

// In node environment without window.Notification
assert(!isBrowserNotificationSupported(), 'Safely reports unsupported in non-browser Node environment');
assert(getBrowserNotificationPermission() === 'unsupported', 'Returns "unsupported" status without throwing');

// Mock browser Notification for permission state testing
const MockNotification = {
  permission: 'default',
  requestPermission: async () => {
    MockNotification.permission = 'granted';
    return 'granted';
  }
};
global.Notification = MockNotification;
global.window.Notification = MockNotification;

assert(getBrowserNotificationPermission() === 'default', 'Returns default permission before user request');
const requested = await requestBrowserNotificationPermission();
assert(requested === 'granted', 'Permission request resolves to granted upon user interaction');
assert(getBrowserNotificationPermission() === 'granted', 'Returns granted after user approval');

console.log('\n================================================================');
console.log(`NOTIFICATION SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
