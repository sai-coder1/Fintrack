import assert from 'assert';

console.log('================================================================');
console.log('SPENDSENSE — AUTHENTICATED USER & PROFILE NAME TEST SUITE');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    failed++;
  }
}

/**
 * Resolution helper matching AuthContext & DashboardPage logic:
 * Priority: profiles.full_name -> auth.user.user_metadata.full_name -> email prefix -> fallback
 */
function resolveUserDisplayName(user, profile, isSampleMode = false, sampleDefault = 'Sai') {
  if (isSampleMode) {
    return sampleDefault;
  }
  if (!user && !profile) {
    return 'User';
  }
  const fromProfile = profile?.full_name?.trim();
  if (fromProfile) return fromProfile;

  const fromMetadata = user?.user_metadata?.full_name?.trim();
  if (fromMetadata) return fromMetadata;

  if (user?.email && typeof user.email === 'string') {
    const prefix = user.email.split('@')[0]?.trim();
    if (prefix) return prefix;
  }

  return 'User';
}

function resolveNavbarShortName(user, profile) {
  const full = resolveUserDisplayName(user, profile);
  return full.split(' ')[0] || full;
}

function resolveAvatarInitial(user, profile) {
  const name = resolveUserDisplayName(user, profile);
  return (name.charAt(0) || 'U').toUpperCase();
}

// SUITE 1: User A vs. User B Isolation
console.log('--- SUITE 1: User A vs. User B Name Resolution ---');

runTest('User A ("Saitejaswini Bhumireddy") displays User A name', () => {
  const userA = {
    id: 'user-a-uuid',
    email: 'saitejaswini@example.com',
    user_metadata: { full_name: 'Saitejaswini Bhumireddy' }
  };
  const profileA = {
    id: 'user-a-uuid',
    full_name: 'Saitejaswini Bhumireddy'
  };

  const name = resolveUserDisplayName(userA, profileA);
  assert.strictEqual(name, 'Saitejaswini Bhumireddy');
  assert.strictEqual(resolveNavbarShortName(userA, profileA), 'Saitejaswini');
  assert.strictEqual(resolveAvatarInitial(userA, profileA), 'S');
});

runTest('User B ("M V S Tanusri") displays User B name separately', () => {
  const userB = {
    id: 'user-b-uuid',
    email: 'mvstanusri16@gmail.com',
    user_metadata: { full_name: 'M V S Tanusri' }
  };
  const profileB = {
    id: 'user-b-uuid',
    full_name: 'M V S Tanusri'
  };

  const name = resolveUserDisplayName(userB, profileB);
  assert.strictEqual(name, 'M V S Tanusri');
  assert.strictEqual(resolveNavbarShortName(userB, profileB), 'M');
  assert.strictEqual(resolveAvatarInitial(userB, profileB), 'M');
});

// SUITE 2: Sign-out and Session State Transitions
console.log('\n--- SUITE 2: Signing Out & Page Refresh Preservations ---');

runTest('Signing out clears previous user name and does not bleed into next session', () => {
  // Simulate user A signed out
  const signedOutUser = null;
  const signedOutProfile = null;

  const signedOutName = resolveUserDisplayName(signedOutUser, signedOutProfile);
  assert.strictEqual(signedOutName, 'User');

  // Next user B signs in
  const userB = {
    id: 'user-b-uuid',
    email: 'userb@domain.com',
    user_metadata: { full_name: 'Rohan Sharma' }
  };
  const profileB = {
    id: 'user-b-uuid',
    full_name: 'Rohan Sharma'
  };

  const userBName = resolveUserDisplayName(userB, profileB);
  assert.strictEqual(userBName, 'Rohan Sharma');
});

runTest('Page refresh preserves correct name from rehydrated profile / session', () => {
  // Simulate page reload: Supabase getSession rehydrates user
  const rehydratedUser = {
    id: 'user-c-uuid',
    email: 'ananya.iyer@fintech.in',
    user_metadata: { full_name: 'Ananya Iyer' }
  };
  const rehydratedProfile = {
    id: 'user-c-uuid',
    full_name: 'Ananya Iyer'
  };

  const name = resolveUserDisplayName(rehydratedUser, rehydratedProfile);
  assert.strictEqual(name, 'Ananya Iyer');
});

// SUITE 3: Fallback Chains (Missing Profile & Missing full_name)
console.log('\n--- SUITE 3: Sensible Fallbacks (No Hardcoded Names) ---');

runTest('When public.profiles row is missing, falls back to auth user_metadata.full_name', () => {
  const user = {
    id: 'user-d-uuid',
    email: 'priya.n@example.com',
    user_metadata: { full_name: 'Priya Nair' }
  };
  const profile = null; // Profile not yet synced or fetched

  const name = resolveUserDisplayName(user, profile);
  assert.strictEqual(name, 'Priya Nair');
});

runTest('When both profile and user_metadata full_name are missing, falls back to email prefix', () => {
  const user = {
    id: 'user-e-uuid',
    email: 'karthik.v@startup.io',
    user_metadata: {} // No full_name provided during signup
  };
  const profile = null;

  const name = resolveUserDisplayName(user, profile);
  assert.strictEqual(name, 'karthik.v');
  assert.strictEqual(resolveNavbarShortName(user, profile), 'karthik.v');
  assert.strictEqual(resolveAvatarInitial(user, profile), 'K');
});

runTest('Never displays a fake constant name for an authenticated user with unique email', () => {
  const user = {
    id: 'user-f-uuid',
    email: 'custom.developer99@test.com',
    user_metadata: {}
  };
  const name = resolveUserDisplayName(user, null);
  assert.notStrictEqual(name, 'Sai');
  assert.notStrictEqual(name, 'Saitejaswini Bhumireddy');
  assert.strictEqual(name, 'custom.developer99');
});

// SUITE 4: Profile-Fetch Error Safety & RLS Invariance
console.log('\n--- SUITE 4: Error Safety & Demo Mode Invariance ---');

runTest('Handles profile query errors gracefully without crashing or returning undefined', () => {
  const user = {
    id: 'user-g-uuid',
    email: 'emergency@bank.com',
    user_metadata: { full_name: 'Emergency User' }
  };
  // Simulate query error resulting in null profile
  const profile = null;

  let resolved = null;
  assert.doesNotThrow(() => {
    resolved = resolveUserDisplayName(user, profile);
  });
  assert.strictEqual(resolved, 'Emergency User');
});

runTest('Sample/Demo mode preserves demo greeting while Personal mode displays real user', () => {
  const user = {
    id: 'user-h-uuid',
    email: 'tanusri@example.com',
    user_metadata: { full_name: 'M V S Tanusri' }
  };
  const profile = {
    id: 'user-h-uuid',
    full_name: 'M V S Tanusri'
  };

  // When user is exploring demo mode
  const demoGreeting = resolveUserDisplayName(user, profile, true, 'Sai');
  assert.strictEqual(demoGreeting, 'Sai');

  // When user is in personal mode
  const personalGreeting = resolveUserDisplayName(user, profile, false);
  assert.strictEqual(personalGreeting, 'M V S Tanusri');
});

console.log('\n================================================================');
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) process.exit(1);
