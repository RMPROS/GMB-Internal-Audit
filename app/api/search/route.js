// app/api/search/route.js
// Proxies Google Places text search server-side so the API key is never exposed

export const runtime = 'nodejs';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();

  if (q.length < 2) {
    return Response.json({ ok: true, results: [] }, { headers: CORS });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return Response.json({ ok: false, error: 'Places API key not configured', results: [] }, { headers: CORS });
  }

  try {
    const url = 'https://maps.googleapis.com/maps/api/place/textsearch/json'
      + '?query='  + encodeURIComponent(q)
      + '&type=establishment'
      + '&key='    + apiKey;

    const res  = await fetch(url);
    const data = await res.json();

    const results = (data.results || []).slice(0, 6).map(r => ({
      place_id:          r.place_id,
      name:              r.name,
      formatted_address: r.formatted_address || r.vicinity || '',
    }));

    return Response.json({ ok: true, results }, { headers: CORS });
  } catch (err) {
    console.error('[search]', err.message);
    return Response.json({ ok: false, error: err.message, results: [] }, { status: 500, headers: CORS });
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS });
}
