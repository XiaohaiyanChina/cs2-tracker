// Cloudflare Pages Function — handles all /api/* routes
// URL segments come from context.params.path array

const COLLECTIONS = ['players', 'teams', 'tournaments', 'matches', 'matchMaps', 'matchStats', 'news'];

let _cache = null;
let _cacheTime = 0;

// Base64 helpers (Cloudflare Workers don't have Node Buffer)
function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function getEnv(env) {
  const owner = env.GITHUB_REPO_OWNER || 'XiaohaiyanChina';
  const repo = env.GITHUB_REPO_NAME || 'cs2-tracker';
  const branch = env.GITHUB_REPO_BRANCH || 'master';
  const token = env.GITHUB_TOKEN || '';
  const dbFile = 'frontend/db.json';
  return {
    owner, repo, branch, token, dbFile,
    rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${dbFile}`,
    apiUrl: `https://api.github.com/repos/${owner}/${repo}/contents/${dbFile}`,
  };
}

async function readDB(env) {
  const { token, apiUrl, rawUrl } = getEnv(env);
  const now = Date.now();
  if (_cache && (now - _cacheTime) < 5000) {
    return JSON.parse(JSON.stringify(_cache));
  }

  if (token) {
    const apiRes = await fetch(apiUrl, {
      headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'cs2-tracker', 'Accept': 'application/vnd.github+json' },
    });
    if (!apiRes.ok) throw new Error(`Read failed: ${apiRes.status}`);
    const { content } = await apiRes.json();
    if (!content) throw new Error('Empty content from GitHub API');
    const data = JSON.parse(fromBase64(content));
    _cache = data;
    _cacheTime = now;
    return JSON.parse(JSON.stringify(data));
  }

  const res = await fetch(`${rawUrl}?t=${now}`, { headers: { 'User-Agent': 'cs2-tracker' } });
  if (!res.ok) throw new Error(`Read failed: ${res.status}`);
  const data = await res.json();
  _cache = data;
  _cacheTime = now;
  return JSON.parse(JSON.stringify(data));
}

async function writeDB(data, env) {
  const { token, apiUrl, branch } = getEnv(env);
  if (!token) throw new Error('GITHUB_TOKEN not set');

  const getRes = await fetch(apiUrl, {
    headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'cs2-tracker', 'Accept': 'application/vnd.github+json' },
  });
  if (!getRes.ok) throw new Error(`Get SHA failed: ${getRes.status}`);
  const { sha } = await getRes.json();

  const content = toBase64(JSON.stringify(data, null, 2));
  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`, 'User-Agent': 'cs2-tracker',
      'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: 'Update db.json', content, sha, branch }),
  });
  if (!putRes.ok) {
    const err = await putRes.json();
    throw new Error(`Write failed: ${err.message}`);
  }

  _cache = data;
  _cacheTime = Date.now();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  // context.params.path is an array of path segments after /api/
  const segments = context.params.path || [];
  const [first, second] = segments;

  // --- Special endpoints ---
  if (segments.length === 1 && !COLLECTIONS.includes(first)) {
    const special = first;

    if (special === 'status') {
      try {
        const db = await readDB(env);
        const { token, owner, repo, branch } = getEnv(env);
        return json({
          ok: true,
          tokenConfigured: !!token,
          owner, repo, branch,
          collections: COLLECTIONS.reduce((acc, c) => ({ ...acc, [c]: db[c]?.length || 0 }), {}),
        });
      } catch (e) {
        return json({ ok: false, tokenConfigured: !!getEnv(env).token, error: e.message });
      }
    }

    if (special === 'export') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
      try {
        const db = await readDB(env);
        return json({ ...db, exportedAt: new Date().toISOString() });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    if (special === 'import') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      try {
        const db = await readDB(env);
        const body = await request.json();
        for (const c of COLLECTIONS) {
          if (Array.isArray(body[c])) db[c] = body[c];
        }
        await writeDB(db, env);
        const counts = {};
        COLLECTIONS.forEach(c => { counts[c] = db[c].length; });
        return json({ ok: true, counts });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    if (special === 'batch-delete') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      try {
        const body = await request.json();
        const { collection, ids } = body || {};
        if (!collection || !Array.isArray(ids) || ids.length === 0) {
          return json({ error: 'collection and ids[] required' }, 400);
        }
        if (!COLLECTIONS.includes(collection)) {
          return json({ error: 'Invalid collection' }, 400);
        }

        const db = await readDB(env);
        const before = db[collection].length;
        const idSet = new Set(ids);

        if (collection === 'matches') {
          const mapIds = new Set();
          for (const m of db.matches) {
            if (idSet.has(m.id)) m.mapIds?.forEach(mid => mapIds.add(mid));
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

        db[collection] = db[collection].filter(x => !idSet.has(x.id));
        const after = db[collection].length;
        await writeDB(db, env);
        return json({ ok: true, deleted: before - after, total: after });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    return json({ error: 'Not found' }, 404);
  }

  // --- Collection CRUD ---
  if (segments.length === 0 || segments.length > 2) {
    return json({ error: 'Invalid path' }, 404);
  }

  const collection = first;
  const id = second || null;

  if (!COLLECTIONS.includes(collection)) {
    return json({ error: 'Not found' }, 404);
  }

  try {
    switch (request.method) {
      case 'GET': {
        const db = await readDB(env);
        if (id) {
          const item = db[collection]?.find(x => x.id === id);
          if (!item) return json({ error: 'Not found' }, 404);
          return json(item);
        }
        return json(db[collection] || []);
      }
      case 'POST': {
        const db = await readDB(env);
        const item = await request.json();
        if (!item.id) item.id = `${collection}_${Date.now()}`;
        db[collection].push(item);
        await writeDB(db, env);
        return json(item, 201);
      }
      case 'PUT': {
        const db = await readDB(env);
        const idx = db[collection]?.findIndex(x => x.id === id);
        if (idx === -1) return json({ error: 'Not found' }, 404);
        const body = await request.json();
        db[collection][idx] = { ...body, id };
        await writeDB(db, env);
        return json(db[collection][idx]);
      }
      case 'DELETE': {
        const db = await readDB(env);
        const idx = db[collection]?.findIndex(x => x.id === id);
        if (idx === -1) return json({ error: 'Not found' }, 404);
        db[collection].splice(idx, 1);
        await writeDB(db, env);
        return json({ ok: true });
      }
      default:
        return json({ error: 'Method not allowed' }, 405);
    }
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
