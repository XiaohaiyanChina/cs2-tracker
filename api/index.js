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

  // On Vercel (TOKEN available): NEVER use local files or memory cache.
  // Memory cache is per-instance and causes cross-instance staleness:
  // Instance B's 20s-old cache doesn't see Instance A's just-written data.
  // Always read from GitHub Contents API for absolute consistency.
  if (TOKEN) {
    // Fetch from GitHub Contents API first (bypasses CDN cache)
    try {
      const apiHeaders = {
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'cs2-tracker',
        'Accept': 'application/vnd.github+json',
      };
      const res = await fetch(API_URL, { headers: apiHeaders });
      if (res.ok) {
        const fileData = await res.json();
        if (fileData.content && fileData.encoding === 'base64') {
          const decoded = Buffer.from(fileData.content, 'base64').toString('utf-8');
          _cache = JSON.parse(decoded);
          _cacheTime = now;
          console.log(`[readDB] Loaded from GitHub Contents API`);
          return _cache;
        }
      }
      console.error('[readDB] GitHub Contents API fetch failed:', res.status);
    } catch (e) {
      console.error('[readDB] GitHub Contents API request failed:', e.message);
    }

    // Fallback: GitHub raw URL
    try {
      const headers = {
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'cs2-tracker',
      };
      const res = await fetch(RAW_URL, { headers });
      if (res.ok) {
        _cache = await res.json();
        _cacheTime = now;
        console.log(`[readDB] Loaded from GitHub raw (fallback): ${RAW_URL}`);
        return _cache;
      }
      console.error('[readDB] GitHub raw fetch failed:', res.status);
    } catch (e) {
      console.error('[readDB] GitHub raw request failed:', e.message);
    }

    console.error('[readDB] All GitHub sources failed, returning empty DB');
    return JSON.parse(JSON.stringify(EMPTY_DB));
  }

  // Local dev / no token: try local files
  try {
    if (existsSync(LOCAL_DB)) {
      const raw = readFileSync(LOCAL_DB, 'utf-8');
      _cache = JSON.parse(raw);
      _cacheTime = now;
      console.log(`[readDB] Loaded from local: ${LOCAL_DB}`);
      return _cache;
    }
    const oldLocal = join(process.cwd(), 'server', 'db.json');
    if (existsSync(oldLocal)) {
      const raw = readFileSync(oldLocal, 'utf-8');
      _cache = JSON.parse(raw);
      _cacheTime = now;
      console.log(`[readDB] Loaded from fallback local: ${oldLocal}`);
      return _cache;
    }
  } catch (e) {
    console.error('[readDB] Local read failed:', e.message);
  }

  // Try GitHub raw as final fallback (no token, unauthenticated)
  try {
    const res = await fetch(RAW_URL, { headers: { 'User-Agent': 'cs2-tracker' } });
    if (res.ok) {
      _cache = await res.json();
      _cacheTime = now;
      console.log(`[readDB] Loaded from GitHub raw (no token)`);
      return _cache;
    }
  } catch (e) {
    console.error('[readDB] GitHub raw (no token) failed:', e.message);
  }

  console.error('[readDB] All read sources failed, returning empty DB');
  return JSON.parse(JSON.stringify(EMPTY_DB));
}

async function writeDB(data, _retryCount = 0) {
  const MAX_RETRIES = 3;

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
    // SHA conflict — retry with exponential backoff
    if ((putRes.status === 409 || putRes.status === 422) && _retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, _retryCount) * 200;
      console.log(`[writeDB] SHA conflict, retrying in ${delay}ms (attempt ${_retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Re-read latest DB and merge with our changes before retrying.
      // This prevents our retry from overwriting changes made by the
      // conflicting write (e.g. another item added/deleted concurrently).
      try {
        const refetch = await fetch(API_URL, {
          headers: {
            'Authorization': `Bearer ${TOKEN}`,
            'User-Agent': 'cs2-tracker',
            'Accept': 'application/vnd.github+json',
          },
        });
        if (refetch.ok) {
          const latestFile = await refetch.json();
          if (latestFile.content && latestFile.encoding === 'base64') {
            const latestData = JSON.parse(Buffer.from(latestFile.content, 'base64').toString('utf-8'));
            // Merge: keep all items from both versions (union by id).
            // Our data takes precedence for items that exist in both.
            const merged = { ...latestData };
            for (const col of COLLECTIONS) {
              const ourItems = data[col] || [];
              const latestItems = latestData[col] || [];
              const ourIds = new Set(ourItems.map(x => x.id));
              // Start with our items (preserves our modifications)
              const mergedCol = [...ourItems];
              // Add items from latest that we don't have (preserves other changes)
              for (const item of latestItems) {
                if (!ourIds.has(item.id)) {
                  mergedCol.push(item);
                }
              }
              merged[col] = mergedCol;
            }
            console.log(`[writeDB] Merged with latest DB before retry`);
            return writeDB(merged, _retryCount + 1);
          }
        }
      } catch (e) {
        console.warn('[writeDB] Failed to re-read on retry, using original data:', e.message);
      }

      return writeDB(data, _retryCount + 1);
    }

    let errMsg = '';
    try {
      const err = await putRes.json();
      errMsg = err.message || JSON.stringify(err);
    } catch {
      try { errMsg = await putRes.text(); } catch {}
    }
    throw new Error(`GitHub 写入失败: ${putRes.status} — ${errMsg.slice(0, 200)}`);
  }

  // Only update cache AFTER successful GitHub write (NOT before)
  const now = Date.now();
  _cache = data;
  _cacheTime = now;

  // Verify write via Contents API (bypasses CDN cache)
  try {
    const verifyRes = await fetch(API_URL, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'cs2-tracker',
        'Accept': 'application/vnd.github+json',
      },
    });
    if (verifyRes.ok) {
      const verifyData = await verifyRes.json();
      const decoded = JSON.parse(Buffer.from(verifyData.content, 'base64').toString('utf-8'));
      _cache = decoded;
      _cacheTime = Date.now();
      console.log(`[writeDB] Verified via Contents API`);
    }
  } catch (e) {
    console.warn('[writeDB] Verification failed (non-fatal):', e.message);
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
