// Vercel serverless API — all /api/* requests rewrite here (ESM)
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Buffer } from 'buffer';

const OWNER = process.env.GITHUB_REPO_OWNER || 'XiaohaiyanChina';
const REPO = process.env.GITHUB_REPO_NAME || 'cs2-tracker';
const BRANCH = process.env.GITHUB_REPO_BRANCH || 'master';
const TOKEN = process.env.GITHUB_TOKEN || '';

const DB_FILE = 'frontend/db.json';  // single source of truth for both read & write
const LOCAL_DB = join(process.cwd(), DB_FILE);
const RAW_URL = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${DB_FILE}`;
const API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${DB_FILE}`;

const COLLECTIONS = ['players', 'teams', 'tournaments', 'matches', 'matchMaps', 'matchStats', 'news'];
const EMPTY_DB = { players: [], teams: [], tournaments: [], matches: [], matchMaps: [], matchStats: [], news: [] };

let _cache = null;
let _cacheTime = 0;

async function readDB() {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < 30000) return _cache;

  // Try local file first (local dev or deployment with db.json present)
  try {
    if (existsSync(LOCAL_DB)) {
      const raw = readFileSync(LOCAL_DB, 'utf-8');
      _cache = JSON.parse(raw);
      _cacheTime = now;
      console.log(`[readDB] Loaded from local: ${LOCAL_DB}`);
      return _cache;
    }
    // Fallback: try server/db.json for old deployments
    const oldLocal = join(process.cwd(), 'server', 'db.json');
    if (existsSync(oldLocal)) {
      const raw = readFileSync(oldLocal, 'utf-8');
      _cache = JSON.parse(raw);
      _cacheTime = now;
      console.log(`[readDB] Loaded from fallback local: ${oldLocal}`);
      return _cache;
    }
  } catch (e) {
    console.error('[readDB] Local read failed, trying GitHub:', e.message);
  }

  // Fetch from GitHub raw
  try {
    const headers = { 'User-Agent': 'cs2-tracker' };
    if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
    const res = await fetch(RAW_URL, { headers });
    if (res.ok) {
      _cache = await res.json();
      _cacheTime = now;
      console.log(`[readDB] Loaded from GitHub raw: ${RAW_URL}`);
      return _cache;
    }
    console.error('[readDB] GitHub raw fetch failed:', res.status);
  } catch (e) {
    console.error('[readDB] GitHub raw request failed:', e.message);
  }

  console.error('[readDB] All read sources failed, returning empty DB');
  return JSON.parse(JSON.stringify(EMPTY_DB));
}

async function writeDB(data) {
  const now = Date.now();
  _cache = data;
  _cacheTime = now;

  if (!TOKEN) {
    throw new Error('缺少 GITHUB_TOKEN 环境变量，无法保存数据。请在 Vercel 项目设置中添加 GITHUB_TOKEN');
  }

  // Get current SHA from GitHub
  let getRes;
  try {
    getRes = await fetch(API_URL, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'cs2-tracker',
        'Accept': 'application/vnd.github+json',
      },
    });
  } catch (e) {
    throw new Error(`GitHub API 连接失败 (GET): ${e.message}`);
  }

  if (!getRes.ok) {
    let body = '';
    try { body = await getRes.text(); } catch {}
    throw new Error(`GitHub 读取失败: ${getRes.status} — ${body.slice(0, 200)}`);
  }

  let sha;
  try {
    const fileData = await getRes.json();
    sha = fileData.sha;
  } catch (e) {
    throw new Error(`GitHub 解析响应失败: ${e.message}`);
  }

  // Write back to GitHub
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  let putRes;
  try {
    putRes = await fetch(API_URL, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'cs2-tracker',
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Update db.json',
        content,
        sha,
        branch: BRANCH,
      }),
    });
  } catch (e) {
    throw new Error(`GitHub API 连接失败 (PUT): ${e.message}`);
  }

  if (!putRes.ok) {
    let errMsg = '';
    try {
      const err = await putRes.json();
      errMsg = err.message || JSON.stringify(err);
    } catch {
      try { errMsg = await putRes.text(); } catch {}
    }
    throw new Error(`GitHub 写入失败: ${putRes.status} — ${errMsg.slice(0, 200)}`);
  }

  console.log(`[writeDB] Successfully wrote to ${API_URL}`);
}

