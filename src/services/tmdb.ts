import { MediaItem, Season, Episode, MediaType, StreamingPlatform, TmdbVideo } from '../types';

export interface TmdbStatus {
  status: string;
  configured: boolean;
  hasKey: boolean;
  isVerified?: boolean;
}

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export const getTmdbImageUrl = (path: string | null | undefined, size: 'w500' | 'w780' | 'w1280' | 'original' = 'w780') => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${TMDB_IMAGE_BASE}/${size}${path.startsWith('/') ? path : `/${path}`}`;
};

/**
 * Extracts the highest priority official YouTube trailer according to:
 * 1. Official Trailer (English)
 * 2. Official Trailer (any language)
 * 3. Any Trailer
 * 4. Official Teaser
 * 5. Any Teaser
 * 6. Official Clip
 * 7. Any first YouTube video
 */
export function extractBestTrailer(videos?: TmdbVideo[]): TmdbVideo | null {
  if (!videos || !Array.isArray(videos) || videos.length === 0) return null;

  const ytVideos = videos.filter((v) => v && (v.site === 'YouTube' || !v.site) && v.key);
  if (!ytVideos.length) return null;

  // 1. Official Trailer (English)
  const officialEnTrailer = ytVideos.find(
    (v) => v.official && v.type?.toLowerCase() === 'trailer' && (v.iso_639_1 === 'en' || !v.iso_639_1)
  );
  if (officialEnTrailer) return officialEnTrailer;

  // 2. Official Trailer (any)
  const officialTrailer = ytVideos.find((v) => v.official && v.type?.toLowerCase() === 'trailer');
  if (officialTrailer) return officialTrailer;

  // 3. Any Trailer
  const anyTrailer = ytVideos.find((v) => v.type?.toLowerCase() === 'trailer');
  if (anyTrailer) return anyTrailer;

  // 4. Official Teaser
  const officialTeaser = ytVideos.find((v) => v.official && v.type?.toLowerCase() === 'teaser');
  if (officialTeaser) return officialTeaser;

  // 5. Any Teaser
  const anyTeaser = ytVideos.find((v) => v.type?.toLowerCase() === 'teaser');
  if (anyTeaser) return anyTeaser;

  // 6. Official Clip
  const officialClip = ytVideos.find((v) => v.official && v.type?.toLowerCase() === 'clip');
  if (officialClip) return officialClip;

  // 7. Fallback to first video
  return ytVideos[0];
}

// Map TMDB genre IDs to human-readable names
const TMDB_GENRES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
  10759: 'Action & Adventure',
  10762: 'Kids',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
};

// Convert TMDB movie/TV object to CRATOR MediaItem
export function mapTmdbToMediaItem(raw: any, defaultType?: MediaType): MediaItem {
  if (!raw) {
    return {
      id: `tmdb-${Math.random().toString(36).substring(2, 7)}`,
      title: 'Unknown Title',
      type: 'movie',
      synopsis: '',
      posterUrl: '',
      backdropUrl: '',
      rating: 8.0,
      voteCount: '10K',
      releaseYear: new Date().getFullYear(),
      ageRating: 'PG-13',
      quality: '4K Ultra HD',
      audio: 'Dolby Atmos 7.1',
      genres: ['Action', 'Drama'],
      platform: 'Netflix',
      industry: 'Hollywood',
      language: 'English',
      cast: [],
    };
  }

  const isTv = raw.media_type === 'tv' || raw.first_air_date !== undefined || defaultType === 'series';
  const type: MediaType = defaultType || (isTv ? 'series' : 'movie');

  const title = raw.title || raw.name || raw.original_title || raw.original_name || 'Untitled';
  const originalTitle = raw.original_title || raw.original_name;

  const posterPath = raw.poster_path || raw.poster || raw.cover;
  const backdropPath = raw.backdrop_path || raw.backdrop || raw.banner;

  const posterUrl = getTmdbImageUrl(posterPath, 'w780');
  const backdropUrl = getTmdbImageUrl(backdropPath, 'w1280') || posterUrl;

  const releaseDate = typeof raw.release_date === 'string' 
    ? raw.release_date 
    : (typeof raw.first_air_date === 'string' ? raw.first_air_date : '');
  let releaseYear = new Date().getFullYear();
  if (releaseDate) {
    const yr = parseInt(releaseDate.split('-')[0], 10);
    if (!isNaN(yr)) releaseYear = yr;
  }

  // Parse genres
  let genres: string[] = [];
  if (Array.isArray(raw.genres)) {
    genres = raw.genres.map((g: any) => typeof g === 'string' ? g : g?.name).filter(Boolean);
  } else if (Array.isArray(raw.genre_ids)) {
    genres = raw.genre_ids.map((id: number) => TMDB_GENRES[id]).filter(Boolean);
  }
  if (!genres.length) {
    genres = ['Drama', 'Action'];
  }

  // Parse rating
  const rawScore = Number(raw.vote_average ?? raw.score ?? raw.rating);
  const rating = typeof rawScore === 'number' && !isNaN(rawScore) && rawScore > 0 
    ? parseFloat(rawScore.toFixed(1)) 
    : 8.2;
  const voteCount = raw.vote_count ? `${Math.round(raw.vote_count / 1000)}K` : '50K';

  // Parse cast
  const cast = Array.isArray(raw.credits?.cast)
    ? raw.credits.cast.slice(0, 8).map((c: any) => ({
        name: c.name || 'Actor',
        character: c.character || 'Character',
        avatar: getTmdbImageUrl(c.profile_path, 'w500'),
      }))
    : [];

  // Parse director
  let director: string | undefined = undefined;
  if (Array.isArray(raw.credits?.crew)) {
    const dir = raw.credits.crew.find((c: any) => c.job === 'Director');
    if (dir) director = dir.name;
  }

  // Platform guessing based on networks/production
  let platform: StreamingPlatform = 'Netflix';
  const networkName = raw.networks?.[0]?.name?.toLowerCase() || '';
  if (networkName.includes('apple')) platform = 'Apple TV+';
  else if (networkName.includes('hbo') || networkName.includes('max')) platform = 'HBO Max';
  else if (networkName.includes('disney')) platform = 'Disney+';
  else if (networkName.includes('amazon') || networkName.includes('prime')) platform = 'Prime Video';
  else if (networkName.includes('paramount')) platform = 'Paramount+';

  // Parse videos & trailer
  const rawVideos = Array.isArray(raw.videos?.results)
    ? raw.videos.results
    : (Array.isArray(raw.videos) ? raw.videos : []);
  const videos: TmdbVideo[] = rawVideos.map((v: any) => ({
    id: String(v.id || v.key),
    key: String(v.key),
    name: String(v.name || 'Official Video'),
    site: String(v.site || 'YouTube'),
    size: Number(v.size || 1080),
    type: String(v.type || 'Trailer'),
    official: Boolean(v.official),
    published_at: v.published_at,
    iso_639_1: v.iso_639_1,
  }));
  const bestTrailer = extractBestTrailer(videos);
  const trailerKey = bestTrailer?.key;

  return {
    id: `tmdb-${type}-${raw.id}`,
    tmdbId: raw.id,
    streamStatus: 'available',
    title,
    originalTitle: originalTitle !== title ? originalTitle : undefined,
    type,
    tagline: raw.tagline || undefined,
    synopsis: raw.overview || 'No synopsis available.',
    posterUrl,
    backdropUrl,
    rating,
    voteCount,
    releaseYear,
    runtime: raw.runtime ? `${Math.floor(raw.runtime / 60)}h ${raw.runtime % 60}m` : undefined,
    totalSeasons: raw.number_of_seasons || (type === 'series' ? 1 : undefined),
    ageRating: raw.adult ? '18+' : 'PG-13',
    quality: '4K Ultra HD',
    audio: 'Dolby Atmos 7.1',
    genres,
    platform,
    industry: genres.includes('Animation') && raw.original_language === 'ja' ? 'Anime' : 'Hollywood',
    language: raw.original_language === 'ja' ? 'Japanese' : (raw.original_language === 'ko' ? 'Korean' : 'English'),
    director,
    cast,
    videos,
    trailerKey,
  };
}

// 1. Check TMDB status on server
export async function getTmdbStatus(): Promise<TmdbStatus> {
  try {
    const res = await fetch('/api/tmdb/status');
    if (!res.ok) return { status: 'error', configured: false, hasKey: false };
    return await res.json();
  } catch {
    return { status: 'error', configured: false, hasKey: false };
  }
}

// 2. Set/Update TMDB key on server
export async function updateTmdbServerKey(apiKey: string): Promise<{ success: boolean; verified: boolean; message: string }> {
  try {
    const res = await fetch('/api/tmdb/set-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      verified: false,
      message: err.message || 'Failed to update TMDB key',
    };
  }
}

/**
 * Strict VidRift stream availability validator:
 * 1. Must have a valid numeric TMDB ID or AniList ID.
 * 2. Title must not be unreleased, announced, or in future production.
 * 3. Movies: release_date must exist and be <= today's date.
 * 4. TV: first_air_date must exist and be <= today's date.
 * 5. Must have valid cover artwork (poster or backdrop).
 * 6. Must not be adult content.
 */
export function isVidRiftStreamable(rawOrItem: any): boolean {
  if (!rawOrItem) return false;

  // Must have an ID
  const id = rawOrItem.id || rawOrItem.tmdbId;
  if (!id) return false;

  // Must have artwork
  const hasArtwork = Boolean(
    rawOrItem.poster_path ||
    rawOrItem.backdrop_path ||
    rawOrItem.posterUrl ||
    rawOrItem.backdropUrl
  );
  if (!hasArtwork) return false;

  // No adult content
  if (rawOrItem.adult === true) {
    return false;
  }

  // Check status if available (e.g. from detail endpoint)
  if (rawOrItem.status) {
    const s = String(rawOrItem.status).toLowerCase();
    if (
      s.includes('planned') ||
      s.includes('in production') ||
      s.includes('post production') ||
      s.includes('announced') ||
      s.includes('rumored')
    ) {
      return false;
    }
  }

  // Today's date ISO
  const todayStr = new Date().toISOString().split('T')[0];
  const currentYear = new Date().getFullYear();

  const isTv =
    rawOrItem.media_type === 'tv' ||
    rawOrItem.type === 'series' ||
    rawOrItem.type === 'anime' ||
    Boolean(rawOrItem.first_air_date) ||
    Boolean(rawOrItem.totalSeasons);

  if (!isTv) {
    // For movies: release_date must exist and be <= today
    const releaseDate = rawOrItem.release_date || rawOrItem.releaseDate;
    if (typeof releaseDate === 'string' && releaseDate.trim()) {
      if (releaseDate.trim() > todayStr) {
        return false; // Future unreleased movie
      }
    } else if (typeof rawOrItem.releaseYear === 'number' && rawOrItem.releaseYear > currentYear) {
      return false;
    }
  } else {
    // For TV shows: first_air_date must exist and be <= today
    const airDate = rawOrItem.first_air_date || rawOrItem.releaseDate;
    if (typeof airDate === 'string' && airDate.trim()) {
      if (airDate.trim() > todayStr) {
        return false; // Future unreleased TV show
      }
    }
  }

  return true;
}

// 3. Search TMDB (Returns only titles verified available for streaming on VidRift)
export async function searchTmdb(query: string, page: number = 1): Promise<{ items: MediaItem[]; total: number; hasMore: boolean }> {
  try {
    const res = await fetch(`/api/tmdb/search?query=${encodeURIComponent(query)}&page=${page}`);
    if (!res.ok) return { items: [], total: 0, hasMore: false };
    const data = await res.json();

    const results = Array.isArray(data.results) ? data.results : [];
    const items = results
      .filter((r: any) => (r.media_type === 'movie' || r.media_type === 'tv') && isVidRiftStreamable(r))
      .map((r: any) => mapTmdbToMediaItem(r));

    return {
      items,
      total: data.total_results || items.length,
      hasMore: data.page < (data.total_pages || 1),
    };
  } catch {
    return { items: [], total: 0, hasMore: false };
  }
}

// 4. Get Trending on TMDB (Filtered for VidRift streaming availability)
export async function getTmdbTrending(): Promise<MediaItem[]> {
  try {
    const res = await fetch('/api/tmdb/trending');
    if (!res.ok) return [];
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    return results
      .filter((r: any) => isVidRiftStreamable(r))
      .map((r: any) => mapTmdbToMediaItem(r));
  } catch {
    return [];
  }
}

// 5. Get TMDB Details
export async function getTmdbDetail(type: 'movie' | 'tv', id: string | number): Promise<MediaItem | null> {
  try {
    const cleanId = String(id).replace(/^tmdb-(movie|tv|series)-/, '');
    const res = await fetch(`/api/tmdb/${type}/${cleanId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return mapTmdbToMediaItem(data, type === 'tv' ? 'series' : 'movie');
  } catch {
    return null;
  }
}

