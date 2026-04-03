/**
 * AI Code Review — Results Page Logic
 * Fetches and renders review results: score, bugs, suggestions, documentation
 */

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  initSidebar();
  await initSidebarUser();

  // Manage hljs themes
  updateHljsTheme();

  // Load review
  const reviewId = getUrlParam('id');
  if (!reviewId) {
    // Only redirect if we are on the standalone results page
    if (window.location.pathname.includes('results.html')) {
      showToast('No review ID provided', 'error');
      window.location.href = 'dashboard.html';
    }
    return;
  }

  await loadReview(reviewId);
});

function updateHljsTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const darkLink = document.getElementById('hljs-theme-dark');
  const lightLink = document.getElementById('hljs-theme-light');
  if (darkLink) darkLink.disabled = !isDark;
  if (lightLink) lightLink.disabled = isDark;
}

const themeObserver = new MutationObserver(() => updateHljsTheme());
themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// ============================================
// LOAD REVIEW
// ============================================
async function loadReview(reviewId) {
  try {
    const { data: review, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('id', reviewId)
      .single();

    if (error) throw error;
    if (!review) throw new Error('Review not found');

    renderResults(review);

  } catch (err) {
    console.error('Load review error:', err);
    showToast('Failed to load review: ' + err.message, 'error');

    document.getElementById('resultsLoading').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">❌</div>
        <div class="empty-state-title">Review not found</div>
        <div class="empty-state-description">This review may have been deleted or you don't have permission to view it.</div>
        <a href="dashboard.html" class="btn btn-primary">Back to Dashboard</a>
      </div>
    `;
  }
}

// ============================================
// RENDER RESULTS
// ============================================
function renderResults(review) {
  // Hide loading, show results
  document.getElementById('resultsLoading').style.display = 'none';
  const body = document.getElementById('resultsBody');
  body.style.display = 'block';

  // Parse data
  const bugs = review.bugs || [];
  const suggestions = review.suggestions || [];
  const score = review.score || 0;
  const documentation = review.documentation || 'No documentation generated.';
  const improvedCode = review.raw_ai_response?.improvedCode || null;

  // Count bugs by severity
  const highBugs = bugs.filter(b => b.severity === 'high').length;
  const medBugs = bugs.filter(b => b.severity === 'medium').length;
  const lowBugs = bugs.filter(b => b.severity === 'low').length;

  body.innerHTML = `
    <!-- Header Section -->
    <div class="results-header animate-fade-in-up">
      <div class="results-score-section">
        ${createScoreRing(score, 'lg')}
        <span class="badge ${score >= 7 ? 'badge-accent' : score >= 5 ? 'badge-primary' : 'badge-high'}" style="margin-top: 8px;">
          ${getScoreLabel(score)}
        </span>
      </div>
      <div class="results-info">
        <h2 class="results-title">${escapeHtml(review.title)}</h2>
        <div class="results-meta">
          <span class="results-meta-item">
            <span>📅</span> ${formatDateFull(review.created_at)}
          </span>
          <span class="results-meta-item">
            <span>💻</span> ${escapeHtml(review.language)}
          </span>
          <span class="results-meta-item">
            <span>${review.source_type === 'github' ? '🐙' : '📝'}</span>
            ${review.source_type === 'github' ? 'GitHub' : 'Pasted Code'}
          </span>
        </div>
        <div class="results-actions">
          <button class="btn btn-primary" onclick="handleExport()">
            <span>📥</span> Export as Markdown
          </button>
          <a href="input.html" class="btn btn-secondary">
            <span>✨</span> New Review
          </a>
          <a href="dashboard.html" class="btn btn-ghost">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="stats-grid stagger-children" style="margin-bottom: var(--space-8);">
      <div class="stat-card">
        <div class="stat-icon" style="background: ${highBugs > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)'}; color: ${highBugs > 0 ? '#ef4444' : '#22c55e'};">
          🐛
        </div>
        <div class="stat-value">${bugs.length}</div>
        <div class="stat-label">Bugs Found</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(99,102,241,0.1); color: var(--primary-500);">
          💡
        </div>
        <div class="stat-value">${suggestions.length}</div>
        <div class="stat-label">Suggestions</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(245,158,11,0.1); color: #f59e0b;">
          📊
        </div>
        <div class="stat-value">${score}<small style="font-size:var(--text-sm);color:var(--text-tertiary)">/10</small></div>
        <div class="stat-label">Quality Score</div>
      </div>
    </div>

    <!-- Bugs Section -->
    <div class="results-section animate-fade-in-up" style="animation-delay: 200ms;">
      <div class="results-section-title">
        🐛 Bug Report
        <span class="results-section-count">${bugs.length} found</span>
        ${highBugs > 0 ? `<span class="badge badge-high" style="margin-left:4px;">${highBugs} critical</span>` : ''}
      </div>

      ${bugs.length > 0 ? bugs.map(bug => `
        <div class="bug-card severity-${bug.severity || 'low'}">
          <div class="bug-card-header">
            <span class="badge badge-${bug.severity || 'low'}">${(bug.severity || 'low').toUpperCase()}</span>
          </div>
          <p class="bug-card-issue">${escapeHtml(bug.issue)}</p>
        </div>
      `).join('') : `
        <div class="card" style="text-align:center;padding:var(--space-8);">
          <div style="font-size:2rem;margin-bottom:var(--space-3);">🎉</div>
          <p style="color:var(--severity-low);font-weight:600;">No bugs found! Your code looks clean.</p>
        </div>
      `}
    </div>

    <!-- Suggestions Section -->
    <div class="results-section animate-fade-in-up" style="animation-delay: 300ms;">
      <div class="results-section-title">
        💡 Improvement Suggestions
        <span class="results-section-count">${suggestions.length} suggestions</span>
      </div>

      ${suggestions.length > 0 ? suggestions.map((sug, i) => `
        <div style="margin-bottom: var(--space-4);">
          <h5 style="margin-bottom: var(--space-3); color: var(--text-primary);">
            Suggestion ${i + 1}
          </h5>
          <div class="diff-container">
            <div class="diff-block diff-before">
              <div class="diff-header">✕ Before</div>
              <pre><code>${escapeHtml(sug.before)}</code></pre>
            </div>
            <div class="diff-block diff-after">
              <div class="diff-header">✓ After</div>
              <pre><code>${escapeHtml(sug.after)}</code></pre>
            </div>
          </div>
        </div>
      `).join('') : `
        <div class="card" style="text-align:center;padding:var(--space-8);">
          <div style="font-size:2rem;margin-bottom:var(--space-3);">✨</div>
          <p style="color:var(--primary-500);font-weight:600;">No suggestions — your code follows best practices!</p>
        </div>
      `}
    </div>

    <!-- Documentation Section -->
    <div class="results-section animate-fade-in-up" style="animation-delay: 400ms;">
      <div class="results-section-title">
        📄 Code Documentation
      </div>
      <div class="documentation-content">
        ${formatDocumentation(documentation)}
      </div>
    </div>

    <!-- Improved Code Section -->
    ${improvedCode ? `
      <div class="results-section animate-fade-in-up" style="animation-delay: 500ms;">
        <div class="results-section-title">
          ✨ Fully Refactored Code
        </div>
        <div class="code-preview" style="margin-top:0;">
          <div class="code-preview-header">
            <span>Improved Version</span>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-sm btn-ghost" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(improvedCode)}')).then(()=>showToast('Code copied!', 'success'))">📋 Copy</button>
              <button class="btn btn-sm btn-ghost" onclick="downloadImprovedCode()">⬇️ Download Code</button>
            </div>
          </div>
          <div class="code-preview-body">
            <pre><code class="language-${escapeHtml(review.language)}">${escapeHtml(improvedCode)}</code></pre>
          </div>
        </div>
      </div>
    ` : ''}
  `;

  // Animate score ring
  animateScoreRings();

  // Highlight code blocks in suggestions
  body.querySelectorAll('pre code').forEach(block => {
    hljs.highlightElement(block);
  });

  // Store review data for export
  window._currentReview = review;
}

// ============================================
// FORMAT DOCUMENTATION TEXT
// ============================================
function formatDocumentation(text) {
  if (!text) return '<p>No documentation generated.</p>';

  // Convert markdown-like formatting to HTML
  return text
    .split('\n\n')
    .map(para => {
      // Headers
      if (para.startsWith('### ')) {
        return `<h4 style="margin: var(--space-4) 0 var(--space-2); color: var(--text-primary);">${escapeHtml(para.slice(4))}</h4>`;
      }
      if (para.startsWith('## ')) {
        return `<h3 style="margin: var(--space-4) 0 var(--space-2); color: var(--text-primary);">${escapeHtml(para.slice(3))}</h3>`;
      }
      if (para.startsWith('# ')) {
        return `<h2 style="margin: var(--space-4) 0 var(--space-2); color: var(--text-primary);">${escapeHtml(para.slice(2))}</h2>`;
      }

      // Bullet points
      if (para.includes('\n- ') || para.startsWith('- ')) {
        const items = para.split('\n').filter(l => l.startsWith('- ')).map(l => `<li>${escapeHtml(l.slice(2))}</li>`).join('');
        return `<ul style="list-style:disc;padding-left:var(--space-6);margin:var(--space-3) 0;">${items}</ul>`;
      }

      // Code blocks
      if (para.startsWith('```')) {
        const code = para.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
        return `<pre style="margin:var(--space-3) 0;"><code>${escapeHtml(code)}</code></pre>`;
      }

      // Regular paragraphs
      return `<p>${escapeHtml(para)}</p>`;
    })
    .join('');
}

// ============================================
// EXPORT HANDLER
// ============================================
function handleExport() {
  const review = window._currentReview;
  if (!review) {
    showToast('No review data available for export', 'error');
    return;
  }

  const markdown = generateMarkdown(review);
  const filename = `code-review-${review.title.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.md`;
  downloadFile(markdown, filename);
  showToast('Report exported as Markdown!', 'success');
}

// ============================================
// DOWNLOAD IMPROVED CODE HANDLER
// ============================================
function downloadImprovedCode() {
  const review = window._currentReview;
  if (!review || !review.raw_ai_response?.improvedCode) return;
  
  // Find the likely file extension from the language config, handling nested categories
  let ext = '.txt';
  for (const group of APP_CONFIG.languages) {
    if (group.items) {
      const match = group.items.find(l => l.value === review.language);
      if (match && match.extensions?.length > 0) ext = match.extensions[0];
    } else {
      if (group.value === review.language && group.extensions?.length > 0) ext = group.extensions[0];
    }
  }

  const filename = `improved-code${ext}`;
  downloadFile(review.raw_ai_response.improvedCode, filename, 'text/plain');
  showToast(`Code downloaded as ${filename}`, 'success');
}
