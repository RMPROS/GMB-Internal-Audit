// lib/audit.js — Google Places data fetch + Claude AI audit + SendGrid email

// ─── Fetch real data from Google Places API ───────────────────────────────────
async function fetchPlacesData(bizName, placeId) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  let resolvedPlaceId = placeId;

  // If no placeId passed, find it via text search
  if (!resolvedPlaceId) {
    const findUrl = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json'
      + '?input=' + encodeURIComponent(bizName)
      + '&inputtype=textquery'
      + '&fields=place_id'
      + '&key=' + apiKey;
    try {
      const fr   = await fetch(findUrl);
      const fd   = await fr.json();
      resolvedPlaceId = fd.candidates?.[0]?.place_id || null;
    } catch(e) {
      console.error('[PLACES] find error:', e.message);
    }
  }

  if (!resolvedPlaceId) return null;

  const detailUrl = 'https://maps.googleapis.com/maps/api/place/details/json'
    + '?place_id=' + resolvedPlaceId
    + '&fields=name,rating,user_ratings_total,formatted_address,formatted_phone_number'
    + ',opening_hours,website,photos,types,editorial_summary,reviews,business_status'
    + '&key=' + apiKey;

  try {
    const dr = await fetch(detailUrl);
    const dd = await dr.json();
    return dd.result || null;
  } catch(e) {
    console.error('[PLACES] detail error:', e.message);
    return null;
  }
}

// ─── Format Places data for the Claude prompt ─────────────────────────────────
function formatPlacesData(p) {
  if (!p) return null;
  const lines = [
    '=== REAL GOOGLE BUSINESS PROFILE DATA ===',
    'Business Name: '    + (p.name || 'Unknown'),
    'Status: '           + (p.business_status || 'Unknown'),
    'Rating: '           + (p.rating ? p.rating + '/5' : 'No rating'),
    'Total Reviews: '    + (p.user_ratings_total || 0),
    'Address: '          + (p.formatted_address || 'Not listed'),
    'Phone: '            + (p.formatted_phone_number || 'Not listed'),
    'Website: '          + (p.website || 'Not listed'),
    'Photo Count: '      + (p.photos ? p.photos.length + ' (API max 10, actual may be higher)' : '0'),
    'Categories/Types: ' + (p.types ? p.types.join(', ') : 'None'),
    'Description: '      + (p.editorial_summary ? p.editorial_summary.overview : 'No description set'),
  ];
  if (p.opening_hours) {
    lines.push('Hours Listed: Yes');
    lines.push('Currently Open: ' + (p.opening_hours.open_now ? 'Yes' : 'No'));
    if (p.opening_hours.weekday_text) lines.push('Hours: ' + p.opening_hours.weekday_text.join(' | '));
  } else {
    lines.push('Hours Listed: No - MISSING');
  }
  if (p.reviews?.length) {
    lines.push('Recent Review Samples:');
    p.reviews.slice(0, 3).forEach(r => lines.push('  - ' + r.rating + '/5 stars: "' + r.text.substring(0, 100) + '"'));
  }
  lines.push('=== END REAL DATA ===');
  return lines.join('\n');
}

