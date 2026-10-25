/**
 * SpendSense — Fictional Account Aggregator (AA) Demo Dataset
 *
 * Provides realistic, fictional Indian banking statement data strictly for
 * hackathon demonstration and testing purposes.
 *
 * SAFETY & DISCLOSURE:
 * - 100% fictional test data.
 * - No real bank connection or live banking credentials.
 * - Strictly conforms to the aaTransactionAdapter normalized input contract:
 *   { date, narration, amount, direction, providerTransactionId, paymentMode, balance, bankName }
 */

export const MOCK_AA_ACCOUNTS = [
  {
    id: 'hdfc_salary',
    bankId: 'hdfc',
    bankName: 'HDFC Bank',
    accountName: 'HDFC Corporate Salary Account',
    accountNumberMasked: '•••• 4821',
    accountType: 'Savings / Salary',
    balance: 70399.50,
    statementPeriod: 'October 1 – October 25, 2026',
    transactions: [
      {
        date: '2026-10-01',
        narration: 'INFOSYS LTD SALARY CREDIT OCT 2026',
        amount: 75000.00,
        direction: 'CREDIT',
        providerTransactionId: 'AA-HDFC-TXN-101',
        paymentMode: 'NEFT',
        balance: 92450.00,
        bankName: 'HDFC Bank'
      },
      {
        date: '2026-10-03',
        narration: 'BLINKIT QUICK COMMERCE BANGALORE',
        amount: 1420.50,
        direction: 'DEBIT',
        providerTransactionId: 'AA-HDFC-TXN-102',
        paymentMode: 'UPI',
        balance: 91029.50,
        bankName: 'HDFC Bank'
      },
      {
        date: '2026-10-05',
        narration: 'BESCOM ELECTRICITY BILL BANGALORE',
        amount: 2850.00,
        direction: 'DEBIT',
        providerTransactionId: 'AA-HDFC-TXN-103',
        paymentMode: 'NET_BANKING',
        balance: 88179.50,
        bankName: 'HDFC Bank'
      },
      {
        date: '2026-10-08',
        narration: 'SWIGGY FOOD ORDER INDIRANAGAR',
        amount: 680.00,
        direction: 'DEBIT',
        providerTransactionId: 'AA-HDFC-TXN-104',
        paymentMode: 'UPI',
        balance: 87499.50,
        bankName: 'HDFC Bank'
      },
      {
        date: '2026-10-12',
        narration: 'ZERODHA BROKING MONTHLY MUTUAL FUND SIP',
        amount: 15000.00,
        direction: 'DEBIT',
        providerTransactionId: 'AA-HDFC-TXN-105',
        paymentMode: 'NET_BANKING',
        balance: 72499.50,
        bankName: 'HDFC Bank'
      },
      {
        date: '2026-10-15',
        narration: 'SHELL PETROL PUMP KORAMANGALA FUEL',
        amount: 2100.00,
        direction: 'DEBIT',
        providerTransactionId: 'AA-HDFC-TXN-106',
        paymentMode: 'CARD',
        balance: 70399.50,
        bankName: 'HDFC Bank'
      }
    ]
  },
  {
    id: 'sbi_savings',
    bankId: 'sbi',
    bankName: 'State Bank of India',
    accountName: 'SBI Regular Savings Account',
    accountNumberMasked: '•••• 3190',
    accountType: 'Regular Savings',
    balance: 75361.00,
    statementPeriod: 'October 1 – October 25, 2026',
    transactions: [
      {
        date: '2026-10-02',
        narration: 'TCS CONSULTING DIRECT SALARY DEP OCT',
        amount: 68000.00,
        direction: 'CREDIT',
        providerTransactionId: 'AA-SBI-TXN-201',
        paymentMode: 'RTGS',
        balance: 81200.00,
        bankName: 'State Bank of India'
      },
      {
        date: '2026-10-04',
        narration: 'APOLLO PHARMACY WHITEFIELD MEDICINE',
        amount: 1250.00,
        direction: 'DEBIT',
        providerTransactionId: 'AA-SBI-TXN-202',
        paymentMode: 'UPI',
        balance: 79950.00,
        bankName: 'State Bank of India'
      },
      {
        date: '2026-10-09',
        narration: 'AIRTEL BROADBAND FIBER BILL PAYMENT',
        amount: 1179.00,
        direction: 'DEBIT',
        providerTransactionId: 'AA-SBI-TXN-203',
        paymentMode: 'NET_BANKING',
        balance: 78771.00,
        bankName: 'State Bank of India'
      },
      {
        date: '2026-10-14',
        narration: 'NATURE BASKET FRESH MARKET GROCERIES',
        amount: 3410.00,
        direction: 'DEBIT',
        providerTransactionId: 'AA-SBI-TXN-204',
        paymentMode: 'CARD',
        balance: 75361.00,
        bankName: 'State Bank of India'
      }
    ]
  },
  {
    id: 'icici_privilege',
    bankId: 'icici',
    bankName: 'ICICI Bank',
    accountName: 'ICICI Privilege Savings Account',
    accountNumberMasked: '•••• 9041',
    accountType: 'Privilege Banking',
    balance: 101461.00,
    statementPeriod: 'October 1 – October 25, 2026',
    transactions: [
      {
        date: '2026-10-01',
        narration: 'CLIENT CONSULTING FEES TECH INNOVATIONS',
        amount: 85000.00,
        direction: 'CREDIT',
        providerTransactionId: 'AA-ICICI-TXN-301',
        paymentMode: 'IMPS',
        balance: 110500.00,
        bankName: 'ICICI Bank'
      },
      {
        date: '2026-10-06',
        narration: 'AMAZON INDIA ELECTRONICS MONITOR GADGET',
        amount: 4999.00,
        direction: 'DEBIT',
        providerTransactionId: 'AA-ICICI-TXN-302',
        paymentMode: 'CARD',
        balance: 105501.00,
        bankName: 'ICICI Bank'
      },
      {
        date: '2026-10-10',
        narration: 'CULT FIT FITNESS GYM PASS BANGALORE',
        amount: 3200.00,
        direction: 'DEBIT',
        providerTransactionId: 'AA-ICICI-TXN-303',
        paymentMode: 'UPI',
        balance: 102301.00,
        bankName: 'ICICI Bank'
      },
      {
        date: '2026-10-18',
        narration: 'UBER INDIA TRAVEL RIDES KORAMANGALA',
        amount: 840.00,
        direction: 'DEBIT',
        providerTransactionId: 'AA-ICICI-TXN-304',
        paymentMode: 'UPI',
        balance: 101461.00,
        bankName: 'ICICI Bank'
      }
    ]
  }
];

/**
 * Deliberate malformed record for demonstrating structured validation error handling.
 */
export const MOCK_INVALID_TRANSACTION = {
  date: 'invalid-date-format',
  narration: '',
  amount: -250,
  direction: 'UNKNOWN_DIRECTION'
};
