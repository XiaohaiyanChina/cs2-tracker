// Vercel serverless API — all /api/* requests rewrite here
// Parses the original URL to determine endpoint

const fs = require('fs');
const path = require('path');

const OWNER = process.env.GITHUB_REPO_OWNER || 'XiaohaiyanChina';
const REPO = process.env.GITHUB_REPO_NAME || 'cs2-tracker';
const BRANCH = process.env.GITHUB_REPO_BRANCH || 'master';
const TOKEN = process.env.GITHUB_TOKEN || '';

const LOCAL_DB = path.join(process.cwd(), 'server', 'db.json');
const API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/frontend/db.json`;

const COLLECTIONS = ['players', 'teams', 'tournaments', 'matches', 'matchMaps', 'matchStats', 'news'];

let _cache = null;
let _cacheTime = 0;

const EMPTY_DB = { players: [], teams: [], tournaments: [], matches: [], matchMaps: [], matchStats: [], news: [] };

function readDB() {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < 30000) return _cache;

  try {
    if (fs.existsSync(LOCAL_DB)) {
      const raw = fs.readFileSync(LOCAL_DB, 'utf-8');
      _cache = JSON.parse(raw);
      _cacheTime = now;
      return _cache;
    }
  } catch (e) {
    console.error('读取数据库失败:', e.message);
  }

  return EMPTY_DB;
}

async function writeDB(data) {
  _cache = data;
  _cacheTime = Date.now();

  if (!TOKEN) throw new Error('缺少 GITHUB_TOKEN 环境变量，无法保存数据。请在 Vercel 项目设置中添加 GITHUB_TOKEN');

  const getRes = await fetch(API_URL, {
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'User-Agent': 'cs2-tracker', 'Accept': 'application/vnd.github+json' },
  });
  if (!getRes.ok) throw new Error(`GitHub 读取失败: ${getRes.status}`);
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
    throw new Error(`GitHub 写入失败: ${err.message}`);
  }
}

// Parse URL path like /api/players/p1 → parts ['api', 'players', 'p1']
function parsePath(url) {
  const path = (url || '').split('?')[0];
  const parts = path.split('/').filter(Boolean); // ['api', 'players'] or ['api', 'players', 'p1']
  // First part should be 'api'
  const afterApi = parts.slice(1); // ['players'] or ['players', 'p1']

  if (afterApi.length === 0) return { error: 'No endpoint' };
  const [first, second] = afterApi;

  if (afterApi.length === 1) {
    if (COLLECTIONS.includes(first)) return { collection: first, id: null };
    return { special: first };
  }
  if (afterApi.length === 2 && COLLECTIONS.includes(first)) {
    return { collection: first, id: second };
  }
  return { error: 'Invalid path' };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Use original URL (before rewrite) if available, otherwise use req.url
  const url = req.url || '';
  const parsed = parsePath(url);

  // --- Special endpoints ---
  if (parsed.special === 'status') {
    try {
      const db = readDB();
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
      const db = readDB();
      return res.json({ ...db, exportedAt: new Date().toISOString() });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (parsed.special === 'import') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const db = readDB();
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

  if (parsed.special === 'batch-delete') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const { collection, ids } = req.body || {};
      if (!collection || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'collection and ids[] required' });
      }
      if (!COLLECTIONS.includes(collection)) {
        return res.status(400).json({ error: 'Invalid collection' });
      }

      const db = readDB();
      const before = db[collection].length;
      const idSet = new Set(ids);

      // Handle cascading deletes
      if (collection === 'matches') {
        // Also delete related matchMaps and matchStats
        const mapIds = new Set();
        for (const m of db.matches) {
          if (idSet.has(m.id)) {
            m.mapIds?.forEach(mid => mapIds.add(mid));
          }
        }
        db.matchMaps = db.matchMaps.filter(mm => !mapIds.has(mm.id));
        db.matchStats = db.matchStats.filter(s => !mapIds.has(s.matchMapId));
      }
      if (collection === 'players') {
        // Remove from teams
        for (const t of db.teams) {
          t.members = (t.members || []).filter(pid => !idSet.has(pid));
          if (idSet.has(t.coach || '')) t.coach = null;
        }
      }

      db[collection] = db[collection].filter(x => !idSet.has(x.id));
      const after = db[collection].length;

      await writeDB(db);
      return res.json({ ok: true, deleted: before - after, total: after });
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
        const db = readDB();
        if (id) {
          const item = db[collection]?.find(x => x.id === id);
          if (!item) return res.status(404).json({ error: 'Not found' });
          return res.json(item);
        }
        return res.json(db[collection] || []);
      }
      case 'POST': {
        const db = readDB();
        const item = { ...req.body };
        if (!item.id) item.id = `${collection}_${Date.now()}`;
        db[collection].push(item);
        await writeDB(db);
        return res.status(201).json(item);
      }
      case 'PUT': {
        const db = readDB();
        const idx = db[collection]?.findIndex(x => x.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Not found' });
        db[collection][idx] = { ...req.body, id };
        await writeDB(db);
        return res.json(db[collection][idx]);
      }
      case 'DELETE': {
        const db = readDB();
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