// ─── Run Claude audit ──────────────────────────────────────────────────────────
export async function runAudit(bizName, placeId) {
  const placesData    = await fetchPlacesData(bizName, placeId);
  const realDataBlock = formatPlacesData(placesData);

  const dataSection = realDataBlock
    ? 'Use the following REAL data pulled directly from the Google Places API. Base your audit findings strictly on this data — do not invent or assume anything not listed here:\n\n' + realDataBlock + '\n\n'
    : 'Note: Real-time Places API data was unavailable. Make reasonable estimates based on the business type, but flag that data could not be verified.\n\n';

  const prompt = 'You are a Google My Business (GMB) local SEO expert auditing the profile for "' + bizName + '".\n\n'
    + dataSection
    + 'Generate a GMB audit based ONLY on the data fields listed above. Return ONLY valid JSON, no markdown.\n\n'
    + 'WHAT YOU CAN SEE AND COMMENT ON:\n'
    + '- Business name, address, phone number, website (listed or missing)\n'
    + '- Business hours (set or missing)\n'
    + '- Star rating and total review count\n'
    + '- Up to 5 sample review texts\n'
    + '- Photo count (number of photos returned)\n'
    + '- Business description (written or blank)\n'
    + '- Business categories/types\n'
    + '- Business status (open/closed)\n\n'
    + 'WHAT YOU CANNOT SEE - NEVER COMMENT ON THESE:\n'
    + '- Review response rate or whether owner responds to reviews\n'
    + '- Photo quality, captions, or what the photos show\n'
    + '- Google Posts history or frequency\n'
    + '- Q&A section content\n'
    + '- Profile views, clicks, or insights\n'
    + '- Competitor comparisons\n\n'
    + 'For the Engagement section, score it 50 and give 3 general best-practice recommendations about posting frequency and Q&A setup.\n'
    + 'For the Reviews section, base findings on the star rating and review count only. Do NOT mention response rate.\n'
    + 'For the Photos section, base findings on the photo count only.\n\n'
    + 'JSON structure:\n'
    + '{\n'
    + '  "overallScore": <0-100>,\n'
    + '  "grade": "<A|B|C|F>",\n'
    + '  "summary": "<2-sentence summary>",\n'
    + '  "sections": [\n'
    + '    { "id": "info",       "icon": "🏢", "title": "Business Information",   "subtitle": "Name, address, phone, hours, categories", "score": <0-100>, "findings": [{ "status": "<good|warning|critical>", "title": "<finding>", "desc": "<actionable detail>" }] },\n'
    + '    { "id": "photos",     "icon": "📸", "title": "Photos & Visual Content","subtitle": "Image count and variety",                 "score": <0-100>, "findings": [...] },\n'
    + '    { "id": "reviews",    "icon": "⭐", "title": "Reviews & Reputation",   "subtitle": "Star rating and review volume",            "score": <0-100>, "findings": [...] },\n'
    + '    { "id": "seo",        "icon": "🔍", "title": "Local SEO & Keywords",   "subtitle": "Description, categories, website",         "score": <0-100>, "findings": [...] },\n'
    + '    { "id": "engagement", "icon": "💬", "title": "Posts & Engagement",     "subtitle": "Google Posts and Q&A best practices",      "score": 50,      "findings": [...] }\n'
    + '  ],\n'
    + '  "topPriorities": ["<action 1>", "<action 2>", "<action 3>"]\n'
    + '}\n\n'
    + 'Scoring guide:\n'
    + '- 0 reviews = 20, 1-5 = 40, 6-15 = 60, 16-50 = 75, 50+ = 90\n'
    + '- Rating 4.5-5.0 = good, 4.0-4.4 = warning, below 4.0 = critical\n'
    + '- 0 photos = critical (20), 1-3 = warning (40), 4-9 = ok (65), 10 = good (80)\n'
    + '- Missing hours = critical, missing phone = warning, missing website = warning, missing description = critical\n'
    + '- Each section needs exactly 3 findings\n'
    + '- Write all findings in second person: "your profile", "your photos", "your reviews"\n'
    + '- Use specific numbers from the data\n'
    + '- CRITICAL: Plain ASCII only. No smart quotes, em dashes, or special Unicode.';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await res.json();
  if (data.error) throw new Error('Claude error: ' + data.error.message);

  let text = data.content.map(i => i.text || '').join('');
  let clean = text
    .replace(/```json|```/g, '')
    .replace(/['']/g, "'").replace(/[""]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

  const start = clean.indexOf('{'), end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1) clean = clean.slice(start, end + 1);

  // Attempt 1: direct parse
  try { return JSON.parse(clean); } catch(e1) {}

  // Attempt 2: strip control chars
  try {
    const c2 = clean.replace(/[\x00-\x1F\x7F]/g, c => c==='\n'?'\\n':c==='\t'?'\\t':'');
    return JSON.parse(c2);
  } catch(e2) {}

  // Attempt 3: ask Claude to fix it
  const fixRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [{ role: 'user', content: 'Fix this broken JSON so it is valid. Return ONLY the fixed JSON with no explanation or markdown:\n\n' + clean }]
    })
  });
  const fixData = await fixRes.json();
  const fixText = fixData.content.map(i => i.text || '').join('').replace(/```json|```/g, '').trim();
  return JSON.parse(fixText);
}

