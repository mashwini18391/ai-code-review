/**
 * AI Code Review — Shared Utilities
 * Sanitization, formatting, toast system, skeleton loaders, etc.
 */

// ============================================
// HTML SANITIZATION / XSS PREVENTION
// ============================================

/**
 * Escape HTML entities to prevent XSS
 * @param {string} str - Raw string
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/**
 * Sanitize code input — strip potential script injections
 * @param {string} code - Raw code string
 * @returns {string} Sanitized code
 */
function sanitizeCode(code) {
  if (!code) return '';
  // Remove null bytes
  return code.replace(/\0/g, '');
}

// ============================================
// CODE CHUNKING
// ============================================

/**
 * Split large code into manageable chunks
 * @param {string} code - Full code string
 * @param {number} maxChars - Max characters per chunk
 * @returns {string[]} Array of code chunks
 */
function chunkCode(code, maxChars = APP_CONFIG.maxChunkSize) {
  if (code.length <= maxChars) return [code];

  const chunks = [];
  const lines = code.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    if ((currentChunk + '\n' + line).length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n' + line : line;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// ============================================
// DATE FORMATTING
// ============================================

/**
 * Format a date string to a human-readable format
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Format date for display in detail views
 * @param {string} dateStr - ISO date string
 * @returns {string} Full formatted date
 */
function formatDateFull(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ============================================
// DEBOUNCE
// ============================================

/**
 * Debounce a function
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, ms = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ============================================
// TOAST NOTIFICATION SYSTEM
// ============================================

/**
 * Show a toast notification
 * @param {string} message - Toast message
 * @param {'success' | 'error' | 'warning' | 'info'} type - Toast type
 * @param {number} duration - Duration in ms (default 4000)
 */
function showToast(message, type = 'info', duration = 4000) {
  // Ensure container exists
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // Icon map
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" onclick="this.parentElement.remove()" aria-label="Close">✕</button>
  `;

  container.appendChild(toast);

  // Auto-remove
  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

// ============================================
// SKELETON LOADERS
// ============================================

/**
 * Create skeleton placeholder HTML
 * @param {'card' | 'stat' | 'row' | 'text'} type - Skeleton type
 * @param {number} count - Number of skeletons
 * @returns {string} Skeleton HTML
 */
function createSkeletons(type, count = 3) {
  const templates = {
    stat: `
      <div class="stat-card">
        <div class="skeleton skeleton-circle" style="width:48px;height:48px;margin-bottom:12px"></div>
        <div class="skeleton skeleton-title" style="width:60px"></div>
        <div class="skeleton skeleton-text shorter"></div>
      </div>
    `,
    card: `
      <div class="card" style="padding:20px">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text short"></div>
      </div>
    `,
    row: `
      <div class="review-card" style="pointer-events:none">
        <div class="skeleton skeleton-circle" style="width:48px;height:48px"></div>
        <div style="flex:1">
          <div class="skeleton skeleton-text" style="width:60%;margin-bottom:8px"></div>
          <div class="skeleton skeleton-text shorter"></div>
        </div>
      </div>
    `,
    text: `
      <div style="margin-bottom:8px">
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text short"></div>
      </div>
    `,
  };

  return Array(count).fill(templates[type] || templates.text).join('');
}

// ============================================
// SCORE RING SVG GENERATOR
// ============================================

/**
 * Create an animated score ring SVG
 * @param {number} score - Score from 1-10
 * @param {string} size - 'sm', 'md', 'lg'
 * @returns {string} HTML for score ring
 */
function createScoreRing(score, size = 'md') {
  const sizes = {
    sm: { svg: 60, r: 24, stroke: 5 },
    md: { svg: 120, r: 48, stroke: 8 },
    lg: { svg: 160, r: 64, stroke: 10 },
  };

  const s = sizes[size] || sizes.md;
  const circumference = 2 * Math.PI * s.r;
  const progress = (score / 10) * circumference;
  const offset = circumference - progress;
  const color = getScoreColor(score);
  const center = s.svg / 2;

  return `
    <div class="score-ring-container score-ring-${size}">
      <svg class="score-ring" width="${s.svg}" height="${s.svg}" viewBox="0 0 ${s.svg} ${s.svg}">
        <circle class="ring-bg" cx="${center}" cy="${center}" r="${s.r}" />
        <circle class="ring-fill"
          cx="${center}" cy="${center}" r="${s.r}"
          stroke="${color}"
          stroke-dasharray="${circumference}"
          stroke-dashoffset="${circumference}"
          style="--target-offset: ${offset};"
        />
      </svg>
      <span class="score-ring-value" style="color: ${color}">${score}</span>
    </div>
  `;
}

/**
 * Animate score rings on page
 * Call after rendering score rings in the DOM
 */
function animateScoreRings() {
  setTimeout(() => {
    document.querySelectorAll('.ring-fill').forEach(ring => {
      const targetOffset = ring.style.getPropertyValue('--target-offset');
      ring.style.strokeDashoffset = targetOffset;
    });
  }, 100);
}

// ============================================
// LOADING OVERLAY
// ============================================

/**
 * Show a full-screen loading overlay
 * @param {string} title - Loading title (will be cycled if dynamic is true)
 * @param {string} subtitle - Loading subtitle
 * @param {boolean} dynamic - Whether to cycle through dynamic messages
 * @returns {HTMLElement} The overlay element
 */
function showLoadingOverlay(title = 'Analyzing Code', subtitle = 'This may take a moment...', dynamic = true) {
  const overlay = document.createElement('div');
  overlay.className = 'loading-overlay';
  overlay.id = 'loadingOverlay';
  
  const loadingMessages = [
    "Analyzing semantic structure...",
    "Scanning for security vulnerabilities...",
    "Checking edge cases and logic...",
    "Drafting refactored code...",
    "Finalizing code review report..."
  ];
  
  overlay.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text" id="loadingDynamicText">${escapeHtml(title)}<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span></div>
    <div class="loading-subtext">${escapeHtml(subtitle)}</div>
  `;
  document.body.appendChild(overlay);
  
  if (dynamic) {
    let msgIndex = 0;
    window._loadingInterval = setInterval(() => {
      const textEl = document.getElementById('loadingDynamicText');
      if (textEl) {
        textEl.innerHTML = `${escapeHtml(loadingMessages[msgIndex])}<span class="loading-dots"><span>.</span><span>.</span><span>.</span></span>`;
        msgIndex = (msgIndex + 1) % loadingMessages.length;
      }
    }, 2500);
  }
  
  return overlay;
}

/**
 * Hide the loading overlay
 */
function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (window._loadingInterval) {
    clearInterval(window._loadingInterval);
    window._loadingInterval = null;
  }
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 200);
  }
}

