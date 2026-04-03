/// <reference path="../deno.d.ts" />
// =============================================
// AI Code Review — fetch-github Edge Function
// Fetches public repository file tree from GitHub API
// =============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPPORTED_EXTENSIONS = [
  '.js', '.jsx', '.mjs', '.ts', '.tsx',
  '.py', '.java', '.cs', '.cpp', '.cc', '.h', '.hpp',
  '.go', '.rs', '.rb', '.php', '.c', '.swift', '.kt',
];

const EXCLUDED_DIRS = [
  'node_modules', '.git', 'vendor', 'dist', 'build',
  '__pycache__', '.next', 'coverage', '.vscode', '.idea',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse input
    const { owner, repo, path = '' } = await req.json();

    if (!owner || !repo) {
      return new Response(
        JSON.stringify({ error: 'Owner and repo are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize
    const safeOwner = owner.replace(/[^a-zA-Z0-9_\-\.]/g, '');
    const safeRepo = repo.replace(/[^a-zA-Z0-9_\-\.]/g, '');

    // Fetch files recursively
    const files = await fetchContents(safeOwner, safeRepo, path, 0);

    return new Response(
      JSON.stringify({ files, count: files.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('fetch-github error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Failed to fetch repository' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function fetchContents(
  owner: string,
  repo: string,
  path: string,
  depth: number
): Promise<any[]> {
  if (depth > 3) return []; // Max recursion depth

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const response = await fetch(apiUrl, {
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'CodeLens-AI',
    },
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error('Repository not found or is private');
    if (response.status === 403) throw new Error('GitHub API rate limit exceeded');
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const items = await response.json();
  let files: any[] = [];

  for (const item of items) {
    if (item.type === 'file') {
      const ext = '.' + item.name.split('.').pop().toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        files.push({
          name: item.name,
          path: item.path,
          size: item.size,
          download_url: item.download_url,
          type: 'file',
        });
      }
    } else if (item.type === 'dir' && !EXCLUDED_DIRS.includes(item.name) && !item.name.startsWith('.')) {
      const subFiles = await fetchContents(owner, repo, item.path, depth + 1);
      files = files.concat(subFiles);
    }
  }

  return files;
}
