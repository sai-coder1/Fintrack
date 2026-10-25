/**
 * Navigation and URL synchronization helpers for SpendSense
 */

export const PUBLIC_PAGES = ['landing', 'signin', 'signup', 'forgot-password', 'reset-password'];
export const PROTECTED_PAGES = [
  'dashboard',
  'transactions',
  'import',
  'analytics',
  'budgets',
  'simulator',
  'settings'
];

/**
 * Resolves current route page identifier from window.location
 */
export function getPageFromPath(pathname = '/', hash = '') {
  // If hash contains recovery token from Supabase email link, direct to reset-password
  if (typeof hash === 'string' && hash.includes('type=recovery')) {
    return 'reset-password';
  }

  const cleanPath = (pathname || '/').toLowerCase().replace(/\/$/, '') || '/';

  switch (cleanPath) {
    case '/':
      return 'root'; // Resolved to 'dashboard' if logged in, or 'landing' if not
    case '/landing':
      return 'landing';
    case '/signin':
    case '/login':
      return 'signin';
    case '/signup':
    case '/register':
      return 'signup';
    case '/forgot-password':
    case '/forgot':
      return 'forgot-password';
    case '/reset-password':
    case '/reset':
      return 'reset-password';
    case '/dashboard':
      return 'dashboard';
    case '/transactions':
      return 'transactions';
    case '/import':
      return 'import';
    case '/analytics':
      return 'analytics';
    case '/budgets':
      return 'budgets';
    case '/simulator':
      return 'simulator';
    case '/settings':
      return 'settings';
    default:
      return 'root';
  }
}

/**
 * Maps page identifier to clean URL path
 */
export function getPathFromPage(pageId) {
  switch (pageId) {
    case 'landing':
      return '/';
    case 'signin':
      return '/signin';
    case 'signup':
      return '/signup';
    case 'forgot-password':
      return '/forgot-password';
    case 'reset-password':
      return '/reset-password';
    case 'dashboard':
      return '/dashboard';
    case 'transactions':
      return '/transactions';
    case 'import':
      return '/import';
    case 'analytics':
      return '/analytics';
    case 'budgets':
      return '/budgets';
    case 'simulator':
      return '/simulator';
    case 'settings':
      return '/settings';
    default:
      return '/';
  }
}
