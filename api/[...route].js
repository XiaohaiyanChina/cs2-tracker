// Catch-all API handler for Vercel serverless functions
// File-based routing: [...route].js matches /api/*

import { readDB, writeDB } from './db.js';

const COLLECTIONS = ['players', 'teams', 'tournaments', 'matches', 'matchMaps', 'matchStats', 'news'];

// Parse Vercel catch-all route segments
function parseRoute(segments) {
  if (!segments || segments.length === 0) {
    return { error: 'No route' };
  }
  if (segments.length === 1) {
    const name = segments[0];
    if (COLLECTIONS.includes(name)) {
      return { collection: name, id: null };
    }
    return { special: name };
  }
  if (segments.length === 2 && COLLECTIONS.includes(segments[0])) {
    return { collection: segments[0], id: segments[1] };
  }
  return { error: 'Invalid path' };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const parsed = parseRoute(req.query.route);

  // Special endpoints
  if (parsed.special === 'export') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const db = await readDB();
      return res.json({ ...db, exportedAt: new Date().toISOString() });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (parsed.special === 'import') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const db = await readDB();
      const incoming = req.body;
      const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
      if (!GITHUB_TOKEN) {
        return res.status(500).json({ error: 'GITHUB_TOKEN not configured - cannot write' });
      }
      for (const c of COLLECTIONS) {
        if (Array.isArray(incoming[c])) {
          db[c] = incoming[c];
        }
      }
      await writeDB(db);
      const counts = {};
      COLLECTIONS.forEach(c => { counts[c] = db[c].length; });
      return res.json({ ok: true, counts });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Collection CRUD
  const { collection, id } = parsed;
  if (!collection) {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        const db = await readDB();
        if (id) {
          const item = db[collection]?.find(x => x.id === id);
          if (!item) return res.status(404).json({ error: 'Not found' });
          return res.json(item);
        }
        return res.json(db[collection] || []);
      }

      case 'POST': {
        const db = await readDB();
        const item = { ...req.body };
        if (!item.id) item.id = `${collection}_${Date.now()}`;
        db[collection].push(item);
        await writeDB(db);
        return res.status(201).json(item);
      }

      case 'PUT': {
        const db = await readDB();
        const idx = db[collection]?.findIndex(x => x.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Not found' });
        db[collection][idx] = { ...req.body, id };
        await writeDB(db);
        return res.json(db[collection][idx]);
      }

      case 'DELETE': {
        const db = await readDB();
        const idx = db[collection]?.findIndex(x => x.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Not found' });
        db[collection].splice(idx, 1);
        await writeDB(db);
        return res.json({ ok: true });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (e) {
    console.error('API error:', e);
    return res.status(500).json({ error: e.message });
  }
}
