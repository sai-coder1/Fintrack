/**
 * SpendSense — Pre-Configured Category Master Dictionary
 * Separates transactions into Needs, Wants, Investments, and Income.
 */

export const DEFAULT_CATEGORIES = [
  {
    id: 'cat_income',
    name: 'Salary & Income',
    type: 'income',
    defaultNature: 'income',
    color: '#059669', // Emerald
    icon: 'ArrowDownLeft',
    keywords: ['salary', 'payroll', 'credit', 'interest', 'dividend', 'stipend', 'client payout']
  },
  {
    id: 'cat_housing',
    name: 'Rent & Housing',
    type: 'expense',
    defaultNature: 'need',
    color: '#4338ca', // Indigo
    icon: 'Home',
    keywords: ['rent', 'maintenance', 'housing', 'society', 'apartment', 'flat']
  },
  {
    id: 'cat_groceries',
    name: 'Groceries & Household',
    type: 'expense',
    defaultNature: 'need',
    color: '#059669', // Emerald
    icon: 'ShoppingCart',
    keywords: ['blinkit', 'zepto', 'instamart', 'bigbasket', 'dmart', 'supermarket', 'provisions', 'vegetables', 'milk', 'dairy']
  },
  {
    id: 'cat_food_dining',
    name: 'Food & Dining Out',
    type: 'expense',
    defaultNature: 'want',
    color: '#f59e0b', // Amber
    icon: 'Utensils',
    keywords: ['swiggy', 'zomato', 'restaurant', 'cafe', 'mcdonalds', 'starbucks', 'eats', 'biryani', 'pizza', 'burger']
  },
  {
    id: 'cat_utilities',
    name: 'Bills & Utilities',
    type: 'expense',
    defaultNature: 'need',
    color: '#0284c7', // Sky Blue
    icon: 'Zap',
    keywords: ['bescom', 'airtel', 'jio', 'electricity', 'broadband', 'wifi', 'cylinder', 'gas', 'water bill', 'mobile recharge']
  },
  {
    id: 'cat_commute',
    name: 'Transport & Commute',
    type: 'expense',
    defaultNature: 'need',
    color: '#6366f1', // Indigo
    icon: 'Car',
    keywords: ['uber', 'ola', 'rapido', 'metro', 'irctc', 'petrol', 'fuel', 'hpcl', 'bpcl', 'shell', 'auto']
  },
  {
    id: 'cat_entertainment',
    name: 'Entertainment & OTT',
    type: 'expense',
    defaultNature: 'want',
    color: '#ec4899', // Pink
    icon: 'Film',
    keywords: ['netflix', 'spotify', 'prime', 'hotstar', 'bookmyshow', 'pvr', 'inox', 'youtube premium', 'gaming']
  },
  {
    id: 'cat_shopping',
    name: 'Shopping & Discretionary',
    type: 'expense',
    defaultNature: 'want',
    color: '#8b5cf6', // Violet
    icon: 'ShoppingBag',
    keywords: ['amazon', 'flipkart', 'myntra', 'zara', 'h&m', 'electronics', 'clothing', 'shoes', 'gadget']
  },
  {
    id: 'cat_health',
    name: 'Healthcare & Wellness',
    type: 'expense',
    defaultNature: 'need',
    color: '#e11d48', // Rose
    icon: 'HeartPulse',
    keywords: ['pharmacy', 'apollo', 'medplus', 'hospital', 'clinic', 'doctor', 'medicines', 'diagnostic', 'gym']
  },
  {
    id: 'cat_investments',
    name: 'Savings & Investments',
    type: 'expense',
    defaultNature: 'investment',
    color: '#4f46e5', // Deep indigo
    icon: 'PiggyBank',
    keywords: ['zerodha', 'groww', 'mutual fund', 'sip', 'ppf', 'fixed deposit', 'nps', 'gold']
  },
  {
    id: 'cat_uncategorized',
    name: 'General & Miscellaneous',
    type: 'expense',
    defaultNature: 'want',
    color: '#64748b', // Slate
    icon: 'HelpCircle',
    keywords: []
  }
];
