/**
 * AI Code Review — Admin Page Logic
 * Admin analytics, user management, review tables, score trend chart
 */

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  // Admin guard
  const profile = await requireAdmin();
  if (!profile) return;

  initSidebar();
  await initSidebarUser();

  // Load admin data
  await loadAdminData();
});

// ============================================
// TAB SWITCHING
// ============================================
function switchAdminTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('#adminTabs .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
}

// ============================================
// LOAD ADMIN DATA
// ============================================
async function loadAdminData() {
  try {
    // Fetch all profiles (admin RLS allows this)
    const { data: profiles, error: profilesErr } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesErr) throw profilesErr;

    // Fetch all reviews (admin RLS allows this)
    const { data: reviews, error: reviewsErr } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });

    if (reviewsErr) throw reviewsErr;

    // Render everything
    renderAdminStats(profiles || [], reviews || []);
    renderScoreChart(reviews || []);
    renderUsersTable(profiles || [], reviews || []);
    renderReviewsTable(reviews || [], profiles || []);

  } catch (err) {
    console.error('Admin data load error:', err);
    showToast('Failed to load admin data', 'error');
  }
}

// ============================================
// RENDER ADMIN STATS
// ============================================
function renderAdminStats(profiles, reviews) {
  const totalUsers = profiles.length;
  const totalReviews = reviews.length;
  const avgScore = totalReviews > 0
    ? (reviews.reduce((sum, r) => sum + (r.score || 0), 0) / totalReviews).toFixed(1)
    : '—';

  // Reviews today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reviewsToday = reviews.filter(r => new Date(r.created_at) >= today).length;

  const statsGrid = document.getElementById('adminStats');
  statsGrid.innerHTML = `
    <div class="stat-card animate-fade-in-up">
      <div class="stat-icon primary">👥</div>
      <div class="stat-value">${totalUsers}</div>
      <div class="stat-label">Total Users</div>
    </div>
    <div class="stat-card animate-fade-in-up" style="animation-delay:60ms">
      <div class="stat-icon accent">📝</div>
      <div class="stat-value">${totalReviews}</div>
      <div class="stat-label">Total Reviews</div>
    </div>
    <div class="stat-card animate-fade-in-up" style="animation-delay:120ms">
      <div class="stat-icon warning">⭐</div>
      <div class="stat-value">${avgScore}</div>
      <div class="stat-label">Average Score</div>
    </div>
    <div class="stat-card animate-fade-in-up" style="animation-delay:180ms">
      <div class="stat-icon primary">📅</div>
      <div class="stat-value">${reviewsToday}</div>
      <div class="stat-label">Reviews Today</div>
    </div>
  `;
}