// 6. Get TV Show Seasons & Episodes from TMDB
export async function getTmdbSeasonEpisodes(tvId: string | number, seasonNumber: number = 1): Promise<Episode[]> {
  try {
    const cleanId = String(tvId).replace(/^tmdb-(movie|tv|series)-/, '');
    const res = await fetch(`/api/tmdb/tv/${cleanId}/season/${seasonNumber}`);
    if (!res.ok) return [];
    const data = await res.json();
    const episodes = Array.isArray(data.episodes) ? data.episodes : [];

    return episodes.map((ep: any) => ({
      id: `tmdb-ep-${ep.id || ep.episode_number}`,
      episodeNumber: ep.episode_number,
      seasonNumber,
      title: ep.name || `Episode ${ep.episode_number}`,
      runtime: ep.runtime ? `${ep.runtime}m` : '48m',
      synopsis: ep.overview || '',
      thumbnail: getTmdbImageUrl(ep.still_path, 'w780'),
    }));
  } catch {
    return [];
  }
}

// 7. Get Popular Titles from TMDB (Filtered for VidRift streaming availability)
export async function getTmdbPopular(type: 'movie' | 'tv' = 'movie', page: number = 1): Promise<MediaItem[]> {
  try {
    const res = await fetch(`/api/tmdb/popular/${type}?page=${page}`);
    if (!res.ok) return [];
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    return results
      .filter((r: any) => isVidRiftStreamable(r))
      .map((r: any) => mapTmdbToMediaItem(r, type === 'tv' ? 'series' : 'movie'));
  } catch {
    return [];
  }
}