// ─── Send audit email via SendGrid ────────────────────────────────────────────
export async function sendAuditEmail(toEmail, toName, bizName, auditData) {
  const html = buildEmailHtml(auditData, bizName, toName, toEmail);

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + process.env.SENDGRID_API_KEY,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: toEmail, name: toName || bizName }], subject: process.env.EMAIL_SUBJECT || 'Your Free Google My Business Audit Report is Ready' }],
      from: { email: process.env.EMAIL_FROM, name: process.env.EMAIL_FROM_NAME },
      content: [{ type: 'text/html', value: html }]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.message || 'SendGrid HTTP ' + res.status);
  }
}

// ─── Email HTML builder ────────────────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildEmailHtml(data, bizName, ownerName, toEmail) {
  const firstName  = ownerName ? ownerName.split(' ')[0] : 'there';
  const gradeColor = { A:'#1a8a4a', B:'#FF8C00', C:'#b86200', F:'#c0392b' }[data.grade] || '#FF8C00';
  const bookingUrl = process.env.BOOKING_URL || 'https://go.oncehub.com/rental-revenue-call';

  const sectionsHtml = data.sections.map(sec => {
    const sc = sec.score >= 75 ? '#1a8a4a' : sec.score >= 50 ? '#FF8C00' : '#c0392b';
    const fh = sec.findings.map(f => {
      const icon = f.status==='good' ? '&#x2705;' : f.status==='warning' ? '&#x26A0;&#xFE0F;' : '&#x1F534;';
      const tc   = f.status==='good' ? '#1a8a4a' : f.status==='warning' ? '#b86200' : '#c0392b';
      const bg   = f.status==='good' ? '#e8f7ed'  : f.status==='warning' ? '#fff4e5' : '#fdf0ee';
      const tag  = f.status==='good' ? 'GOOD'     : f.status==='warning' ? 'IMPROVE' : 'CRITICAL';
      return `<tr><td style="padding:12px 16px;border-bottom:1px solid #f0f0f0;vertical-align:top;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="width:24px;vertical-align:top;padding-top:2px;">${icon}</td><td style="padding-left:10px;"><div style="font-size:13px;font-weight:600;color:#0A2342;margin-bottom:3px;">${esc(f.title)}</div><div style="font-size:12px;color:#A1A0A5;line-height:1.5;">${esc(f.desc)}</div></td><td style="width:80px;text-align:right;vertical-align:top;padding-top:2px;"><span style="background:${bg};color:${tc};font-size:10px;font-weight:700;letter-spacing:0.8px;padding:3px 8px;border-radius:4px;">${tag}</span></td></tr></table></td></tr>`;
    }).join('');
    return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border:1.5px solid #e0e0e2;border-radius:10px;overflow:hidden;background:#ffffff;"><tr style="background:#F4F4F4;"><td style="padding:14px 16px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:18px;width:30px;">${sec.icon}</td><td style="padding-left:10px;"><div style="font-size:14px;font-weight:700;color:#0A2342;">${sec.title}</div><div style="font-size:11px;color:#A1A0A5;margin-top:1px;">${sec.subtitle}</div></td><td style="text-align:right;"><span style="background:${sc}20;color:${sc};font-size:12px;font-weight:700;padding:4px 12px;border-radius:100px;">${sec.score}/100</span></td></tr></table></td></tr>${fh}</table>`;
  }).join('');

  const prioritiesHtml = data.topPriorities.map((p, i) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.1);"><table cellpadding="0" cellspacing="0"><tr><td style="width:28px;height:28px;background:#FF8C00;border-radius:50%;text-align:center;vertical-align:middle;"><span style="color:white;font-size:12px;font-weight:700;">${i+1}</span></td><td style="padding-left:12px;font-size:13px;color:rgba(255,255,255,0.8);line-height:1.5;">${esc(p)}</td></tr></table></td></tr>`
  ).join('');

  const bannerUrl = 'https://gmb-drip-k4ap.vercel.app/banner.png';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F4F4F4;font-family:Helvetica Neue,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F4;padding:32px 16px;"><tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;border-radius:12px;overflow:hidden;">
