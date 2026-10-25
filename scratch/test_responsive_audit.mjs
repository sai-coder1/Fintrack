import fs from 'fs';
import path from 'path';

console.log('=== FinTrack Responsive Design Verification Suite ===\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

// 1. Check layout.css
console.log('--- 1. Testing layout.css Responsive System ---');
const layoutCss = fs.readFileSync('src/styles/layout.css', 'utf8');

assert(layoutCss.includes('@media (max-width: 1024px)'), 'Includes 1024px tablet/small-laptop breakpoint');
assert(layoutCss.includes('@media (max-width: 900px)'), 'Includes 900px breakpoint');
assert(layoutCss.includes('@media (max-width: 768px)'), 'Includes 768px tablet breakpoint');
assert(layoutCss.includes('@media (max-width: 640px)'), 'Includes 640px mobile breakpoint');
assert(layoutCss.includes('@media (max-width: 480px)'), 'Includes 480px compact mobile breakpoint');
assert(layoutCss.includes('@media (max-width: 360px)'), 'Includes 360px small mobile breakpoint');
assert(layoutCss.includes('.col-span-2-responsive'), 'Includes .col-span-2-responsive utility');
assert(layoutCss.includes('min(var(--sidebar-width), 85vw)'), 'Sidebar constrained to 85vw on mobile');

// 2. Check components.css
console.log('\n--- 2. Testing components.css Component Adaptations ---');
const componentsCss = fs.readFileSync('src/styles/components.css', 'utf8');

assert(componentsCss.includes('min-width: 680px'), 'Table has min-width: 680px for horizontal scroll safety');
assert(componentsCss.includes('-webkit-overflow-scrolling: touch'), 'Table container has smooth iOS momentum scrolling');
assert(componentsCss.includes('.modal-container .grid-cols-4'), 'Modals collapse 4-column grids to 2-columns on mobile');
assert(componentsCss.includes('.modal-container .grid-cols-3'), 'Modals collapse 3-column grids on mobile');
assert(componentsCss.includes('clamp('), 'StatCard values use fluid clamp typography');
assert(componentsCss.includes('touch-action: manipulation'), 'Buttons have touch-action manipulation for snappy mobile taps');
assert(componentsCss.includes('max-height: 94vh'), 'Modals have max-height constraint for small viewports');
assert(componentsCss.includes('.filter-bar .flex-wrap'), 'Filter bar selects adapt responsively');

// 3. Check landing-auth.css
console.log('\n--- 3. Testing landing-auth.css Landing & Auth Pages ---');
const landingAuthCss = fs.readFileSync('src/styles/landing-auth.css', 'utf8');

assert(landingAuthCss.includes('clamp(2rem, 5.5vw, 3.5rem)'), 'Landing hero title uses responsive fluid typography');
assert(landingAuthCss.includes('.landing-mobile-menu-btn'), 'Mobile hamburger button styled for landing page');
assert(landingAuthCss.includes('.landing-mobile-nav'), 'Mobile slide-down navigation drawer styled for landing page');
assert(landingAuthCss.includes('.landing-mockup-grid'), 'Landing preview mockup grid class replaces inline grid');

// 4. Check Sidebar.jsx accessibility and mobile drawer
console.log('\n--- 4. Testing Sidebar.jsx Accessibility & Drawer Interaction ---');
const sidebarJsx = fs.readFileSync('src/components/common/Sidebar.jsx', 'utf8');

assert(sidebarJsx.includes("handleKeyDown"), 'Sidebar has keyboard keydown listener');
assert(sidebarJsx.includes("e.key === 'Escape'"), 'Sidebar closes on Escape key');
assert(sidebarJsx.includes("document.body.style.overflow = 'hidden'"), 'Sidebar locks body scroll when open on mobile');
assert(sidebarJsx.includes('role="dialog"'), 'Sidebar has dialog role for screen readers');
assert(sidebarJsx.includes('aria-modal'), 'Sidebar has aria-modal attribute');

// 5. Check DashboardPage and SettingsPage responsive grid fixes
console.log('\n--- 5. Testing Elimination of Broken Inline gridColumn Spans ---');
const dashboardJsx = fs.readFileSync('src/pages/DashboardPage.jsx', 'utf8');
const settingsJsx = fs.readFileSync('src/pages/SettingsPage.jsx', 'utf8');

assert(!dashboardJsx.includes("gridColumn: 'span 2'"), 'DashboardPage inline gridColumn: span 2 eliminated');
assert(dashboardJsx.includes('col-span-2-responsive'), 'DashboardPage uses col-span-2-responsive');
assert(!settingsJsx.includes("gridColumn: 'span 2'"), 'SettingsPage inline gridColumn: span 2 eliminated');
assert(settingsJsx.includes('col-span-2-responsive'), 'SettingsPage uses col-span-2-responsive');

// 6. Check Navbar.jsx mobile button text
console.log('\n--- 6. Testing Navbar Mobile Adaptations ---');
const navbarJsx = fs.readFileSync('src/components/common/Navbar.jsx', 'utf8');

assert(navbarJsx.includes('hide-on-mobile'), 'Navbar Add Transaction button hides secondary word on narrow mobile');

// 7. Check LandingPage.jsx mobile menu
console.log('\n--- 7. Testing LandingPage Mobile Navigation ---');
const landingJsx = fs.readFileSync('src/pages/LandingPage.jsx', 'utf8');

assert(landingJsx.includes('mobileMenuOpen'), 'LandingPage has mobileMenuOpen state');
assert(landingJsx.includes('landing-mobile-nav'), 'LandingPage renders landing-mobile-nav drawer');

console.log(`\n==========================================`);
console.log(`Responsive Audit Results: ${passed} passed, ${failed} failed`);
console.log(`==========================================\n`);

if (failed > 0) {
  process.exit(1);
}
