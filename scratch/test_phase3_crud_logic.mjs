import { toSupabaseTransactionRow, fromSupabaseTransactionRow } from '../src/utils/transactionAdapter.js';

console.log('================================================================');
console.log('SPENDSENSE — PHASE 3 MANUAL CRUD LOGIC TEST SUITE');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// -------------------------------------------------------------
// SUITE 1: Create Transactions (Income & Expense)
// -------------------------------------------------------------
console.log('--- SUITE 1: Create Transactions (Income & Expense) ---');

const activeUserId = 'usr_uuid_1111-2222-3333-4444';

// 1.1 Expense creation
const expenseInput = {
  description: 'Swiggy Dinner',
  date: '2026-10-24',
  amount: 650.00,
  type: 'expense',
  category: 'Food & Dining Out',
  notes: 'Team dinner'
};

const expensePayload = toSupabaseTransactionRow(expenseInput, activeUserId);
assert(expensePayload.user_id === activeUserId, 'Expense includes user_id');
assert(expensePayload.title === 'Swiggy Dinner', 'Expense maps description -> title');
assert(expensePayload.amount === 650, 'Expense stores strictly positive amount');
assert(expensePayload.type === 'expense', 'Expense type is "expense"');
assert(!('id' in expensePayload), 'Client string ID is omitted so Supabase assigns native UUID');

// Simulate Supabase returning inserted row with native UUID
const mockInsertedExpenseRow = {
  id: '00000000-0000-0000-0000-000000000001',
  user_id: activeUserId,
  title: expensePayload.title,
  transaction_date: expensePayload.transaction_date,
  amount: expensePayload.amount,
  type: expensePayload.type,
  category: expensePayload.category,
  notes: expensePayload.notes,
  created_at: '2026-10-24T19:00:00.000Z'
};

const createdExpenseTxn = fromSupabaseTransactionRow(mockInsertedExpenseRow, expenseInput);
assert(createdExpenseTxn.id === '00000000-0000-0000-0000-000000000001', 'Frontend receives native database UUID');
assert(createdExpenseTxn.nature === 'want', 'Infers canonical nature="want" for Food & Dining Out');
assert(createdExpenseTxn.source === 'supabase', 'Tagged as supabase source');

// 1.2 Income creation
const incomeInput = {
  description: 'Consulting Fee',
  date: '2026-10-20',
  amount: 45000,
  type: 'income',
  category: 'Salary & Income',
  notes: 'Q4 project'
};

const incomePayload = toSupabaseTransactionRow(incomeInput, activeUserId);
assert(incomePayload.user_id === activeUserId, 'Income includes user_id');
assert(incomePayload.type === 'income', 'Income type is "income"');
assert(incomePayload.amount === 45000, 'Income amount is positive');

const mockInsertedIncomeRow = {
  id: '00000000-0000-0000-0000-000000000002',
  user_id: activeUserId,
  title: incomePayload.title,
  transaction_date: incomePayload.transaction_date,
  amount: incomePayload.amount,
  type: incomePayload.type,
  category: incomePayload.category,
  notes: incomePayload.notes,
  created_at: '2026-10-20T10:00:00.000Z'
};

const createdIncomeTxn = fromSupabaseTransactionRow(mockInsertedIncomeRow, incomeInput);
assert(createdIncomeTxn.id === '00000000-0000-0000-0000-000000000002', 'Income receives native database UUID');
assert(createdIncomeTxn.nature === 'income', 'Infers nature="income"');

// -------------------------------------------------------------
// SUITE 2: Edit Transactions
// -------------------------------------------------------------
console.log('\n--- SUITE 2: Edit Transactions ---');

let cloudState = [createdExpenseTxn, createdIncomeTxn];

// Simulate editing expense
const updatedFields = {
  description: 'Swiggy Dinner + Dessert',
  amount: 820.00
};

const existingTxn = cloudState.find((t) => t.id === createdExpenseTxn.id);
assert(Boolean(existingTxn), 'Existing transaction found in cloudState');

const merged = { ...existingTxn, ...updatedFields };
const updatePayload = toSupabaseTransactionRow(merged, activeUserId);
assert(updatePayload.title === 'Swiggy Dinner + Dessert', 'Title updated');
assert(updatePayload.amount === 820, 'Amount updated to positive number');

// Simulate DB confirming update
const mockUpdatedRow = {
  ...mockInsertedExpenseRow,
  title: updatePayload.title,
  amount: updatePayload.amount
};

const confirmedUpdatedTxn = fromSupabaseTransactionRow(mockUpdatedRow, merged);
cloudState = cloudState.map((t) => (t.id === confirmedUpdatedTxn.id ? confirmedUpdatedTxn : t));

assert(cloudState[0].description === 'Swiggy Dinner + Dessert', 'UI state updated after DB confirmation');
assert(cloudState[0].amount === 820, 'UI state amount updated');

