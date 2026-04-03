/**
 * AI Code Review — Configuration
 * Supabase client initialization and app constants
 */

// ============================================
// SUPABASE CONFIGURATION
// ⬇️ PASTE YOUR KEYS BELOW ⬇️
// Get these from: https://app.supabase.com → Your Project → Settings → API
// ============================================
const SUPABASE_URL = 'https://tisuqaytuxhghhacvdfa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpc3VxYXl0dXhoZ2hoYWN2ZGZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMzk5ODgsImV4cCI6MjA5MDcxNTk4OH0.yHMYhPgqtIrJBojp1saRiYELeow86v276XvuiqkipkU';

// Initialize Supabase client
window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// APP CONSTANTS
// ============================================
const APP_CONFIG = {
  name: 'CodeLens AI',
  tagline: 'AI-Powered Code Review Platform',
  version: '1.0.0',

  // Supabase Edge Function base URL
  functionsUrl: `${SUPABASE_URL}/functions/v1`,

  // Supported programming languages
  languages: [
    { value: 'auto', label: 'Auto Detect', extensions: [] },
    {
      category: 'Web & Frontend',
      items: [
        { value: 'javascript', label: 'JavaScript', extensions: ['.js', '.jsx', '.mjs'] },
        { value: 'typescript', label: 'TypeScript', extensions: ['.ts', '.tsx'] },
        { value: 'html', label: 'HTML', extensions: ['.html', '.htm'] },
        { value: 'css', label: 'CSS', extensions: ['.css', '.scss', '.sass'] }
      ]
    },
    {
      category: 'Systems & Compile',
      items: [
        { value: 'c', label: 'C', extensions: ['.c', '.h'] },
        { value: 'cpp', label: 'C++', extensions: ['.cpp', '.cc', '.hpp'] },
        { value: 'csharp', label: 'C#', extensions: ['.cs'] },
        { value: 'java', label: 'Java', extensions: ['.java'] },
        { value: 'go', label: 'Go', extensions: ['.go'] },
        { value: 'rust', label: 'Rust', extensions: ['.rs'] },
        { value: 'scala', label: 'Scala', extensions: ['.scala'] }
      ]
    },
    {
      category: 'General & Scripting',
      items: [
        { value: 'python', label: 'Python', extensions: ['.py'] },
        { value: 'ruby', label: 'Ruby', extensions: ['.rb', '.erb'] },
        { value: 'bash', label: 'Bash/Shell', extensions: ['.sh', '.bash'] },
        { value: 'r', label: 'R', extensions: ['.r', '.R'] },
        { value: 'matlab', label: 'MATLAB', extensions: ['.m'] }
      ]
    },
    {
      category: 'Mobile & App',
      items: [
        { value: 'swift', label: 'Swift', extensions: ['.swift'] },
        { value: 'kotlin', label: 'Kotlin', extensions: ['.kt'] },
        { value: 'dart', label: 'Dart', extensions: ['.dart'] }
      ]
    },
    {
      category: 'Database & Other',
      items: [
        { value: 'sql', label: 'SQL', extensions: ['.sql'] },
        { value: 'php', label: 'PHP', extensions: ['.php'] }
      ]
    }
  ],

  // File extensions to fetch from GitHub
  supportedExtensions: [
    '.js', '.jsx', '.mjs', '.ts', '.tsx',
    '.py', '.java', '.cs', '.cpp', '.cc', '.h', '.hpp',
    '.go', '.rs', '.rb', '.php', '.c', '.swift', '.kt',
  ],

  // Max code length per chunk (characters)
  maxChunkSize: 12000,

  // Max total code length
  maxCodeLength: 50000,

  // Pagination
  reviewsPerPage: 10,

  // Score thresholds for color coding
  scoreColors: {
    excellent: { min: 9, color: '#10b981' },  // green
    good: { min: 7, color: '#22c55e' },        // light green
    average: { min: 5, color: '#f59e0b' },     // amber
    poor: { min: 3, color: '#f97316' },        // orange
    bad: { min: 0, color: '#ef4444' },         // red
  },
};

/**
 * Get the color for a given score
 * @param {number} score - Score from 1-10
 * @returns {string} Hex color code
 */
function getScoreColor(score) {
  if (score >= 9) return APP_CONFIG.scoreColors.excellent.color;
  if (score >= 7) return APP_CONFIG.scoreColors.good.color;
  if (score >= 5) return APP_CONFIG.scoreColors.average.color;
  if (score >= 3) return APP_CONFIG.scoreColors.poor.color;
  return APP_CONFIG.scoreColors.bad.color;
}

/**
 * Get the label for a given score
 * @param {number} score - Score from 1-10
 * @returns {string} Score label
 */
function getScoreLabel(score) {
  if (score >= 9) return 'Excellent';
  if (score >= 7) return 'Good';
  if (score >= 5) return 'Average';
  if (score >= 3) return 'Needs Work';
  return 'Critical';
}

/**
 * Detect language from file extension
 * @param {string} filename - File name
 * @returns {string} Language value
 */
function detectLanguage(filename) {
  const ext = '.' + filename.split('.').pop().toLowerCase();
  for (const group of APP_CONFIG.languages) {
    if (group.items) {
      for (const lang of group.items) {
        if (lang.extensions.includes(ext)) return lang.value;
      }
    } else {
      if (group.extensions && group.extensions.includes(ext)) return group.value;
    }
  }
  return 'auto';
}
