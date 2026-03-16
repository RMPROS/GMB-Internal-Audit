export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.status(400).json({ results: [] });

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing GOOGLE_PLACES_API_KEY' });

  try {
    const url = 'https://maps.googleapis.com/maps/api/place/autocomplete/json'
      + '?input=' + encodeURIComponent(q)
      + '&types=establishment'
      + '&key=' + apiKey;

    const placesRes = await fetch(url);
    const data      = await placesRes.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return res.status(500).json({ error: data.status });
    }

    // Convert autocomplete predictions to the shape the UI expects
    const results = (data.predictions || []).map(p => ({
      place_id:          p.place_id,
      name:              p.structured_formatting?.main_text || p.description,
      formatted_address: p.structured_formatting?.secondary_text || '',
    }));

    return res.status(200).json({ results });
  } catch (err) {
    console.error('[search]', err.message);
    return res.status(500).json({ error: err.message });
  }
}
