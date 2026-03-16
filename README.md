# GMB Audit Internal Tool

Internal GMB audit tool — no lead form, no email, saves PDF directly.

## Deploy to Vercel

1. Push this folder to a new GitHub repo
2. Import at https://vercel.com/new → select repo → Framework: Next.js → Deploy
3. Add env vars in Vercel → Project → Settings → Environment Variables:
   - `GOOGLE_PLACES_API_KEY`
   - `ANTHROPIC_API_KEY`
4. Redeploy

## Local Dev

```bash
npm install
cp .env.example .env.local
# fill in keys
npm run dev
```
