import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load environment variables from .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// AI Studio dev server and preview reverse proxy must run on port 3000
const PORT = 3000;

app.use(express.json());

// Enable CORS for embedding in AI Studio and iframe preview environments
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  next();
});

// ==================== TMDB API CONFIGURATION ====================
const getTmdbKey = () => {
  return (
    process.env.TMDB_API_KEY ||
    process.env.VITE_TMDB_API_KEY ||
    process.env.TMDB_READ_TOKEN ||
    ''
  ).trim();
};

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Helper for TMDB API calls
async function callTmdbApi(endpoint: string, params: Record<string, string | number | undefined> = {}) {
  const apiKey = getTmdbKey();
  if (!apiKey) {
    return {
      ok: false,
      status: 401,
      error: 'TMDB_API_KEY is not configured on the server.',
      code: 'TMDB_KEY_MISSING',
    };
  }

  const isBearer = apiKey.startsWith('ey');
  const url = new URL(`${TMDB_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`);

  if (!isBearer) {
    url.searchParams.set('api_key', apiKey);
  }

  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'CRATOR-Cinema-4K/3.0',
  };

  if (isBearer) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url.toString(), { headers, signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return { ok: false, status: 500, error: err.message || 'TMDB request error' };
  }
}

// ==================== HEALTH & STATUS ROUTE ====================
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    streamingProvider: 'VidRift',
    metadataProvider: 'TMDB',
    hasTmdbKey: Boolean(getTmdbKey()),
  });
});

// ==================== TMDB API ROUTES ====================

// 1. Status & Configuration
app.get('/api/tmdb/status', async (_req: Request, res: Response) => {
  const key = getTmdbKey();
  const hasKey = Boolean(key);
  let isVerified = false;

  if (hasKey) {
    try {
      const testRes = await callTmdbApi('/trending/all/day', {});
      isVerified = testRes.ok;
    } catch {
      isVerified = false;
    }
  }

  res.json({
    status: 'ok',
    configured: hasKey,
    hasKey,
    isVerified,
  });
});

app.post('/api/tmdb/set-key', async (req: Request, res: Response) => {
  const { apiKey } = req.body || {};
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'API Key must be a non-empty string' });
  }

  const cleanKey = apiKey.trim();
  process.env.TMDB_API_KEY = cleanKey;

  // Persist to .env
  try {
    const envPath = path.resolve(__dirname, '.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    if (envContent.includes('TMDB_API_KEY=')) {
      envContent = envContent.replace(/TMDB_API_KEY=.*/g, `TMDB_API_KEY="${cleanKey}"`);
    } else {
      envContent += `\nTMDB_API_KEY="${cleanKey}"`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
  } catch (e) {
    console.warn('Could not write TMDB key to .env:', e);
  }

  // Test verify key
  const testRes = await callTmdbApi('/trending/all/day', {});

  res.json({
    success: true,
    verified: testRes.ok,
    status: testRes.status,
    message: testRes.ok 
      ? 'TMDB API key verified successfully! High-res artwork and metadata activated.'
      : 'Key saved, but TMDB returned an error. Please verify your API key.',
  });
});

// 2. Trending on TMDB
app.get('/api/tmdb/trending', async (_req: Request, res: Response) => {
  const result = await callTmdbApi('/trending/all/week', { language: 'en-US' });
  if (!result.ok) {
    return res.status(result.status || 500).json(result);
  }
  res.json(result.data);
});

