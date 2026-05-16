const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'db.json');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend', 'dist');

app.use(cors());
app.use(express.json());

// Serve frontend static files in production
if (fs.existsSync(FRONTEND_DIR)) {
  app.use(express.static(FRONTEND_DIR));
  console.log(`Serving frontend from ${FRONTEND_DIR}`);
}

// Load data
let db = { players: [], teams: [], tournaments: [], matches: [], matchMaps: [], matchStats: [], news: [] };
try {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  db = JSON.parse(raw);
  console.log(`Loaded db: ${db.players.length} players, ${db.teams.length} teams, ${db.tournaments.length} tournaments, ${db.matches.length} matches`);
} catch (e) {
  console.error('Failed to load db.json, using empty data', e.message);
}

// Save data (debounced writes)
let saveTimer = null;
function saveDB() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    // Ensure directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), (err) => {
      if (err) console.error('Failed to save db.json:', err.message);
    });
  }, 500);
}

// Immediate save (for important data)
function saveDBSync() {
  clearTimeout(saveTimer);
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('Failed to save db.json:', e.message);
  }
}

// CRUD helper - creates routes for each collection under both /api/ and root
function createRoutes(name) {
  const collection = db[name];

  const handleGetAll = (req, res) => res.json(collection);
  const handleGetOne = (req, res) => {
    const item = collection.find(x => x.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  };
  const handlePost = (req, res) => {
    const item = req.body;
    if (!item.id) item.id = `${name}_${Date.now()}`;
    collection.push(item);
    saveDB();
    res.status(201).json(item);
  };
  const handlePut = (req, res) => {
    const idx = collection.findIndex(x => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    collection[idx] = { ...req.body, id: req.params.id };
    saveDB();
    res.json(collection[idx]);
  };
  const handleDelete = (req, res) => {
    const idx = collection.findIndex(x => x.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    collection.splice(idx, 1);
    saveDB();
    res.json({ ok: true });
  };

  app.get(`/api/${name}`, handleGetAll);
  app.get(`/api/${name}/:id`, handleGetOne);
  app.post(`/api/${name}`, handlePost);
  app.put(`/api/${name}/:id`, handlePut);
  app.delete(`/api/${name}/:id`, handleDelete);
}

const collections = ['players', 'teams', 'tournaments', 'matches', 'matchMaps', 'matchStats', 'news'];
collections.forEach(createRoutes);

// Export full database
app.get('/api/export', (req, res) => {
  res.json({ ...db, exportedAt: new Date().toISOString() });
});

// Import full database
app.post('/api/import', (req, res) => {
  try {
    const incoming = req.body;
    for (const c of collections) {
      if (Array.isArray(incoming[c])) {
        db[c] = incoming[c];
      }
    }
    saveDBSync();
    res.json({ ok: true, counts: collections.reduce((acc, c) => ({ ...acc, [c]: db[c].length }), {}) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Trigger immediate save
app.post('/api/backup', (req, res) => {
  saveDBSync();
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  const indexPath = path.join(FRONTEND_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).json({ status: 'ok', collections: collections.map(c => `${c}: ${db[c].length}`) });
  }
});

app.listen(PORT, () => {
  console.log(`CS2 Tracker API running on port ${PORT}`);
});
