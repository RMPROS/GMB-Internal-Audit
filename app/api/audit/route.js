// app/api/audit/route.js
// Step 2 of the widget flow: fetch Google Places data, run Claude audit,
// send the email, then update Monday.com with the score.

export const runtime = 'nodejs';
export const maxDuration = 90; // audit + email can take 40-60s

import { runAudit, sendAuditEmail }         from '../../../lib/audit.js';
import { updateLeadAfterAudit, markLeadError } from '../../../lib/monday.js';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { companyName, placeId, email, contactName, mondayId } = body;

  if (!companyName || !email) {
    return Response.json(
      { ok: false, error: 'companyName and email are required' },
      { status: 400, headers: CORS }
    );
  }

  try {
    // Run the audit (Google Places + Claude)
    const audit = await runAudit(companyName, placeId || null);

    // Send the email report
    await sendAuditEmail(email, contactName, companyName, audit);

    // Update Monday.com score + status (non-blocking — errors are swallowed)
    await updateLeadAfterAudit(mondayId, audit.overallScore);

    return Response.json({ ok: true, audit }, { headers: CORS });
  } catch (err) {
    console.error('[audit]', err.message);
    // Mark lead as Error in Monday
    await markLeadError(mondayId, err.message).catch(() => {});
    return Response.json({ ok: false, error: err.message }, { status: 500, headers: CORS });
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS });
}