// 3. Search on TMDB
app.get('/api/tmdb/search', async (req: Request, res: Response) => {
  const query = req.query.query ? String(req.query.query) : '';
  const page = req.query.page ? Number(req.query.page) : 1;

  if (!query.trim()) {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  const result = await callTmdbApi('/search/multi', {
    query: query.trim(),
    include_adult: 'false',
    language: 'en-US',
    page,
  });

  if (!result.ok) {
    return res.status(result.status || 500).json(result);
  }
  res.json(result.data);
});

// 4. Movie Details (with credits, videos, recommendations, and title logos)
const KNOWN_TMDB_IDS: Record<string, number> = {
  // TV Shows
  'severance': 97546,
  'shogun': 126308,
  'arcane': 94605,
  'cyberpunk-edgerunners': 105248,
  'the-last-of-us': 100088,
  'house-of-the-dragon': 94997,
  'stranger-things': 66732,
  'frieren': 209867,
  'jujutsu-kaisen': 95479,
  'demon-slayer': 85937,
  'silo': 125988,
  'game-of-thrones': 1399,
  'breaking-bad': 1396,
  'vision-quest': 104279,
  'daredevil-born-again': 202250,
  'peacemaker': 110492,
  'the-boys': 76479,
  'invincible': 95557,
  'reacher': 108978,
  'fallout': 106379,
  'the-bear': 136283,
  'the-white-lotus': 111803,
  'yellowstone': 73586,
  'true-detective': 46648,
  'succession': 76331,
  'squid-game': 93405,

  // Movies
  'avatar-way-of-water': 76600,
  'avatar-the-way-of-water': 76600,
  'avatar-2009': 19995,
  'avatar': 19995,
  'dune-2': 693134,
  'dune-part-two': 693134,
  'dune': 438631,
  'interstellar': 157336,
  'oppenheimer': 872585,
  'the-batman': 414906,
  'blade-runner-2049': 335984,
  'spider-man-across-the-spider-verse': 569094,
  'john-wick-chapter-4': 603692,
  'deadpool-wolverine': 533535,
  'gladiator-2': 558449,
};

async function resolveTmdbId(type: 'movie' | 'tv', rawId: string): Promise<string> {
  const clean = rawId.replace(/^tmdb-(movie|tv|series)-/i, '').replace(/^tmdb-/i, '').trim();
  if (/^\d+$/.test(clean)) return clean;
  const lookupKey = clean.toLowerCase();
  if (KNOWN_TMDB_IDS[lookupKey]) return String(KNOWN_TMDB_IDS[lookupKey]);
  
  try {
    const searchRes = await callTmdbApi(`/search/${type}`, { query: clean.replace(/-/g, ' ') });
    if (searchRes.ok && searchRes.data?.results?.[0]?.id) {
      return String(searchRes.data.results[0].id);
    }
  } catch {}
  return clean;
}

app.get('/api/tmdb/movie/:id', async (req: Request, res: Response) => {
  const targetId = await resolveTmdbId('movie', req.params.id);
  const result = await callTmdbApi(`/movie/${targetId}`, {
    append_to_response: 'credits,videos,recommendations,images',
    include_image_language: 'en,null',
    language: 'en-US',
  });
  if (!result.ok) return res.status(result.status || 500).json(result);
  res.json(result.data);
});

// 5. TV Show Details (with credits, videos, recommendations, and title logos)
app.get('/api/tmdb/tv/:id', async (req: Request, res: Response) => {
  const targetId = await resolveTmdbId('tv', req.params.id);
  const result = await callTmdbApi(`/tv/${targetId}`, {
    append_to_response: 'credits,videos,recommendations,images',
    include_image_language: 'en,null',
    language: 'en-US',
  });
  if (!result.ok) return res.status(result.status || 500).json(result);
  res.json(result.data);
});

// 6. TV Season Episodes (guaranteed resolution from slug or id)
app.get('/api/tmdb/tv/:id/season/:season_number', async (req: Request, res: Response) => {
  const targetId = await resolveTmdbId('tv', req.params.id);
  const result = await callTmdbApi(`/tv/${targetId}/season/${req.params.season_number}`, {
    language: 'en-US',
  });
  if (!result.ok) return res.status(result.status || 500).json(result);
  res.json(result.data);
});

// 7. Popular Movies/Series
app.get('/api/tmdb/popular/:type', async (req: Request, res: Response) => {
  const endpoint = req.params.type === 'tv' || req.params.type === 'series' ? '/tv/popular' : '/movie/popular';
  const page = req.query.page ? Number(req.query.page) : 1;
  const result = await callTmdbApi(endpoint, { language: 'en-US', page });
  if (!result.ok) return res.status(result.status || 500).json(result);
  res.json(result.data);
});

// 8. Top Rated Movies/Series
app.get('/api/tmdb/top_rated/:type', async (req: Request, res: Response) => {
  const endpoint = req.params.type === 'tv' || req.params.type === 'series' ? '/tv/top_rated' : '/movie/top_rated';
  const page = req.query.page ? Number(req.query.page) : 1;
  const result = await callTmdbApi(endpoint, { language: 'en-US', page });
  if (!result.ok) return res.status(result.status || 500).json(result);
  res.json(result.data);
});

// 9. Recommendations & Similar Titles
app.get('/api/tmdb/:type/:id/recommendations', async (req: Request, res: Response) => {
  const mediaType = req.params.type === 'tv' || req.params.type === 'series' ? 'tv' : 'movie';
  const targetId = await resolveTmdbId(mediaType, req.params.id);
  const result = await callTmdbApi(`/${mediaType}/${targetId}/recommendations`, { language: 'en-US', page: 1 });
  if (!result.ok) return res.status(result.status || 500).json(result);
  res.json(result.data);
});

// 10. Official Trailers & Videos
app.get('/api/tmdb/:type/:id/videos', async (req: Request, res: Response) => {
  const mediaType = req.params.type === 'tv' || req.params.type === 'series' ? 'tv' : 'movie';
  const targetId = await resolveTmdbId(mediaType, req.params.id);
  const result = await callTmdbApi(`/${mediaType}/${targetId}/videos`, { language: 'en-US' });
  if (!result.ok) return res.status(result.status || 500).json(result);
  res.json(result.data);
});

// 11. Official Title Logos & Images
app.get('/api/tmdb/:type/:id/images', async (req: Request, res: Response) => {
  const mediaType = req.params.type === 'tv' || req.params.type === 'series' ? 'tv' : 'movie';
  const targetId = await resolveTmdbId(mediaType, req.params.id);
  const result = await callTmdbApi(`/${mediaType}/${targetId}/images`, { include_image_language: 'en,null' });
  if (!result.ok) return res.status(result.status || 500).json(result);
  res.json(result.data);
});

// ==================== VITE SPA SETUP ====================
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CRATOR streaming server listening on http://0.0.0.0:${PORT}`);
    console.log(`Streaming provider: VidRift (Keyless Embed)`);
    console.log(`TMDB metadata API configured: ${Boolean(getTmdbKey())}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CRATOR server:', err);
  process.exit(1);
});
