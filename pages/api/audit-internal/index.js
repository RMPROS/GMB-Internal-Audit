import { runAudit } from '../../../lib/audit.js';

export const config = {
  api: { bodyParser: true, responseLimit: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { companyName, placeId } = req.body || {};
  if (!companyName) return res.status(400).json({ ok: false, error: 'companyName is required' });

  try {
    const audit = await runAudit(companyName, placeId || null);
    return res.status(200).json({ ok: true, audit });
  } catch (err) {
    console.error('[audit-internal]', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
