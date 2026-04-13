/**
 * AI Code Review — Code Input Page Logic
 * Handles paste code, GitHub repo fetching, file tree, and code analysis submission
 */

// State
let selectedGithubFile = null;
let githubFiles = [];

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  const session = await requireAuth();
  if (!session) return;

  initSidebar();
  await initSidebarUser();

  // Populate language selector
  const langSelect = document.getElementById('langSelect');
  APP_CONFIG.languages.forEach(group => {
    if (group.category) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.category;
      group.items.forEach(lang => {
        const opt = document.createElement('option');
        opt.value = lang.value;
        opt.textContent = lang.label;
        optgroup.appendChild(opt);
      });
      langSelect.appendChild(optgroup);
    } else {
      const opt = document.createElement('option');
      opt.value = group.value;
      opt.textContent = group.label;
      langSelect.appendChild(opt);
    }
  });

  // Code textarea live info
  const codeTextarea = document.getElementById('codeTextarea');
  codeTextarea.addEventListener('input', () => {
    updateCodeInfo(codeTextarea.value);
  });

  // Handle Tab key in textarea
  codeTextarea.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = codeTextarea.selectionStart;
      const end = codeTextarea.selectionEnd;
      codeTextarea.value = codeTextarea.value.substring(0, start) + '    ' + codeTextarea.value.substring(end);
      codeTextarea.selectionStart = codeTextarea.selectionEnd = start + 4;
      updateCodeInfo(codeTextarea.value);
    }
  });

  // Manage hljs themes is now handled by results.js global observer
});