// ============================================
// SIDEBAR HELPERS
// ============================================

/**
 * Initialize sidebar: active state, collapse toggle, mobile menu
 */
function initSidebar() {
  // Set active nav item based on current page
  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.nav-item').forEach(item => {
    const href = item.getAttribute('href');
    if (href && (href === currentPage || href === './' + currentPage)) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Sidebar collapse toggle
  const sidebar = document.querySelector('.sidebar');
  const appMain = document.querySelector('.app-main');
  const collapseBtn = document.querySelector('.sidebar-toggle');

  if (collapseBtn && sidebar && appMain) {
    collapseBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      appMain.classList.toggle('sidebar-collapsed');
      // Save preference
      localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    });

    // Restore collapse state
    if (localStorage.getItem('sidebar-collapsed') === 'true') {
      sidebar.classList.add('collapsed');
      appMain.classList.add('sidebar-collapsed');
    }
  }

  // Mobile menu
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const mobileOverlay = document.querySelector('.mobile-overlay');

  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
      if (mobileOverlay) mobileOverlay.classList.toggle('active');
    });
  }

  if (mobileOverlay && sidebar) {
    mobileOverlay.addEventListener('click', () => {
      sidebar.classList.remove('mobile-open');
      mobileOverlay.classList.remove('active');
    });
  }

  // Sign out button
  document.querySelectorAll('.sign-out-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      signOut();
    });
  });
}

// ============================================
// URL HELPERS
// ============================================

/**
 * Get URL search parameter
 * @param {string} key - Parameter name
 * @returns {string | null} Parameter value
 */
function getUrlParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

/**
 * Navigate to a page with optional params
 * @param {string} page - Page filename
 * @param {Object} params - URL params
 */
function navigateTo(page, params = {}) {
  const url = new URL(page, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  window.location.href = url.toString();
}

// ============================================
// MARKDOWN EXPORT
// ============================================

/**
 * Generate markdown from review data
 * @param {Object} review - Review object
 * @returns {string} Markdown string
 */
function generateMarkdown(review) {
  let md = `# Code Review Report: ${review.title}\n\n`;
  md += `**Date:** ${formatDateFull(review.created_at)}\n`;
  md += `**Language:** ${review.language}\n`;
  md += `**Score:** ${review.score}/10 (${getScoreLabel(review.score)})\n`;
  md += `**Source:** ${review.source_type === 'github' ? review.source_url : 'Manual paste'}\n\n`;

  md += `---\n\n`;

  // Bugs
  md += `## 🐛 Bugs Found (${(review.bugs || []).length})\n\n`;
  if (review.bugs && review.bugs.length > 0) {
    review.bugs.forEach((bug, i) => {
      const severityEmoji = { low: '🟢', medium: '🟡', high: '🔴' };
      md += `### ${i + 1}. ${severityEmoji[bug.severity] || '⚪'} [${(bug.severity || 'unknown').toUpperCase()}] ${bug.issue}\n\n`;
    });
  } else {
    md += `No bugs found! 🎉\n\n`;
  }

  md += `---\n\n`;

  // Suggestions
  md += `## 💡 Suggestions (${(review.suggestions || []).length})\n\n`;
  if (review.suggestions && review.suggestions.length > 0) {
    review.suggestions.forEach((sug, i) => {
      md += `### ${i + 1}. Suggestion\n\n`;
      md += `**Before:**\n\`\`\`\n${sug.before}\n\`\`\`\n\n`;
      md += `**After:**\n\`\`\`\n${sug.after}\n\`\`\`\n\n`;
    });
  } else {
    md += `No suggestions — code looks great!\n\n`;
  }

  md += `---\n\n`;

  // Improved Code (if available)
  if (review.raw_ai_response && review.raw_ai_response.improvedCode) {
    md += `## ✨ Fully Refactored Code\n\n`;
    md += `\`\`\`${review.language}\n${review.raw_ai_response.improvedCode}\n\`\`\`\n\n`;
    md += `---\n\n`;
  }

  // Documentation
  md += `## 📄 Documentation\n\n`;
  md += review.documentation || 'No documentation generated.\n';
  md += '\n\n';

  md += `---\n\n`;
  md += `*Generated by ${APP_CONFIG.name} v${APP_CONFIG.version}*\n`;

  return md;
}

/**
 * Download content as a file
 * @param {string} content - File content
 * @param {string} filename - File name
 * @param {string} mimeType - MIME type
 */
function downloadFile(content, filename, mimeType = 'text/markdown') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
