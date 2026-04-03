# CodeLens AI — AI-Powered Code Review Platform

<div align="center">
  <h3>🔍 AI Code Review That Thinks Like a Senior Developer</h3>
  <p>Paste code or analyze GitHub repositories for instant AI-powered bug detection, performance suggestions, and quality scoring.</p>
</div>

---

## ✨ Features

- **🔐 Google Authentication** — Secure login via Supabase Auth with Google OAuth
- **📊 User Dashboard** — View past reviews, quality scores, and quick stats
- **⚙️ Admin Dashboard** — Platform analytics, user management, score trend charts
- **📝 Code Input** — Paste code or fetch files from public GitHub repositories
- **🐙 GitHub Integration** — Browse repo file trees, select files for review
- **🤖 AI Code Analysis** — Powered by OpenRouter (Gemini/GPT/Claude) via secure Edge Functions
- **🐛 Bug Detection** — Logical errors, security vulnerabilities, performance issues
- **💡 Suggestions** — Side-by-side before/after code improvements
- **⭐ Quality Score** — Animated 1-10 scoring with visual progress ring
- **📄 Auto Documentation** — AI-generated explanation of code functions
- **📋 Review History** — Search, filter, and revisit past reviews
- **📥 Markdown Export** — Download reports as `.md` files
- **🌙 Dark/Light Mode** — System-aware theme with manual toggle
- **📱 Responsive Design** — Works on desktop, tablet, and mobile

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML, CSS, JavaScript (Vanilla) |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| AI | OpenRouter API (Gemini, GPT, Claude) |
| Auth | Google OAuth via Supabase |
| Hosting | Any static host (Vercel, Netlify, GitHub Pages) |

---

## 🚀 Setup Guide

### Prerequisites

- [Supabase Account](https://supabase.com) (free tier works)
- [Google Cloud Console](https://console.cloud.google.com) (for OAuth credentials)
- [OpenRouter Account](https://openrouter.ai) (free tier available)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for deploying Edge Functions)
- A code editor (VS Code recommended)

---

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **Anon Key** from **Settings → API**
3. Also note your **Service Role Key** (keep this secret!)

---

### Step 2: Set Up the Database

1. Go to **SQL Editor** in your Supabase Dashboard
2. Copy the contents of `supabase/schema.sql`
3. Paste and run the SQL — this creates:
   - `profiles` table (syncs with auth users)
   - `reviews` table (stores code review results)
   - Row Level Security (RLS) policies
   - Auto-profile creation trigger
   - Ownership-based access controls

---

### Step 3: Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Navigate to **APIs & Services → OAuth consent screen**
   - Choose **External** user type
   - Add your Supabase domain to authorized domains: `your-project-ref.supabase.co`
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Type: **Web application**
   - Authorized redirect URIs: `https://your-project-ref.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client Secret**
6. In Supabase Dashboard → **Authentication → Providers → Google**
   - Enable Google provider
   - Paste Client ID and Client Secret
   - Save

---

### Step 4: Configure the Frontend

1. Open `js/config.js`
2. Replace the placeholder values:
   ```javascript
   const SUPABASE_URL = 'https://your-project-ref.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key-here';
   ```

---

### Step 5: Get OpenRouter API Key

1. Go to [openrouter.ai](https://openrouter.ai)
2. Sign up and get your API key
3. The free tier includes access to `google/gemini-2.0-flash-001:free`

---

### Step 6: Deploy Edge Functions

1. Install [Supabase CLI](https://supabase.com/docs/guides/cli):
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Set secrets:
   ```bash
   supabase secrets set OPENROUTER_API_KEY=your-openrouter-api-key
   supabase secrets set OPENROUTER_MODEL=google/gemini-2.0-flash-001:free
   ```

5. Deploy all functions:
   ```bash
   supabase functions deploy analyze-code --no-verify-jwt
   supabase functions deploy fetch-github --no-verify-jwt
   supabase functions deploy admin-stats --no-verify-jwt
   ```

   > **Note:** We use `--no-verify-jwt` because we handle JWT verification manually inside the functions. This gives us more control over error messages and CORS.

---

### Step 7: Run Locally

You can serve the frontend with any static file server:

**Option A: VS Code Live Server**
1. Install the "Live Server" extension in VS Code
2. Right-click `index.html` → "Open with Live Server"

**Option B: Python**
```bash
cd ai-code-review
python -m http.server 3000
```

**Option C: Node.js**
```bash
npx serve .
```

Then open `http://localhost:3000` (or whatever port is used).

---

### Step 8: Make Yourself Admin

After signing in for the first time:

1. Go to **Supabase Dashboard → SQL Editor**
2. Run:
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = 'your-email@gmail.com';
   ```
3. Refresh the app — you should see the Admin Panel link in the sidebar

---

## 📁 Project Structure

```
ai-code-review/
├── index.html              # Login page
├── dashboard.html           # User dashboard
├── admin.html               # Admin dashboard
├── input.html               # Code input page
├── results.html             # Review results page
├── history.html             # Review history page
├── css/
│   ├── variables.css        # Design tokens, themes
│   ├── base.css             # Reset, typography
│   ├── animations.css       # Keyframes, transitions
│   ├── components.css       # Buttons, cards, badges...
│   ├── layout.css           # Sidebar, navbar, grid
│   └── pages.css            # Page-specific styles
├── js/
│   ├── config.js            # Supabase init, constants
│   ├── auth.js              # Google OAuth, route guards
│   ├── theme.js             # Dark/light mode
│   ├── utils.js             # Utilities, toasts, export
│   ├── dashboard.js         # Dashboard logic
│   ├── admin.js             # Admin panel logic
│   ├── input.js             # Code input + GitHub
│   ├── results.js           # Results rendering
│   └── history.js           # History + search
├── supabase/
│   ├── schema.sql           # Database schema + RLS
│   └── functions/
│       ├── analyze-code/    # AI analysis edge function
│       ├── fetch-github/    # GitHub fetcher
│       └── admin-stats/     # Admin analytics
├── .env.example             # Environment template
└── README.md                # This file
```

---

## 🔒 Security

- **API keys** are never exposed in frontend code
- **OpenRouter calls** happen exclusively through Supabase Edge Functions
- **JWT validation** on every Edge Function request
- **Row Level Security** ensures users can only access their own data
- **Input sanitization** on all user-submitted code
- **CORS headers** properly configured on all endpoints
- **Admin role** verification at both frontend and backend levels

---

## 🎨 Design

- **Theme:** Deep indigo/violet primary with emerald accents
- **Typography:** Inter (UI) + JetBrains Mono (code)
- **Components:** Glassmorphism cards, animated score rings, skeleton loaders
- **Animations:** Staggered entrance, fade-in-up, shimmer loading, pulse effects
- **Responsive:** Mobile-first with collapsible sidebar
- **Accessibility:** Semantic HTML, ARIA labels, keyboard navigation

---

## 📜 License

MIT License — feel free to use this project for learning, portfolio, or production.
