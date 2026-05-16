// Vercel serverless API — single self-contained file
// Handles /api/players, /api/teams, etc. with GitHub as data store

const OWNER = process.env.GITHUB_REPO_OWNER || 'XiaohaiyanChina';
const REPO = process.env.GITHUB_REPO_NAME || 'cs2-tracker';
const BRANCH = process.env.GITHUB_REPO_BRANCH || 'master';
const DB_FILE = 'frontend/db.json';
const TOKEN = process.env.GITHUB_TOKEN || '';

const RAW_URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${DB_FILE}`;
const API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${DB_FILE}`;

const COLLECTIONS = ['players', 'teams', 'tournaments', 'matches', 'matchMaps', 'matchStats', 'news'];

// In-memory cache (per instance, short-lived on serverless)
let _cache = null;
let _cacheTime = 0;

async function readDB() {
  const now = Date.now();
  // Use cache if very fresh (handle rapid successive reads after write)
  if (_cache && (now - _cacheTime) < 3000) {
    return JSON.parse(JSON.stringify(_cache));
  }

  // Try raw URL first (fast, no auth for public repos)
  let res = await fetch(RAW_URL, { headers: { 'User-Agent': 'cs2-tracker' } });

  // If auth token is set, use API for guaranteed fresh data
  if (TOKEN) {
    try {
      const apiRes = await fetch(API_URL, {
        headers: { 'Authorization': `Bearer ${TOKEN}`, 'User-Agent': 'cs2-tracker', 'Accept': 'application/vnd.github+json' },
      });
      if (apiRes.ok) {
        const fileInfo = await apiRes.json();
        const content = fileInfo.content;
        // content is base64 encoded
        if (content) {
          const decoded = Buffer.from(content, 'base64').toString('utf-8');
          const data = JSON.parse(decoded);
          _cache = data;
          _cacheTime = now;
          return JSON.parse(JSON.stringify(data));
        }
      }
    } catch { /* fall through to raw URL */ }
  }

  if (!res.ok) throw new Error(`Read failed: ${res.status}`);
  const data = await res.json();
  _cache = data;
  _cacheTime = now;
  return JSON.parse(JSON.stringify(data));
}

async function writeDB(data) {
  if (!TOKEN) throw new Error('GITHUB_TOKEN not set');

  const getRes = await fetch(API_URL, {
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'User-Agent': 'cs2-tracker', 'Accept': 'application/vnd.github+json' },
  });
  if (!getRes.ok) throw new Error(`Get SHA failed: ${getRes.status}`);
  const { sha } = await getRes.json();

  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  const putRes = await fetch(API_URL, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${TOKEN}`, 'User-Agent': 'cs2-tracker',
      'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: 'Update db.json', content, sha, branch: BRANCH }),
  });
  if (!putRes.ok) {
    const err = await putRes.json();
    throw new Error(`Write failed: ${err.message}`);
  }

  _cache = data;
  _cacheTime = Date.now();
  return data;
}

function parseRoute(segments) {
  if (!segments || segments.length === 0) return { error: 'No route' };
  const [first, second] = segments;
  if (segments.length === 1) {
    if (COLLECTIONS.includes(first)) return { collection: first, id: null };
    return { special: first };
  }
  if (segments.length === 2 && COLLECTIONS.includes(first)) {
    return { collection: first, id: second };
  }
  return { error: 'Invalid path' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Vercel passes catch-all segments via req.query.route (array)
  // Fallback: parse from URL path
  let segments = req.query.route;
  if (!segments || segments.length === 0) {
    const path = req.url?.split('?')[0] || '';
    segments = path.replace(/^\/api\//, '').split('/').filter(Boolean);
  }
  const parsed = parseRoute(segments);

  // --- Special endpoints ---
  if (parsed.special === 'status') {
    try {
      const db = await readDB();
      return res.json({
        ok: true,
        tokenConfigured: !!TOKEN,
        owner: OWNER,
        repo: REPO,
        branch: BRANCH,
        collections: COLLECTIONS.reduce((acc, c) => ({ ...acc, [c]: db[c]?.length || 0 }), {}),
      });
    } catch (e) {
      return res.json({ ok: false, tokenConfigured: !!TOKEN, error: e.message });
    }
  }

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
      for (const c of COLLECTIONS) {
        if (Array.isArray(req.body[c])) db[c] = req.body[c];
      }
      await writeDB(db);
      const counts = {};
      COLLECTIONS.forEach(c => { counts[c] = db[c].length; });
      return res.json({ ok: true, counts });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- Collection CRUD ---
  const { collection, id, error } = parsed;
  if (error || !collection) {
    return res.status(404).json({ error: error || 'Not found' });
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
    return res.status(500).json({ error: e.message });
  }
}
