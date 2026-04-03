/**
 * AI Code Review — History Page Logic
 * Searchable, filterable, paginated list of past reviews
 */

// State
let allReviews = [];
let filteredReviews = [];
let currentPage = 1;
const perPage = APP_CONFIG.reviewsPerPage;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  initSidebar();
  await initSidebarUser();

  await loadHistory();
});

// ============================================
// LOAD HISTORY
// ============================================
async function loadHistory() {
  try {
    const profile = await getUserProfile();
    if (!profile) return;

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    allReviews = reviews || [];
    filteredReviews = [...allReviews];

    // Populate language filter
    populateLanguageFilter(allReviews);

    // Render
    currentPage = 1;
    renderHistory();

  } catch (err) {
    console.error('History load error:', err);
    showToast('Failed to load review history', 'error');
  }
}

// ============================================
// POPULATE LANGUAGE FILTER
// ============================================
function populateLanguageFilter(reviews) {
  const langFilter = document.getElementById('langFilter');
  const languages = [...new Set(reviews.map(r => r.language).filter(Boolean))];

  languages.sort().forEach(lang => {
    const opt = document.createElement('option');
    opt.value = lang;
    opt.textContent = lang.charAt(0).toUpperCase() + lang.slice(1);
    langFilter.appendChild(opt);
  });
}

// ============================================
// SEARCH HANDLER
// ============================================
const handleSearch = debounce((query) => {
  applyFilters();
}, 250);

// ============================================
// FILTER HANDLER
// ============================================
function handleFilter() {
  applyFilters();
}

function applyFilters() {
  const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
  const langFilter = document.getElementById('langFilter').value;
  const sortFilter = document.getElementById('sortFilter').value;

  // Filter
  filteredReviews = allReviews.filter(r => {
    const matchesSearch = !searchQuery ||
      r.title.toLowerCase().includes(searchQuery) ||
      (r.language || '').toLowerCase().includes(searchQuery);
    const matchesLang = !langFilter || r.language === langFilter;
    return matchesSearch && matchesLang;
  });

  // Sort
  switch (sortFilter) {
    case 'oldest':
      filteredReviews.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      break;
    case 'highest':
      filteredReviews.sort((a, b) => (b.score || 0) - (a.score || 0));
      break;
    case 'lowest':
      filteredReviews.sort((a, b) => (a.score || 0) - (b.score || 0));
      break;
    default: // newest
      filteredReviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  currentPage = 1;
  renderHistory();
}

// ============================================
// RENDER HISTORY
// ============================================
function renderHistory() {
  const container = document.getElementById('historyList');
  const paginationEl = document.getElementById('pagination');

  if (filteredReviews.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-title">${allReviews.length === 0 ? 'No reviews yet' : 'No matching reviews'}</div>
        <div class="empty-state-description">
          ${allReviews.length === 0
      ? 'Start your first code review to build your history.'
      : 'Try adjusting your search or filters.'
    }
        </div>
        ${allReviews.length === 0 ? `<a href="input.html" class="btn btn-primary"><span>✨</span> Start First Review</a>` : ''}
      </div>
    `;
    paginationEl.style.display = 'none';
    return;
  }

  // Paginate
  const totalPages = Math.ceil(filteredReviews.length / perPage);
  const startIdx = (currentPage - 1) * perPage;
  const pageReviews = filteredReviews.slice(startIdx, startIdx + perPage);

  // Render review cards
  container.innerHTML = pageReviews.map(review => {
    const scoreColor = getScoreColor(review.score || 0);
    const bgColor = scoreColor + '18';
    const bugsCount = (review.bugs || []).length;
    const highBugs = (review.bugs || []).filter(b => b.severity === 'high').length;

    return `
      <a href="results.html?id=${review.id}" class="review-card animate-fade-in-up">
        <div class="review-score-mini" style="background: ${bgColor}; color: ${scoreColor};">
          ${review.score || '—'}
        </div>
        <div class="review-info">
          <div class="review-title">${escapeHtml(review.title)}</div>
          <div class="review-meta">
            <span class="badge badge-neutral">${escapeHtml(review.language || 'unknown')}</span>
            <span>${review.source_type === 'github' ? '🐙 GitHub' : '📝 Paste'}</span>
            <span>${bugsCount} bug${bugsCount !== 1 ? 's' : ''}${highBugs > 0 ? ` (${highBugs} critical)` : ''}</span>
            <span>${formatDate(review.created_at)}</span>
          </div>
        </div>
        <button class="btn-icon btn-ghost" style="border:none;" onclick="deleteReview(event, '${review.id}')" title="Delete Review">🗑️</button>
        <span class="review-arrow">→</span>
      </a>
    `;
  }).join('');

  // Render pagination
  if (totalPages > 1) {
    paginationEl.style.display = 'flex';
    let paginationHtml = '';

    // Previous button
    paginationHtml += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">←</button>`;

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        paginationHtml += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
      } else if (i === currentPage - 2 || i === currentPage + 2) {
        paginationHtml += `<span style="color:var(--text-tertiary);">...</span>`;
      }
    }

    // Next button
    paginationHtml += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">→</button>`;

    paginationEl.innerHTML = paginationHtml;
  } else {
    paginationEl.style.display = 'none';
  }
}

// ============================================
// PAGINATION
// ============================================
function goToPage(page) {
  const totalPages = Math.ceil(filteredReviews.length / perPage);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderHistory();

  // Scroll to top of list
  document.getElementById('historyList').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================
// DELETE REVIEW
// ============================================
async function deleteReview(e, reviewId) {
  e.preventDefault();
  e.stopPropagation();

  if (!confirm('Are you sure you want to delete this review? This cannot be undone.')) {
    return;
  }

  try {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    if (error) throw error;

    showToast('Review safely deleted', 'success');
    allReviews = allReviews.filter(r => r.id !== reviewId);
    applyFilters();

  } catch (err) {
    console.error('Delete review error:', err);
    showToast('Failed to delete review', 'error');
  }
}
