// app/api/lead/route.js
// Step 1 of the widget flow: save the lead to Monday.com before running the audit.
// This ensures the lead is captured even if the audit or email fails downstream.

export const runtime = 'nodejs';

import { createLead } from '../../../lib/monday.js';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── IP Rate Limiter ──────────────────────────────────────────────────────────
// Stored in memory: { "ip": { count: N, resetAt: timestamp } }
// Resets every 24 hours per IP. Limit: 3 submissions per IP per day.
// Note: this resets if the Vercel function instance restarts (cold start),
// which is acceptable — it protects against rapid abuse, not slow drip.
const LIMIT     = 3;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const ipStore   = new Map();

function getClientIP(request) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(ip) {
  const now  = Date.now();
  const entry = ipStore.get(ip);

  // First request or window has expired — reset
  if (!entry || now > entry.resetAt) {
    ipStore.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: LIMIT - 1 };
  }

  // Within window — check count
  if (entry.count >= LIMIT) {
    const hoursLeft = Math.ceil((entry.resetAt - now) / (1000 * 60 * 60));
    return { allowed: false, hoursLeft };
  }

  entry.count++;
  return { allowed: true, remaining: LIMIT - entry.count };
}
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request) {
  // Check rate limit before doing anything
  const ip    = getClientIP(request);
  const limit = checkRateLimit(ip);

  if (!limit.allowed) {
    return Response.json(
      {
        ok: false,
        rateLimited: true,
        error: `You've already run ${LIMIT} audits today. Please try again in ${limit.hoursLeft} hour${limit.hoursLeft === 1 ? '' : 's'}.`,
      },
      { status: 429, headers: CORS }
    );
  }

  try {
    const body = await request.json();
    const { companyName, contactName, email, phone, gmbUrl } = body;

    if (!companyName || !email) {
      return Response.json(
        { ok: false, error: 'companyName and email are required' },
        { status: 400, headers: CORS }
      );
    }

    const mondayId = await createLead({ companyName, contactName, email, phone, gmbUrl });

    return Response.json({ ok: true, mondayId }, { headers: CORS });
  } catch (err) {
    console.error('[lead]', err.message);
    return Response.json({ ok: false, error: err.message }, { status: 500, headers: CORS });
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS });
}
