/**
 * AI Code Review — Dashboard Page Logic
 * Loads user stats, recent reviews, and renders dashboard UI
 */

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  // Auth guard
  const session = await requireAuth();
  if (!session) return;

  // Initialize UI
  initSidebar();
  await initSidebarUser();

  // Load dashboard data
  await loadDashboard();
});

// ============================================
// LOAD DASHBOARD
// ============================================
async function loadDashboard() {
  try {
    const profile = await getUserProfile();
    if (!profile) return;

    // Set welcome message
    const welcomeName = document.getElementById('welcomeName');
    const firstName = (profile.full_name || 'there').split(' ')[0];
    welcomeName.textContent = `Welcome back, ${firstName}!`;

    // Update welcome avatar
    const welcomeAvatar = document.querySelector('.welcome-avatar');
    if (welcomeAvatar && profile.avatar_url) {
      welcomeAvatar.innerHTML = `<img src="${profile.avatar_url}" alt="${escapeHtml(profile.full_name)}" referrerpolicy="no-referrer">`;
    }

    // Load reviews
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Render stats
    renderStats(reviews || []);

    // Render recent reviews
    renderRecentReviews(reviews || []);

  } catch (err) {
    console.error('Dashboard load error:', err);
    showToast('Failed to load dashboard data', 'error');
  }
}

// ============================================
// RENDER STATS
// ============================================
function renderStats(reviews) {
  const totalReviews = reviews.length;
  const avgScore = totalReviews > 0
    ? (reviews.reduce((sum, r) => sum + (r.score || 0), 0) / totalReviews).toFixed(1)
    : '—';
  const lastReview = totalReviews > 0
    ? formatDate(reviews[0].created_at)
    : 'Never';

  const statsGrid = document.getElementById('statsGrid');
  statsGrid.innerHTML = `
    <div class="stat-card animate-fade-in-up">
      <div class="stat-icon primary">📝</div>
      <div class="stat-value">${totalReviews}</div>
      <div class="stat-label">Total Reviews</div>
    </div>
    <div class="stat-card animate-fade-in-up" style="animation-delay: 60ms;">
      <div class="stat-icon accent">⭐</div>
      <div class="stat-value">${avgScore}</div>
      <div class="stat-label">Average Score</div>
    </div>
    <div class="stat-card animate-fade-in-up" style="animation-delay: 120ms;">
      <div class="stat-icon warning">🕐</div>
      <div class="stat-value" style="font-size: var(--text-xl);">${lastReview}</div>
      <div class="stat-label">Last Review</div>
    </div>
  `;
}

// ============================================
// RENDER RECENT REVIEWS
// ============================================
function renderRecentReviews(reviews) {
  const container = document.getElementById('reviewsList');

  if (reviews.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-title">No reviews yet</div>
        <div class="empty-state-description">Start your first code review to see results here.</div>
        <a href="input.html" class="btn btn-primary">
          <span>✨</span> Start First Review
        </a>
      </div>
    `;
    return;
  }

  // Show up to 8 recent
  const recent = reviews.slice(0, 8);
  container.innerHTML = recent.map(review => {
    const scoreColor = getScoreColor(review.score || 0);
    const bgColor = scoreColor + '18'; // 10% opacity

    return `
      <a href="results.html?id=${review.id}" class="review-card animate-fade-in-up">
        <div class="review-score-mini" style="background: ${bgColor}; color: ${scoreColor};">
          ${review.score || '—'}
        </div>
        <div class="review-info">
          <div class="review-title">${escapeHtml(review.title)}</div>
          <div class="review-meta">
            <span class="badge badge-neutral">${escapeHtml(review.language || 'unknown')}</span>
            <span>${formatDate(review.created_at)}</span>
            <span>${(review.bugs || []).length} bugs</span>
          </div>
        </div>
        <span class="review-arrow">→</span>
      </a>
    `;
  }).join('');

  // Add "View All" if more exist
  if (reviews.length > 8) {
    container.innerHTML += `
      <div style="text-align: center; padding: var(--space-4);">
        <a href="history.html" class="btn btn-secondary">View All ${reviews.length} Reviews</a>
      </div>
    `;
  }
}
