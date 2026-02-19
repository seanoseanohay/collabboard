# Supabase Setup

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a project
2. In Settings > API, copy the **Project URL** and **anon public** key

## 2. Configure environment

Create `.env.local`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

## 3. Run migration

**Initial schema:** In Supabase Dashboard > SQL Editor, run `supabase/migrations/20260216000000_initial_schema.sql`.

**RLS fix migrations** (fix board creation, recursion, and 403 when joining via share link):

**Option A – npm script (recommended)**

1. Go to Dashboard > **Settings** > **Database**
2. Click **Connect** > choose **Direct connection** (not Session/Transaction pooler)
3. Copy the **URI** string (format: `postgresql://postgres:[PASSWORD]@db.qcnmixjyggvvnlyjhfgl.supabase.co:5432/postgres`)
4. Add to `.env.local`: `SUPABASE_DB_URL=postgresql://postgres:YOUR_PASSWORD@db.qcnmixjyggvvnlyjhfgl.supabase.co:5432/postgres`
5. Run: `npm run db:migrate`

**Option B – SQL Editor**

Run these migrations in order (copy/paste each and Run):
1. `supabase/migrations/20260216000001_fix_board_members_rls_recursion.sql`
2. `supabase/migrations/20260216000002_fix_board_members_self_join.sql`
3. `supabase/migrations/20260216000003_realtime_publication.sql` (adds documents, locks, presence to Realtime — required for shape sync)

## 4. Enable Realtime (required for multi-user sync)

**Important:** This is under **Publications**, not Replication.

### Option A – Dashboard (recommended)

1. In the **left sidebar**, under **DATABASE MANAGEMENT**, click **Publications**
2. Open the `supabase_realtime` publication
3. Turn on these tables: **documents**, **locks**, **presence**

### Option B – SQL Editor

If `supabase_realtime` exists but tables aren't listed, run:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE documents;
ALTER PUBLICATION supabase_realtime ADD TABLE locks;
ALTER PUBLICATION supabase_realtime ADD TABLE presence;
```

(Run each line. If a table is already in the publication, you'll get an error—that's fine.)

## 5. Enable Google auth

### A. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → select or create a project
2. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
3. If prompted, configure **OAuth consent screen**:
   - User type: **External** (or Internal for workspace only)
   - App name: **CollabBoard** (or your choice)
   - Add your email under Developer contact
   - Save
4. Create OAuth client ID:
   - Application type: **Web application**
   - Name: **CollabBoard** (or your choice)
   - **Authorized redirect URIs** → Add:
     ```
     https://qcnmixjyggvvnlyjhfgl.supabase.co/auth/v1/callback
     ```
   - Create → copy **Client ID** and **Client Secret**

### B. Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. **Authentication** → **Providers** → **Google** → Enable
3. Paste **Client ID** and **Client Secret** from Google
4. Save

### C. Redirect URLs (Supabase)

1. **Authentication** → **URL Configuration**
2. **Site URL**: `http://localhost:5173` (dev) or your production URL (e.g. `https://your-app.vercel.app`)
3. **Redirect URLs** – add both:
   - `http://localhost:5173/**`
   - `https://your-app.vercel.app/**` (when you deploy)

## 6. Deploy Edge Function (invite emails)

`supabase/config.toml` sets `verify_jwt = false` for invite-to-board (function validates auth internally).

```bash
supabase login
supabase link --project-ref qcnmixjyggvvnlyjhfgl
supabase functions deploy invite-to-board
supabase secrets set RESEND_API_KEY=re_xxxx   # from resend.com
supabase secrets set RESEND_FROM_EMAIL="CollabBoard <noreply@yourdomain.com>"   # use your verified domain
# After verifying a domain at resend.com/domains, set RESEND_FROM_EMAIL to an email on that domain.
```

## 7. Deploy AI Edge Function (ai-interpret)

Natural language → canvas commands via OpenAI. Requires these secrets:

```bash
supabase functions deploy ai-interpret
supabase secrets set OPENAI_API_KEY=sk-proj-xxxx      # from platform.openai.com
supabase secrets set LANGSMITH_TRACING=true           # enable tracing
supabase secrets set LANGSMITH_API_KEY=lsv2_pt_xxxx   # from smith.langchain.com → Settings → API Keys
```

**Observability:** Traces appear at [smith.langchain.com](https://smith.langchain.com) (inputs, outputs, tokens, latency, errors).

## 8. Run locally

```bash
npm install
npm run dev
```