// Parse URL path like /api/players/p1 → collection=players, id=p1
function parsePath(url) {
  const path = (url || '').split('?')[0];
  const parts = path.split('/').filter(Boolean);
  const afterApi = parts.slice(1);

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

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.url || '';
  const parsed = parsePath(url);

  // --- Status endpoint ---
  if (parsed.special === 'status') {
    try {
      const db = await readDB();
      return res.json({
        ok: true,
        tokenConfigured: !!TOKEN,
        owner: OWNER,
        repo: REPO,
        branch: BRANCH,
        dbFile: DB_FILE,
        collections: COLLECTIONS.reduce((acc, c) => ({ ...acc, [c]: db[c]?.length || 0 }), {}),
      });
    } catch (e) {
      return res.json({ ok: false, tokenConfigured: !!TOKEN, error: e.message });
    }
  }

  // --- Export ---
  if (parsed.special === 'export') {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    try {
      const db = await readDB();
      return res.json({ ...db, exportedAt: new Date().toISOString() });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // --- Import ---
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
      return res.status(500).json({ error: `导入失败: ${e.message}` });
    }
  }

  // --- Batch delete ---
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

      const db = await readDB();
      const before = db[collection].length;
      const idSet = new Set(ids);

      // Cascade deletes
      if (collection === 'matches') {
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
        for (const t of db.teams) {
          t.members = (t.members || []).filter(pid => !idSet.has(pid));
          if (idSet.has(t.coach || '')) t.coach = null;
        }
      }
      // Cascade tournament delete: remove related matches
      if (collection === 'tournaments') {
        const matchIdsToDelete = new Set();
        for (const m of db.matches) {
          if (idSet.has(m.tournamentId)) matchIdsToDelete.add(m.id);
        }
        if (matchIdsToDelete.size > 0) {
          const mapIds = new Set();
          for (const m of db.matches) {
            if (matchIdsToDelete.has(m.id)) {
              m.mapIds?.forEach(mid => mapIds.add(mid));
            }
          }
          db.matchMaps = db.matchMaps.filter(mm => !mapIds.has(mm.id));
          db.matchStats = db.matchStats.filter(s => !mapIds.has(s.matchMapId));
          db.matches = db.matches.filter(m => !matchIdsToDelete.has(m.id));
        }
        // Remove tournament from team achievements
        for (const t of db.teams) {
          t.achievements = (t.achievements || []).filter(a => !idSet.has(a.teamId));
        }
      }

      db[collection] = db[collection].filter(x => !idSet.has(x.id));
      const after = db[collection].length;

      await writeDB(db);
      return res.json({ ok: true, deleted: before - after, total: after });
    } catch (e) {
      return res.status(500).json({ error: `批量删除失败: ${e.message}` });
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
        if (!id || idx === -1) return res.status(404).json({ error: `Not found: ${collection}/${id}` });
        db[collection][idx] = { ...req.body, id };
        await writeDB(db);
        return res.json(db[collection][idx]);
      }
      case 'DELETE': {
        const db = await readDB();
        const idx = db[collection]?.findIndex(x => x.id === id);
        if (!id || idx === -1) return res.status(404).json({ error: `Not found: ${collection}/${id}` });
        db[collection].splice(idx, 1);
        await writeDB(db);
        return res.json({ ok: true });
      }
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (e) {
    console.error(`[API] ${req.method} /api/${collection}${id ? '/' + id : ''} error:`, e);
    return res.status(500).json({ error: e.message });
  }
}
