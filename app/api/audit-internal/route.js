// app/api/audit-internal/route.js
// Internal-only audit endpoint — runs the GMB audit and returns JSON.
// No email is sent. No Monday.com lead is created. No rate limiting.

export const runtime = 'nodejs';
export const maxDuration = 90;

import { runAudit } from '../../../lib/audit.js';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { companyName, placeId } = body;

  if (!companyName) {
    return Response.json(
      { ok: false, error: 'companyName is required' },
      { status: 400, headers: CORS }
    );
  }

  try {
    const audit = await runAudit(companyName, placeId || null);
    return Response.json({ ok: true, audit }, { headers: CORS });
  } catch (err) {
    console.error('[audit-internal]', err.message);
    return Response.json({ ok: false, error: err.message }, { status: 500, headers: CORS });
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS });
}
