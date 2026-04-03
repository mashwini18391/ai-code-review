/**
 * AI Code Review — Authentication
 * Google OAuth via Supabase Auth, session management, route guards
 */

// ============================================
// SIGN IN WITH GOOGLE
// ============================================
async function signInWithGoogle() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/dashboard.html',
      },
    });

    if (error) {
      showToast('Failed to sign in: ' + error.message, 'error');
      throw error;
    }

    return data;
  } catch (err) {
    console.error('Sign-in error:', err);
    showToast('Authentication failed. Please try again.', 'error');
  }
}

// ============================================
// SIGN UP WITH EMAIL
// ============================================
async function signUpWithEmail(email, password, fullName) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (error) throw error;
    
    // Auth automatically logs in if email confirmations are disabled in Supabase.
    // If enabled, it tells the user to check their email.
    if (data.session) {
      window.location.href = '/dashboard.html';
    } else {
      showToast('Success! Please check your email to verify your account.', 'success');
    }
    return data;
  } catch (err) {
    console.error('Sign-up error:', err);
    showToast(err.message || 'Sign up failed.', 'error');
    throw err;
  }
}

// ============================================
// SIGN IN WITH EMAIL
// ============================================
async function signInWithEmail(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    window.location.href = '/dashboard.html';
    return data;
  } catch (err) {
    console.error('Sign-in error:', err);
    showToast(err.message || 'Sign in failed.', 'error');
    throw err;
  }
}

// ============================================
// SIGN OUT
// ============================================
async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Clear any cached data
    sessionStorage.clear();

    // Redirect to login
    window.location.href = '/index.html';
  } catch (err) {
    console.error('Sign-out error:', err);
    showToast('Failed to sign out. Please try again.', 'error');
  }
}

// ============================================
// GET CURRENT SESSION
// ============================================
async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Session error:', error);
    return null;
  }
  return session;
}

// ============================================
// GET CURRENT USER
// ============================================
async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return session.user;
}

// ============================================
// GET USER PROFILE (from profiles table)
// ============================================
async function getUserProfile() {
  const user = await getCurrentUser();
  if (!user) return null;

  // Try cache first
  const cached = sessionStorage.getItem('user_profile');
  if (cached) {
    const parsed = JSON.parse(cached);
    if (parsed.id === user.id) return parsed;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Profile fetch error:', error);
    return null;
  }

  // Cache profile
  sessionStorage.setItem('user_profile', JSON.stringify(data));
  return data;
}

// ============================================
// ROUTE GUARD: Require Authentication
// ============================================
async function requireAuth() {
  const session = await getSession();

  if (!session) {
    // Redirect to login with return URL
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/index.html?redirect=${returnUrl}`;
    return null;
  }

  return session;
}

// ============================================
// ROUTE GUARD: Require Admin Role
// ============================================
async function requireAdmin() {
  const session = await requireAuth();
  if (!session) return null;

  const profile = await getUserProfile();

  if (!profile || profile.role !== 'admin') {
    showToast('Access denied. Admin privileges required.', 'error');
    window.location.href = '/dashboard.html';
    return null;
  }

  return profile;
}

// ============================================
// AUTH STATE CHANGE LISTENER
// ============================================
function onAuthStateChange(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (callback) callback(event, session);

    // Auto-redirect on sign out
    if (event === 'SIGNED_OUT') {
      sessionStorage.clear();
      if (!window.location.pathname.endsWith('index.html') &&
        window.location.pathname !== '/') {
        window.location.href = '/index.html';
      }
    }
  });
}

// ============================================
// INITIALIZE SIDEBAR USER INFO
// ============================================
async function initSidebarUser() {
  const profile = await getUserProfile();
  if (!profile) return;

  // Update user avatar
  const avatarEls = document.querySelectorAll('.sidebar-user-avatar');
  avatarEls.forEach(el => {
    if (profile.avatar_url) {
      el.innerHTML = `<img src="${profile.avatar_url}" alt="${escapeHtml(profile.full_name || 'User')}" referrerpolicy="no-referrer">`;
    } else {
      el.textContent = (profile.full_name || profile.email || 'U').charAt(0).toUpperCase();
    }
  });

  // Update user name
  const nameEls = document.querySelectorAll('.sidebar-user-name');
  nameEls.forEach(el => {
    el.textContent = profile.full_name || 'User';
  });

  // Update user email
  const emailEls = document.querySelectorAll('.sidebar-user-email');
  emailEls.forEach(el => {
    el.textContent = profile.email || '';
  });

  // Show/hide admin nav link
  const adminNavItems = document.querySelectorAll('.nav-admin');
  adminNavItems.forEach(el => {
    el.style.display = profile.role === 'admin' ? 'flex' : 'none';
  });

  // Welcome avatar on dashboard
  const welcomeAvatar = document.querySelector('.welcome-avatar');
  if (welcomeAvatar && profile.avatar_url) {
    welcomeAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="${escapeHtml(profile.full_name || 'User')}" referrerpolicy="no-referrer">`;
  }
}

// ============================================
// GET AUTH HEADER for Edge Function calls
// ============================================
async function getAuthHeader() {
  const session = await getSession();
  if (!session) throw new Error('Not authenticated');

  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}