<tr><td style="padding:0;line-height:0;"><img src="${bannerUrl}" alt="GMB Audit" width="620" style="width:100%;max-width:620px;display:block;border:0;" /></td></tr>
<tr><td style="background:#0A2342;padding:28px 32px;">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:24px;">
<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:8px;">${esc(bizName)}</div>
<div style="font-size:13px;color:rgba(255,255,255,0.65);line-height:1.6;">${esc(data.summary)}</div>
<div style="margin-top:20px;border-top:1px solid rgba(255,255,255,0.1);padding-top:16px;">
<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:10px;">Top 3 Priorities</div>
<table width="100%" cellpadding="0" cellspacing="0">${prioritiesHtml}</table>
</div></td>
<td style="width:130px;text-align:center;vertical-align:top;">
<div style="font-size:64px;font-weight:700;color:#fff;line-height:1;">${data.overallScore}</div>
<div style="font-size:18px;color:rgba(255,255,255,0.4);">/100</div>
<div style="font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-top:4px;">SCORE</div>
<div style="display:inline-block;background:${gradeColor}30;color:${gradeColor};font-size:13px;font-weight:700;padding:5px 14px;border-radius:100px;margin-top:10px;">${data.grade}-Grade</div>
</td></tr></table></td></tr>
<tr><td style="background:#fff;padding:32px;border:1.5px solid #e0e0e2;border-top:none;">
<div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#A1A0A5;margin-bottom:20px;">Detailed Findings</div>
${sectionsHtml}
<table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0A2342 0%,#0d3566 100%);border-radius:12px;margin-top:8px;">
<tr><td style="padding:28px 32px;text-align:center;">
<div style="font-size:20px;font-weight:700;color:#fff;margin-bottom:8px;">Ready to fix these issues, ${esc(firstName)}?</div>
<div style="font-size:13px;color:rgba(255,255,255,0.6);margin-bottom:20px;line-height:1.6;">Our local SEO specialists have helped hundreds of businesses improve their Google ranking and get more qualified leads.</div>
<a href="${bookingUrl}" style="display:inline-block;background:#FF8C00;color:#fff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;">&#x1F4C5; Book My Free Discovery Call</a>
<div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:12px;">No obligation &middot; 15 minutes &middot; Real recommendations</div>
</td></tr></table>
</td></tr>
<tr><td style="background:#F4F4F4;padding:20px 32px;text-align:center;">
<div style="font-size:11px;color:#A1A0A5;line-height:1.6;">
&copy; 2025 Rental Marketing Pros &middot; <a href="https://rentalmarketingpros.com" style="color:#A1A0A5;">rentalmarketingpros.com</a><br>
You received this because you requested a free GMB audit.<br>
<a href="https://gmb-drip-k4ap.vercel.app/api/unsubscribe?email=${encodeURIComponent(toEmail || '')}&company=${encodeURIComponent(bizName || '')}" style="color:#A1A0A5;text-decoration:underline;">Unsubscribe</a>
</div></td></tr>
</table></td></tr></table>
</body></html>`;
}