// ============================================
// RENDER SCORE TREND CHART (Canvas)
// ============================================
function renderScoreChart(reviews) {
  const canvas = document.getElementById('scoreChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Set canvas size
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 300 * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = '300px';
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = 300;
  const padding = { top: 30, right: 30, bottom: 50, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Aggregate reviews by day (last 30 days)
  const days = 30;
  const dayData = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const nextD = new Date(d);
    nextD.setDate(nextD.getDate() + 1);

    const dayReviews = reviews.filter(r => {
      const rd = new Date(r.created_at);
      return rd >= d && rd < nextD;
    });

    const avgScore = dayReviews.length > 0
      ? dayReviews.reduce((s, r) => s + (r.score || 0), 0) / dayReviews.length
      : null;

    dayData.push({
      date: d,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      score: avgScore,
      count: dayReviews.length,
    });
  }

  // Get theme colors
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)';
  const lineColor = '#6366f1';
  const dotColor = '#4f46e5';
  const fillGradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  fillGradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
  fillGradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

  // Clear
  ctx.clearRect(0, 0, width, height);

  // Draw grid lines
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i += 2) {
    const y = padding.top + chartH - (i / 10) * chartH;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    // Y-axis labels
    ctx.fillStyle = textColor;
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(i.toString(), padding.left - 10, y + 4);
  }

  // Draw X-axis labels (every 5th day)
  ctx.textAlign = 'center';
  ctx.fillStyle = textColor;
  dayData.forEach((d, i) => {
    if (i % 5 === 0 || i === dayData.length - 1) {
      const x = padding.left + (i / (dayData.length - 1)) * chartW;
      ctx.fillText(d.label, x, height - padding.bottom + 20);
    }
  });

  // Filter points with data
  const validPoints = dayData
    .map((d, i) => ({ ...d, index: i }))
    .filter(d => d.score !== null);

  if (validPoints.length < 2) {
    // Not enough data
    ctx.fillStyle = textColor;
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Not enough data to display trends', width / 2, height / 2);
    return;
  }

  // Draw filled area
  ctx.beginPath();
  const firstPt = validPoints[0];
  const firstX = padding.left + (firstPt.index / (dayData.length - 1)) * chartW;
  const firstY = padding.top + chartH - (firstPt.score / 10) * chartH;
  ctx.moveTo(firstX, height - padding.bottom);
  ctx.lineTo(firstX, firstY);

  validPoints.forEach((pt) => {
    const x = padding.left + (pt.index / (dayData.length - 1)) * chartW;
    const y = padding.top + chartH - (pt.score / 10) * chartH;
    ctx.lineTo(x, y);
  });

  const lastPt = validPoints[validPoints.length - 1];
  const lastX = padding.left + (lastPt.index / (dayData.length - 1)) * chartW;
  ctx.lineTo(lastX, height - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = fillGradient;
  ctx.fill();

  // Draw line
  ctx.beginPath();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  validPoints.forEach((pt, idx) => {
    const x = padding.left + (pt.index / (dayData.length - 1)) * chartW;
    const y = padding.top + chartH - (pt.score / 10) * chartH;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Draw dots
  validPoints.forEach((pt) => {
    const x = padding.left + (pt.index / (dayData.length - 1)) * chartW;
    const y = padding.top + chartH - (pt.score / 10) * chartH;

    // White outline
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = isDark ? '#111827' : '#ffffff';
    ctx.fill();

    // Colored dot
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();
  });
}

// ============================================
// RENDER USERS TABLE
// ============================================
function renderUsersTable(profiles, reviews) {
  document.getElementById('usersCount').textContent = `${profiles.length} users`;

  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = profiles.map(p => {
    const userReviews = reviews.filter(r => r.user_id === p.id);
    const avgScore = userReviews.length > 0
      ? (userReviews.reduce((s, r) => s + (r.score || 0), 0) / userReviews.length).toFixed(1)
      : '—';

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            ${p.avatar_url
        ? `<img src="${p.avatar_url}" style="width:28px;height:28px;border-radius:50%;" referrerpolicy="no-referrer" alt="">`
        : `<div style="width:28px;height:28px;border-radius:50%;background:var(--gradient-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:600;">${(p.full_name || p.email || '?').charAt(0).toUpperCase()}</div>`
      }
            <span style="font-weight:500;">${escapeHtml(p.full_name || '—')}</span>
          </div>
        </td>
        <td>${escapeHtml(p.email)}</td>
        <td><span class="badge ${p.role === 'admin' ? 'badge-primary' : 'badge-neutral'}">${p.role}</span></td>
        <td>${userReviews.length}</td>
        <td>${avgScore}</td>
        <td>${formatDate(p.created_at)}</td>
      </tr>
    `;
  }).join('');
}

// ============================================
// RENDER ALL REVIEWS TABLE
// ============================================
function renderReviewsTable(reviews, profiles) {
  document.getElementById('reviewsCount').textContent = `${reviews.length} reviews`;

  const tbody = document.getElementById('reviewsTableBody');

  if (reviews.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state" style="padding:40px;">No reviews yet</td></tr>`;
    return;
  }

  tbody.innerHTML = reviews.map(r => {
    const profile = profiles.find(p => p.id === r.user_id);
    const scoreColor = getScoreColor(r.score || 0);

    return `
      <tr>
        <td><span style="font-weight:500;">${escapeHtml(r.title)}</span></td>
        <td>${escapeHtml(profile ? (profile.full_name || profile.email) : 'Unknown')}</td>
        <td><span class="badge badge-neutral">${escapeHtml(r.language)}</span></td>
        <td><span style="color:${scoreColor};font-weight:700;">${r.score || '—'}</span>/10</td>
        <td>${(r.bugs || []).length}</td>
        <td>${formatDate(r.created_at)}</td>
        <td><a href="results.html?id=${r.id}" class="btn btn-sm btn-ghost">View →</a></td>
      </tr>
    `;
  }).join('');
}