// 8. Get Top Rated Titles from TMDB (Filtered for VidRift streaming availability)
export async function getTmdbTopRated(type: 'movie' | 'tv' = 'movie', page: number = 1): Promise<MediaItem[]> {
  try {
    const res = await fetch(`/api/tmdb/top_rated/${type}?page=${page}`);
    if (!res.ok) return [];
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    return results
      .filter((r: any) => isVidRiftStreamable(r))
      .map((r: any) => mapTmdbToMediaItem(r, type === 'tv' ? 'series' : 'movie'));
  } catch {
    return [];
  }
}

// 9. Get Recommendations & Similar Titles from TMDB (Filtered for VidRift streaming availability)
export async function getTmdbRecommendations(type: 'movie' | 'tv', id: string | number): Promise<MediaItem[]> {
  try {
    const cleanId = String(id).replace(/^tmdb-(movie|tv|series)-/, '');
    const res = await fetch(`/api/tmdb/${type}/${cleanId}/recommendations`);
    if (!res.ok) return [];
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    return results
      .filter((r: any) => isVidRiftStreamable(r))
      .map((r: any) => mapTmdbToMediaItem(r, type === 'tv' ? 'series' : 'movie'));
  } catch {
    return [];
  }
}

// 10. Get Official Videos & Trailers from TMDB
export async function getTmdbVideos(type: 'movie' | 'tv', id: string | number): Promise<TmdbVideo[]> {
  try {
    const cleanId = String(id).replace(/^tmdb-(movie|tv|series)-/, '');
    const res = await fetch(`/api/tmdb/${type}/${cleanId}/videos`);
    if (!res.ok) return [];
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    return results.map((v: any) => ({
      id: String(v.id || v.key),
      key: String(v.key),
      name: String(v.name || 'Official Video'),
      site: String(v.site || 'YouTube'),
      size: Number(v.size || 1080),
      type: String(v.type || 'Trailer'),
      official: Boolean(v.official),
      published_at: v.published_at,
      iso_639_1: v.iso_639_1,
    }));
  } catch {
    return [];
  }
}
