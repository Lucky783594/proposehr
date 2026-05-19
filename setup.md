# ProposeHer — Complete Setup Guide 🚀

## Supabase mein yeh SQL run karo:

```sql
CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  girlfriend_name TEXT NOT NULL,
  your_name TEXT,
  custom_message TEXT,
  creator_ip TEXT,
  views INTEGER DEFAULT 0,
  yes_clicked BOOLEAN DEFAULT FALSE,
  yes_clicked_at TIMESTAMPTZ,
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_proposals_created ON proposals(created_at DESC);
CREATE INDEX idx_proposals_yes ON proposals(yes_clicked);

-- Disable row-level security (service key se access hoga)
ALTER TABLE proposals DISABLE ROW LEVEL SECURITY;
```

---

## Netlify Environment Variables (Site Settings > Environment Variables):

```
SUPABASE_URL        = https://xxxx.supabase.co
SUPABASE_SERVICE_KEY = eyJhbG...  (Service Role Key, NOT anon key)
ADMIN_PASSWORD      = tumhara-secret-password-yahan
```

---

## Deploy Steps:

1. **Supabase account banao** → supabase.com
   - New project → SQL Editor mein upar wala SQL run karo
   - Settings > API se URL aur service_role key copy karo

2. **GitHub pe push karo:**
   ```
   git init
   git add .
   git commit -m "ProposeHer launch"
   git remote add origin https://github.com/tumhara/proposehr
   git push -u origin main
   ```

3. **Netlify pe deploy karo:**
   - netlify.com > New Site > Import from GitHub
   - Repo select karo
   - Environment variables add karo (upar wale)
   - Deploy!

4. **Custom domain (optional):**
   - Netlify > Domain Settings > Custom Domain

---

## URLs after deploy:
- `proposehr.netlify.app/`          → Landing page (naam dalo)
- `proposehr.netlify.app/p/abc123`  → Proposal page
- `proposehr.netlify.app/admin.html` → Admin panel

---

## Admin Panel Features:
- 📊 Total proposals, views, yes count, today's count
- 💕 Yes Rate (kitne logo ne yes click kiya)
- 💌 All proposals with IP, date, views
- 🔍 Search by name
- 🗑️ Delete any proposal
- 🌸 Top names leaderboard

---

## API Endpoints:
- POST `/api/create` → proposal banao
- GET  `/api/get?id=xxx` → proposal fetch karo (+ view count)
- POST `/api/yes?id=xxx` → yes track karo
- GET  `/api/stats` → admin stats (x-admin-key header required)
- POST `/api/delete?id=xxx` → delete (x-admin-key header required)