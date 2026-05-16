// GitHub-backed database for Vercel serverless functions

const REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'XiaohaiyanChina';
const REPO_NAME = process.env.GITHUB_REPO_NAME || 'cs2-tracker';
const REPO_BRANCH = process.env.GITHUB_REPO_BRANCH || 'master';
const DB_PATH = 'frontend/db.json';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

const RAW_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${DB_PATH}`;
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DB_PATH}`;

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5000; // 5 second cache

export async function readDB() {
  // Return cached data if fresh (for writes that just happened)
  const now = Date.now();
  if (cache && (now - cacheTime) < CACHE_TTL) {
    return JSON.parse(JSON.stringify(cache)); // deep clone
  }

  const headers = { 'User-Agent': 'cs2-tracker' };
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  }

  const res = await fetch(RAW_URL, { headers });
  if (!res.ok) {
    throw new Error(`Failed to read database: ${res.status}`);
  }
  const data = await res.json();
  cache = data;
  cacheTime = now;
  return JSON.parse(JSON.stringify(data));
}

export async function writeDB(data) {
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN not configured');
  }

  // Get current file SHA
  const getRes = await fetch(API_URL, {
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'User-Agent': 'cs2-tracker',
      'Accept': 'application/vnd.github+json',
    },
  });

  if (!getRes.ok) {
    throw new Error(`Failed to get file info: ${getRes.status}`);
  }

  const fileInfo = await getRes.json();
  const sha = fileInfo.sha;

  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');

  const putRes = await fetch(API_URL, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'User-Agent': 'cs2-tracker',
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Update db.json via admin panel',
      content,
      sha,
      branch: REPO_BRANCH,
    }),
  });

  if (!putRes.ok) {
    const err = await putRes.json();
    throw new Error(`Failed to write database: ${err.message}`);
  }

  // Update cache
  cache = data;
  cacheTime = Date.now();

  return data;
}
