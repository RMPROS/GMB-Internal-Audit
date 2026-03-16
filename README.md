# GMB Audit Internal Tool

Internal Google My Business audit tool for Rental Marketing Pros. Search any business, run an AI audit, and **save the report as a PDF** — no lead form, no email, no CRM.

---

## What Changed from the Public Widget

| Feature              | Public Widget        | Internal Tool      |
|----------------------|----------------------|--------------------|
| Lead capture form    | Required             | Removed            |
| Email via SendGrid   | Yes                  | Removed            |
| Monday.com CRM       | Yes                  | Removed            |
| Rate limiting        | 3/day per IP         | None               |
| Save PDF             | No                   | **Yes — one click**|
| Audit history        | No                   | **Yes (browser)**  |
| Env vars needed      | 6+                   | **2 only**         |

---

## Deploy to Vercel (Separate App)

### 1. Push to a new GitHub repo

```bash
git init
git add .
git commit -m "GMB audit internal tool"
git remote add origin https://github.com/YOUR_ORG/gmb-audit-internal.git
git push -u origin main
```

### 2. Import into Vercel

- Go to https://vercel.com/new
- Click **Import Git Repository** and select your new repo
- Framework: **Next.js** (auto-detected)
- Click **Deploy**

### 3. Add Environment Variables

Vercel → Project → **Settings → Environment Variables**:

| Variable               | Value                          |
|------------------------|--------------------------------|
| `GOOGLE_PLACES_API_KEY`| Your Google Places API key     |
| `ANTHROPIC_API_KEY`    | Your Anthropic key (sk-ant-…)  |

Only these 2 are needed.

### 4. Redeploy

After saving env vars → Deployments → **Redeploy**.

### 5. (Optional) Restrict Access

- **Easiest:** Vercel Pro → Settings → Password Protection
- **Free:** Keep the `.vercel.app` URL internal — don't share publicly
- **Team auth:** Vercel Pro → Settings → Vercel Authentication

---

## Local Dev

```bash
npm install
cp .env.example .env.local
# Edit .env.local with real keys
npm run dev
# http://localhost:3000
```

---

## How It Works

1. Search a business name → Google Places autocomplete
2. Click **Run Audit** → Claude AI scores 5 profile categories
3. Review score ring, findings, priorities
4. Click **Save PDF** → downloads a formatted report
5. **History tab** → all past audits stored in localStorage