// ============================================
// TAB SWITCHING
// ============================================
function switchInputTab(tabName) {
  document.querySelectorAll('.input-tabs .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
}

// ============================================
// CODE INFO UPDATE
// ============================================
function updateCodeInfo(code) {
  const chars = code.length;
  const lines = code ? code.split('\n').length : 0;
  document.getElementById('codeInfo').textContent = `${chars.toLocaleString()} characters · ${lines} lines`;
}

// ============================================
// ANALYZE CODE (Paste Tab)
// ============================================
async function handleAnalyze() {
  const code = document.getElementById('codeTextarea').value.trim();
  const language = document.getElementById('langSelect').value;
  const title = document.getElementById('reviewTitle').value.trim() || `Code Review — ${new Date().toLocaleDateString()}`;

  if (!code) {
    showToast('Please paste some code to analyze', 'warning');
    return;
  }

  if (code.length < 10) {
    showToast('Code is too short. Please provide more code.', 'warning');
    return;
  }

  if (code.length > APP_CONFIG.maxCodeLength) {
    showToast(`Code exceeds ${APP_CONFIG.maxCodeLength.toLocaleString()} character limit`, 'warning');
    return;
  }

  await submitForAnalysis(code, language, title, 'paste', null);
}

// ============================================
// ANALYZE CODE (GitHub Tab)
// ============================================
async function handleAnalyzeGithub() {
  if (!selectedGithubFile || !selectedGithubFile.content) {
    showToast('Please select a file from the repository', 'warning');
    return;
  }

  const title = document.getElementById('reviewTitle').value.trim() || selectedGithubFile.name;
  const language = detectLanguage(selectedGithubFile.name);
  const githubUrl = document.getElementById('githubUrl').value.trim();

  await submitForAnalysis(selectedGithubFile.content, language, title, 'github', githubUrl);
}

// ============================================
// SUBMIT FOR ANALYSIS (shared)
// ============================================
async function submitForAnalysis(code, language, title, sourceType, sourceUrl) {
  const btn = sourceType === 'paste'
    ? document.getElementById('analyzeBtn')
    : document.getElementById('analyzeGithubBtn');

  btn.classList.add('btn-loading');
  btn.disabled = true;

  const overlay = showLoadingOverlay('Analyzing Your Code', 'Our AI is reviewing your code like a senior developer...');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    const headers = await getAuthHeader();
    const sanitizedCode = sanitizeCode(code);

    const response = await fetch(`${APP_CONFIG.functionsUrl}/analyze-code`, {
      method: 'POST',
      headers: headers,
      signal: controller.signal,
      body: JSON.stringify({
        code: sanitizedCode,
        language: language,
        title: title,
        source_type: sourceType,
        source_url: sourceUrl,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Analysis failed (${response.status})`);
    }

    const result = await response.json();

    if (result.review_id) {
      showToast('Analysis complete!', 'success');
      
      // Redirect to the dedicated full-screen results page
      window.location.href = `results.html?id=${result.review_id}`;
    } else {
      throw new Error('No review ID returned');
    }

  } catch (err) {
    console.error('Analysis error:', err);
    if (err.name === 'AbortError') {
      showToast('Analysis timed out. Try with a smaller code snippet or wait a moment.', 'warning');
    } else {
      showToast(err.message || 'Analysis failed. Please try again.', 'error');
    }
  } finally {
    hideLoadingOverlay();
    btn.classList.remove('btn-loading');
    btn.disabled = false;
  }
}

// ============================================
// FETCH GITHUB REPO FILES
// ============================================
async function handleFetchRepo() {
  const urlInput = document.getElementById('githubUrl');
  const url = urlInput.value.trim();

  if (!url) {
    showToast('Please enter a GitHub repository URL', 'warning');
    return;
  }

  // Parse owner/repo from URL
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
  if (!match) {
    showToast('Invalid GitHub URL. Format: https://github.com/owner/repo', 'error');
    return;
  }

  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');

  const fetchBtn = document.getElementById('fetchRepoBtn');
  fetchBtn.classList.add('btn-loading');
  fetchBtn.disabled = true;

  try {
    // Use GitHub API directly (public repos)
    const files = await fetchGithubContents(owner, repo, '');

    if (files.length === 0) {
      showToast('No supported code files found in this repository', 'warning');
      return;
    }

    githubFiles = files;
    renderFileTree(files);

    document.getElementById('fileTreeContainer').style.display = 'block';
    showToast(`Found ${files.length} code files`, 'success');

  } catch (err) {
    console.error('GitHub fetch error:', err);
    showToast(err.message || 'Failed to fetch repository', 'error');
  } finally {
    fetchBtn.classList.remove('btn-loading');
    fetchBtn.disabled = false;
  }
}

// ============================================
// FETCH GITHUB CONTENTS (recursive)
// ============================================
async function fetchGithubContents(owner, repo, path, depth = 0) {
  if (depth > 3) return []; // Max depth to avoid too many requests

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(apiUrl);

  if (!response.ok) {
    if (response.status === 404) throw new Error('Repository not found or is private');
    if (response.status === 403) throw new Error('API rate limit exceeded. Try again later.');
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const items = await response.json();
  let files = [];

  for (const item of items) {
    if (item.type === 'file') {
      // Check if file extension is supported
      const ext = '.' + item.name.split('.').pop().toLowerCase();
      if (APP_CONFIG.supportedExtensions.includes(ext)) {
        files.push({
          name: item.name,
          path: item.path,
          size: item.size,
          download_url: item.download_url,
          type: 'file',
        });
      }
    } else if (item.type === 'dir' && !item.name.startsWith('.') && item.name !== 'node_modules' && item.name !== 'vendor' && item.name !== 'dist' && item.name !== 'build') {
      // Recursively fetch directories
      const subFiles = await fetchGithubContents(owner, repo, item.path, depth + 1);
      files = files.concat(subFiles);
    }
  }

  return files;
}

// ============================================
// RENDER FILE TREE
// ============================================
function renderFileTree(files) {
  const container = document.getElementById('fileTree');

  // Group by directory
  const tree = {};
  files.forEach(f => {
    const dir = f.path.includes('/') ? f.path.substring(0, f.path.lastIndexOf('/')) : '.';
    if (!tree[dir]) tree[dir] = [];
    tree[dir].push(f);
  });

  let html = '';

  Object.keys(tree).sort().forEach(dir => {
    if (dir !== '.') {
      html += `<div class="file-tree-item folder">
        <span class="file-tree-icon">📁</span>
        <span>${escapeHtml(dir)}</span>
      </div>`;
    }

    tree[dir].forEach(file => {
      const indent = dir !== '.' ? 'file-tree-indent' : '';
      const icon = getFileIcon(file.name);
      html += `
        <div class="file-tree-item ${indent}" data-path="${escapeHtml(file.path)}" onclick="selectFile(this, '${escapeHtml(file.path)}')">
          <span class="file-tree-icon">${icon}</span>
          <span>${escapeHtml(file.name)}</span>
          <small style="margin-left:auto;color:var(--text-tertiary);">${formatFileSize(file.size)}</small>
        </div>
      `;
    });
  });

  container.innerHTML = html;
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    js: '🟨', jsx: '⚛️', ts: '🔷', tsx: '⚛️',
    py: '🐍', java: '☕', cs: '🔮', go: '🐹',
    rs: '🦀', rb: '💎', php: '🐘', c: '©️', cpp: '©️',
    swift: '🍎', kt: '🟣',
  };
  return icons[ext] || '📄';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  return (bytes / 1024).toFixed(1) + ' KB';
}

// ============================================
// SELECT FILE FROM TREE
// ============================================
async function selectFile(element, path) {
  // Update selected state
  document.querySelectorAll('.file-tree-item.selected').forEach(el => el.classList.remove('selected'));
  element.classList.add('selected');

  const file = githubFiles.find(f => f.path === path);
  if (!file) return;

  // Show loading in preview
  const previewContainer = document.getElementById('codePreviewContainer');
  previewContainer.style.display = 'block';
  document.getElementById('codePreviewBlock').textContent = 'Loading file content...';

  try {
    // Fetch file content
    const response = await fetch(file.download_url);
    if (!response.ok) throw new Error('Failed to fetch file content');
    const content = await response.text();

    file.content = content;
    selectedGithubFile = file;

    // Update preview
    document.getElementById('previewFileName').textContent = file.name;
    const lang = detectLanguage(file.name);
    document.getElementById('previewLang').textContent = lang;

    const codeBlock = document.getElementById('codePreviewBlock');
    codeBlock.textContent = content;
    codeBlock.className = `language-${lang}`;
    hljs.highlightElement(codeBlock);

    document.getElementById('githubCodeInfo').textContent = `${content.length.toLocaleString()} characters · ${content.split('\n').length} lines`;

  } catch (err) {
    console.error('File fetch error:', err);
    showToast('Failed to load file content', 'error');
  }
}