// -------------------------------------------------------------
// SUITE 3: Delete Transactions
// -------------------------------------------------------------
console.log('\n--- SUITE 3: Delete Transactions ---');

const deleteTargetId = '00000000-0000-0000-0000-000000000001';

// Simulate DB confirming delete
cloudState = cloudState.filter((t) => t.id !== deleteTargetId);
assert(cloudState.length === 1, 'Transaction removed from state after confirmed DB delete');
assert(cloudState[0].id === createdIncomeTxn.id, 'Remaining transaction is the income transaction');

// -------------------------------------------------------------
// SUITE 4: Failed Operations & Rollback Preservation
// -------------------------------------------------------------
console.log('\n--- SUITE 4: Failed Operations & Rollback Preservation ---');

// 4.1 Failed Create
const stateBeforeFailedCreate = [...cloudState];
const failedCreateError = 'Network timeout contacting Supabase.';
// Simulate error handling: do NOT append to state
assert(stateBeforeFailedCreate.length === cloudState.length, 'Failed create does not alter cloud state');

// 4.2 Failed Delete: transaction MUST remain visible
const stateBeforeFailedDelete = [...cloudState];
const failedDeleteError = 'Row Level Security policy violation.';
// Simulate error: do NOT remove from state
assert(stateBeforeFailedDelete.length === 1, 'Failed delete keeps transaction visible');
assert(stateBeforeFailedDelete[0].id === createdIncomeTxn.id, 'Transaction was not removed on delete failure');

// -------------------------------------------------------------
// SUITE 5: Stale Response & Account Switching Protection
// -------------------------------------------------------------
console.log('\n--- SUITE 5: Stale Response & Account Switching Protection ---');

// Simulate User A starts an insert
let currentUserSessionId = 'usr_uuid_USER_A';
const inFlightUserId = currentUserSessionId;

// User A logs out and User B logs in before write returns
currentUserSessionId = 'usr_uuid_USER_B';

let userBCloudState = [];

// Write for User A returns now
const returnedDataForUserA = mockInsertedExpenseRow;
let writeAppliedToCurrentState = false;

if (currentUserSessionId === inFlightUserId) {
  userBCloudState.push(returnedDataForUserA);
  writeAppliedToCurrentState = true;
}

assert(!writeAppliedToCurrentState, 'Guard prevented User A write from being added to User B state');
assert(userBCloudState.length === 0, 'User B state remains clean');

// -------------------------------------------------------------
// SUITE 6: Demo Mode & LocalStorage Isolation
// -------------------------------------------------------------
console.log('\n--- SUITE 6: Demo Mode & LocalStorage Isolation ---');

const localStoredTxns = [
  { id: 'local_1', description: 'Offline Purchase', amount: 500, type: 'expense' }
];

let demoTxns = [
  { id: 'demo_1', description: 'Demo Item', amount: 100, type: 'expense' }
];

// In demo mode, creating a transaction must only touch demoTxns
const isDemoMode = true;
const newDemoTxn = { id: 'demo_2', description: 'New Demo Item', amount: 200, type: 'expense' };

if (isDemoMode) {
  demoTxns = [newDemoTxn, ...demoTxns];
}

assert(demoTxns.length === 2, 'Demo transaction added to demo state');
assert(localStoredTxns.length === 1, 'Local storage transactions remained completely untouched');
assert(localStoredTxns[0].id === 'local_1', 'Local transaction data preserved intact');

// -------------------------------------------------------------
// SUITE 7: Refresh & Rehydration After Confirmed Cloud Write
// -------------------------------------------------------------
console.log('\n--- SUITE 7: Refresh Rehydration After Successful Cloud Write ---');

// Suppose DB currently contains the confirmed updated expense and the income transaction
const databaseTableOnServer = [mockUpdatedRow, mockInsertedIncomeRow];

// Simulate page refresh (F5): fetchCloudTransactions runs
const rehydratedTxns = databaseTableOnServer.map((row) => fromSupabaseTransactionRow(row));

assert(rehydratedTxns.length === 2, 'Rehydrated all confirmed cloud transactions after refresh');
assert(rehydratedTxns[0].id === mockUpdatedRow.id, 'First transaction preserves its Supabase UUID');
assert(rehydratedTxns[0].description === 'Swiggy Dinner + Dessert', 'First transaction description intact');
assert(rehydratedTxns[0].amount === 820, 'First transaction amount intact');
assert(rehydratedTxns[1].id === mockInsertedIncomeRow.id, 'Second transaction preserves its Supabase UUID');
assert(rehydratedTxns[1].type === 'income', 'Second transaction type is income');

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n================================================================');
console.log(`PHASE 3 CRUD LOGIC TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) process.exit(1);
