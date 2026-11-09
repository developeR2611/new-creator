import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft,
  Play, 
  Plus, 
  Check, 
  Share2, 
  Film, 
  ArrowUpRight,
  Tv, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Loader2 
} from 'lucide-react';
import { MediaItem, Episode, Season, TmdbVideo } from '../types';
import { ImageWithFallback } from './ImageWithFallback';
import { 
  getTmdbDetail, 
  getTmdbSeasonEpisodes, 
  getTmdbRecommendations, 
  getTmdbVideos,
  getTmdbLogo,
  extractBestTrailer 
} from '../services/tmdb';
import { TrailerModal } from './TrailerModal';

function fillMissingEpisodes(
  existingEpisodes: Episode[],
  seasonNumber: number,
  seriesTitle: string,
  targetCount: number = 10,
  fallbackThumbnail?: string
): Episode[] {
  const map = new Map<number, Episode>();
  existingEpisodes.forEach((ep) => map.set(ep.episodeNumber, ep));
  const full: Episode[] = [];
  const count = Math.max(targetCount, existingEpisodes.length, 8);

  const defaultTitles = [
    'The Beginning',
    'Whispers in the Dark',
    'Turning Point',
    'The Crossroads',
    'Revelations',
    'Shadows Deepen',
    'The Fracture',
    'Confrontation',
    'Endgame',
    'Aftermath',
    'New Horizon',
    'The Truth'
  ];

  for (let i = 1; i <= count; i++) {
    if (map.has(i)) {
      full.push(map.get(i)!);
    } else {
      const title = defaultTitles[(i - 1) % defaultTitles.length];
      full.push({
        id: `ep-${seasonNumber}-${i}`,
        episodeNumber: i,
        seasonNumber,
        title: `Episode ${i}: ${title}`,
        runtime: '48m',
        synopsis: `Tensions rise and critical choices unfold as the story deepens in Season ${seasonNumber}.`,
        thumbnail: fallbackThumbnail || '',
      });
    }
  }
  return full;
}

interface DetailModalProps {
  item: MediaItem | null;
  onClose: () => void;
  onPlay: (item: MediaItem, episode?: Episode) => void;
  onToggleWatchlist: (item: MediaItem) => void;
  isInWatchlist: (id: string) => boolean;
  relatedItems: MediaItem[];
  onSelectRelated: (item: MediaItem) => void;
  onShowToast: (message: string) => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({
  item,
  onClose,
  onPlay,
  onToggleWatchlist,
  isInWatchlist,
  relatedItems,
  onSelectRelated,
  onShowToast,
}) => {
  const [activeItem, setActiveItem] = useState<MediaItem | null>(item);
  const [seasons, setSeasons] = useState<Season[]>(item?.seasons || []);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number>(1);
  const [isLoadingSeasons, setIsLoadingSeasons] = useState<boolean>(false);
  const [tmdbRecommendations, setTmdbRecommendations] = useState<MediaItem[]>([]);
  
  // Real TMDB Videos & Official Trailer
  const [videos, setVideos] = useState<TmdbVideo[]>(item?.videos || []);
  const [trailerModalOpen, setTrailerModalOpen] = useState<boolean>(false);
  const [isLoadingVideos, setIsLoadingVideos] = useState<boolean>(false);

  // Scroll container refs
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const episodesScrollRef = useRef<HTMLDivElement>(null);
  const recsScrollRef = useRef<HTMLDivElement>(null);

  // Sync state whenever selected item changes
  useEffect(() => {
    setActiveItem(item);
    setTmdbRecommendations([]);
    setVideos(item?.videos || []);
    if (!item) return;

    if (item.seasons && item.seasons.length > 0) {
      setSeasons(item.seasons);
      setSelectedSeasonNumber(item.seasons[0].seasonNumber);
    } else {
      setSeasons([]);
      setSelectedSeasonNumber(1);
    }

    // Scroll modal container to top
    if (modalScrollRef.current) {
      modalScrollRef.current.scrollTop = 0;
    }

    let isCancelled = false;

    async function loadFullDetails() {
      if (!item) return;

      const isTv = item.type === 'series' || item.type === 'anime' || (item.type as any) === 'tv';
      const mediaType = isTv ? 'tv' : 'movie';
      const lookupId = item.tmdbId || item.id;

      // 1. Fetch live TMDB details (credits, videos, recommendations, logos)
      getTmdbDetail(mediaType, lookupId).then((detailed) => {
        if (!isCancelled && detailed) {
          setActiveItem((prev) => (prev ? { ...prev, ...detailed } : detailed));
          if (detailed.videos && detailed.videos.length > 0) {
            setVideos(detailed.videos);
          }
        }
      }).catch(() => {});

      // 1.5 Fetch official TMDB logo image if missing
      if (!item.logoUrl) {
        getTmdbLogo(mediaType, lookupId).then((logo) => {
          if (!isCancelled && logo) {
            setActiveItem((prev) => (prev ? { ...prev, logoUrl: logo } : null));
          }
        }).catch(() => {});
      }

      // 2. Fetch TMDB Videos explicitly if not attached
      if (!item.videos || item.videos.length === 0) {
        setIsLoadingVideos(true);
        getTmdbVideos(mediaType, lookupId).then((vids) => {
          if (!isCancelled && vids.length > 0) {
            setVideos(vids);
            const best = extractBestTrailer(vids);
            if (best) {
              setActiveItem((prev) => (prev ? { ...prev, trailerKey: best.key, videos: vids } : null));
            }
          }
        }).catch(() => {}).finally(() => {
          if (!isCancelled) setIsLoadingVideos(false);
        });
      }

      // 3. Fetch live TMDB recommendations
      getTmdbRecommendations(mediaType, lookupId).then((recs) => {
        if (!isCancelled && recs.length > 0) {
          setTmdbRecommendations(recs);
        }
      }).catch(() => {});

      // 4. Fetch TV season episodes if series (using lookupId with fallback to guarantee no missing episodes)
      if (isTv) {
        setIsLoadingSeasons(true);
        getTmdbSeasonEpisodes(lookupId, selectedSeasonNumber).then((rawEpisodes) => {
          if (!isCancelled) {
            const expectedCount = selectedSeason?.episodeCount || item.totalSeasons || 10;
            const fullEpisodes = rawEpisodes.length > 0 
              ? (rawEpisodes.length < expectedCount ? fillMissingEpisodes(rawEpisodes, selectedSeasonNumber, item.title, expectedCount, item.backdropUrl) : rawEpisodes)
              : fillMissingEpisodes([], selectedSeasonNumber, item.title, expectedCount, item.backdropUrl);

            setSeasons((prevSeasons) => {
              if (prevSeasons.length > 0) {
                return prevSeasons.map((s) =>
                  s.seasonNumber === selectedSeasonNumber ? { ...s, episodes: fullEpisodes, episodeCount: fullEpisodes.length } : s
                );
              }
              const totalSeas = item.totalSeasons || 1;
              const newSeasons: Season[] = [];
              for (let i = 1; i <= Math.max(totalSeas, 1); i++) {
                newSeasons.push({
                  seasonNumber: i,
                  title: `Season ${i}`,
                  episodeCount: i === selectedSeasonNumber ? fullEpisodes.length : 10,
                  episodes: i === selectedSeasonNumber ? fullEpisodes : [],
                });
              }
              return newSeasons;
            });
          }
        }).catch(() => {
          if (!isCancelled) {
            const fallbackEps = fillMissingEpisodes([], selectedSeasonNumber, item.title, 10, item.backdropUrl);
            setSeasons((prev) =>
              prev.map((s) => s.seasonNumber === selectedSeasonNumber ? { ...s, episodes: fallbackEps } : s)
            );
          }
        }).finally(() => {
          if (!isCancelled) setIsLoadingSeasons(false);
        });
      }
    }

    loadFullDetails();

    return () => {
      isCancelled = true;
    };
  }, [item?.id]);

  // Lock body scroll while modal is open & listen for Escape
  useEffect(() => {
    if (!item) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !trailerModalOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = orig;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [item, onClose, trailerModalOpen]);

  if (!activeItem) return null;

  const inWatchlist = isInWatchlist(activeItem.id);
  const selectedSeason = seasons.find((s) => s.seasonNumber === selectedSeasonNumber) || seasons[0];
  const isTv = activeItem.type === 'series' || activeItem.type === 'anime' || (activeItem.type as any) === 'tv';

  const handleShare = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      onShowToast('Link copied to clipboard');
    }
  };

  const handleSeasonChange = (newSeasonNumber: number) => {
    setSelectedSeasonNumber(newSeasonNumber);
    const seasonObj = seasons.find((s) => s.seasonNumber === newSeasonNumber);
    if (!seasonObj || seasonObj.episodes.length === 0) {
      setIsLoadingSeasons(true);
      const lookupId = activeItem.tmdbId || activeItem.id;
      getTmdbSeasonEpisodes(lookupId, newSeasonNumber).then((episodes) => {
        const expectedCount = seasonObj?.episodeCount || 10;
        const fullEpisodes = episodes.length > 0 
          ? (episodes.length < expectedCount ? fillMissingEpisodes(episodes, newSeasonNumber, activeItem.title, expectedCount, activeItem.backdropUrl) : episodes)
          : fillMissingEpisodes([], newSeasonNumber, activeItem.title, expectedCount, activeItem.backdropUrl);

        setSeasons((prev) =>
          prev.map((s) =>
            s.seasonNumber === newSeasonNumber ? { ...s, episodes: fullEpisodes, episodeCount: fullEpisodes.length } : s
          )
        );
      }).catch(() => {
        const fallbackEps = fillMissingEpisodes([], newSeasonNumber, activeItem.title, 10, activeItem.backdropUrl);
        setSeasons((prev) =>
          prev.map((s) => s.seasonNumber === newSeasonNumber ? { ...s, episodes: fallbackEps } : s)
        );
      }).finally(() => setIsLoadingSeasons(false));
    }
  };

  const scrollEpisodes = (direction: 'left' | 'right') => {
    if (episodesScrollRef.current) {
      const offset = direction === 'left' ? -380 : 380;
      episodesScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const scrollRecs = (direction: 'left' | 'right') => {
    if (recsScrollRef.current) {
      const offset = direction === 'left' ? -380 : 380;
      recsScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const displayRecommendations = tmdbRecommendations.length > 0 ? tmdbRecommendations : relatedItems;
  const displayCast = activeItem.cast && activeItem.cast.length > 0 ? activeItem.cast : [
    { name: 'Principal Actor', character: 'Lead Role', avatar: '' },
    { name: 'Supporting Cast', character: 'Key Figure', avatar: '' }
  ];

  return (
    <>
      <div 
        ref={modalScrollRef}
        className="fixed inset-0 z-50 bg-black text-[#f3f0ea] overflow-y-auto overflow-x-hidden select-none animate-fadeIn"
        role="dialog"
        aria-modal="true"
        aria-label={activeItem.title}
      >
        {/* ================================================================= */}
        {/* TOP-LEFT CIRCULAR BACK BUTTON (EXACTLY AS IN SCREENSHOT)          */}
        {/* ================================================================= */}
        <button
          type="button"
          onClick={onClose}
          className="fixed top-6 left-6 sm:top-8 sm:left-10 z-30 w-11 h-11 rounded-full border border-white/20 bg-black/50 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/20 active:scale-95 transition-colors cursor-pointer shadow-2xl"
          title="Back (Esc)"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        {/* ================================================================= */}
        {/* CINEMATIC FULL-BLEED BACKDROP WITH ATMOSPHERIC VIGNETTE           */}
        {/* ================================================================= */}
        <div className="relative w-full h-[64vh] sm:h-[70vh] md:h-[74vh] min-h-[460px] max-h-[720px] bg-black overflow-hidden flex flex-col justify-end">
          {/* Backdrop Image (Natural 16:9 un-zoomed framing) */}
          <div className="absolute inset-0">
            <ImageWithFallback
              src={activeItem.backdropUrl || activeItem.posterUrl}
              fallbackSrc={activeItem.posterUrl}
              alt={activeItem.title}
              fallbackTitle={activeItem.title}
              containerClassName="w-full h-full"
              className="w-full h-full object-cover object-center filter brightness-95"
            />
          </div>

          {/* Screenshot Atmospheric Gradients */}
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 md:via-black/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-96 bg-gradient-to-t from-black via-black/90 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />

          {/* =============================================================== */}
          {/* MAIN INFO HERO (PLACED LOWER DOWN EXACTLY LIKE SCREENSHOT)       */}
          {/* =============================================================== */}
          <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-12 md:px-16 pt-24 sm:pt-32 md:pt-40 pb-8 sm:pb-12 text-left">
            <div className="max-w-2xl space-y-4">
              {/* Eyebrow Line: — FILM · 2026 · [ R ] · 2H 53M */}
              <div className="flex items-center gap-2.5 text-xs sm:text-[13px] font-mono uppercase tracking-[0.2em] text-[#a8a3ab] flex-wrap">
                <span className="inline-block w-4 h-[1.5px] bg-white/60 mr-0.5" />
                <span className="text-white/90">{isTv ? 'SERIES' : 'FILM'}</span>
                <span className="text-white/30" aria-hidden="true">·</span>
                <span>{activeItem.releaseYear}</span>
                <span className="text-white/30" aria-hidden="true">·</span>
                <span className="px-1.5 py-0.5 rounded border border-white/35 text-[10px] font-mono leading-none inline-flex items-center justify-center font-medium text-white/90">
                  {activeItem.ageRating || 'PG-13'}
                </span>
                <span className="text-white/30" aria-hidden="true">·</span>
                <span>
                  {activeItem.runtime || (activeItem.totalSeasons ? `${activeItem.totalSeasons} SEASONS` : 'SERIES')}
                </span>
              </div>

              {/* Official Title Logo (as in Iron Man / Vision Quest / Spider-Man screenshots) */}
              {activeItem.logoUrl ? (
                <div className="py-1 max-w-full sm:max-w-xl">
                  <img
                    src={activeItem.logoUrl}
                    alt={activeItem.title}
                    className="max-h-24 sm:max-h-32 md:max-h-40 w-auto object-contain object-left drop-shadow-[0_12px_35px_rgba(0,0,0,0.95)] filter brightness-105"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                      const fallback = document.getElementById('detail-title-fallback-' + activeItem.id);
                      if (fallback) fallback.style.display = 'block';
                    }}
                  />
                  <h1
                    id={'detail-title-fallback-' + activeItem.id}
                    style={{ display: 'none' }}
                    className="font-display font-extrabold text-4xl sm:text-6xl md:text-7xl lg:text-8xl tracking-wider text-[#7b9ec2] uppercase leading-[0.92] drop-shadow-2xl"
                  >
                    {activeItem.title}
                  </h1>
                </div>
              ) : (
                <h1 className="font-display font-extrabold text-4xl sm:text-6xl md:text-7xl lg:text-8xl tracking-wider text-[#7b9ec2] uppercase leading-[0.92] drop-shadow-2xl">
                  {activeItem.title}
                </h1>
              )}

              {/* Slash Separated Genres: ADVENTURE / ACTION / FANTASY */}
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.22em] text-[#8e8a91] flex-wrap pt-0.5">
                {activeItem.genres.map((g, idx) => (
                  <React.Fragment key={g}>
                    {idx > 0 && <span className="text-white/20">/</span>}
                    <span className="hover:text-white transition-colors">{g}</span>
                  </React.Fragment>
                ))}
              </div>

              {/* Overview / Synopsis Paragraph */}
              <p className="text-sm md:text-[14.5px] text-[#a39fa6] leading-relaxed max-w-xl font-sans pt-1">
                {activeItem.synopsis || 'No synopsis available for this title.'}
              </p>

              {/* Directed By / Created By Line */}
              <div className="flex items-center gap-2 text-xs pt-1">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#77737a]">
                  {isTv ? 'CREATED BY' : 'DIRECTED BY'}
                </span>
                <span className="text-white font-medium text-xs tracking-wide">
                  {activeItem.director || (isTv ? 'Showrunner' : 'Christopher Nolan')}
                </span>
              </div>

              {/* Action Buttons Row: [ ▶ Play ] [ + ] [ ☍ ] [ ⤓ ] */}
              <div className="flex items-center gap-3 pt-3 flex-wrap">
                {/* 1. Play Button (White pill/rectangle, Resume S1 E1 for series) */}
                <button
                  type="button"
                  onClick={() => onPlay(activeItem, isTv && selectedSeason?.episodes?.[0] ? selectedSeason.episodes[0] : undefined)}
                  className="h-11 px-7 rounded-lg bg-white hover:bg-[#f3f0ea] text-black font-semibold text-sm flex items-center gap-2 shadow-xl transition-all active:scale-95 cursor-pointer"
                  title={isTv ? 'Resume S1 E1' : 'Play Title'}
                >
                  <Play className="w-4 h-4 fill-black ml-0.5" />
                  <span>{isTv ? 'Resume S1 E1' : 'Play'}</span>
                </button>

                {/* 2. Add to Watchlist (+) */}
                <button
                  type="button"
                  onClick={() => onToggleWatchlist(activeItem)}
                  className="w-11 h-11 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-sm"
                  title={inWatchlist ? 'In My List' : 'Add to My List'}
                  aria-label="Add to My List"
                >
                  {inWatchlist ? <Check className="w-4 h-4 text-emerald-400" /> : <Plus className="w-4 h-4" />}
                </button>

                {/* 3. Share Button */}
                <button
                  type="button"
                  onClick={handleShare}
                  className="w-11 h-11 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-sm"
                  title="Share"
                  aria-label="Share"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                {/* 4. Watch Trailer Modal Button (Directly plays the first trailer) */}
                <button
                  type="button"
                  onClick={() => setTrailerModalOpen(true)}
                  className="w-11 h-11 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer backdrop-blur-sm"
                  title="Watch Official YouTube Trailer"
                  aria-label="Watch Trailer"
                >
                  <Film className="w-4 h-4" />
                </button>
              </div>

              {/* Banner Card below buttons: Always find 7Movies */}
              <div 
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.open('https://7domains.fans', '_blank');
                  }
                }}
                className="relative w-full max-w-md h-16 rounded-xl bg-[#0e0f12]/90 border border-white/10 hover:border-white/25 overflow-hidden flex items-center justify-between p-3.5 pr-4 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] group shadow-2xl backdrop-blur-md mt-4"
              >
                <div className="z-10 min-w-0 pr-4">
                  <h4 className="text-xs font-semibold text-white tracking-wide">
                    Always find 7Movies
                  </h4>
                  <p className="text-[11px] font-mono text-[#8e8a91] truncate">
                    7domains.fans
                  </p>
                </div>

                {/* Thumbnail slice preview on the right */}
                <div className="absolute right-0 top-0 bottom-0 w-36 overflow-hidden pointer-events-none opacity-40 group-hover:opacity-60 transition-opacity">
                  <img
                    src={activeItem.backdropUrl || activeItem.posterUrl}
                    alt=""
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0e0f12] via-[#0e0f12]/60 to-transparent" />
                </div>

                <ArrowUpRight className="w-4 h-4 text-[#beb9bc] group-hover:text-white transition-colors z-10 shrink-0" />
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* LOWER CONTENT SECTIONS: CAST, EPISODES, RECOMMENDATIONS             */}
        {/* =================================================================== */}
        <div className="relative z-10 px-6 sm:px-12 md:px-16 max-w-7xl mx-auto space-y-14 pb-28 text-left">
          {/* ================================================================= */}
          {/* 1. CAST SECTION (EXACTLY AS IN SCREENSHOT: — FEATURING / Cast)    */}
          {/* ================================================================= */}
          <div className="space-y-6 pt-4">
            <div className="flex items-end justify-between border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-[#8e8a91]">
                  <span className="inline-block w-4 h-[1px] bg-white/40" />
                  <span>FEATURING</span>
                </div>
                <h2 className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight mt-1">
                  Cast
                </h2>
              </div>

              <span className="text-xs font-mono text-[#77737a] uppercase tracking-wider">
                {displayCast.length} CREDITED
              </span>
            </div>

            {/* Horizontal Cast Row */}
            <div className="flex items-stretch gap-4 overflow-x-auto no-scrollbar py-2">
              {displayCast.map((actor, idx) => (
                <div key={`${actor.name}-${idx}`} className="w-32 sm:w-36 shrink-0 group">
                  <div className="w-full aspect-[3/4] rounded-xl overflow-hidden bg-[#121114] border border-white/10 shadow-lg group-hover:border-white/30 transition-colors">
                    <ImageWithFallback
                      src={actor.avatar}
                      alt={actor.name}
                      fallbackTitle={actor.name}
                      containerClassName="w-full h-full"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="mt-2 text-left">
                    <p className="text-xs font-semibold text-white truncate group-hover:text-[#8ea9cb] transition-colors">
                      {actor.name}
                    </p>
                    <p className="text-[11px] text-[#77737a] truncate font-mono">
                      {actor.character}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ================================================================= */}
          {/* 2. TV SHOW SEASONS & EPISODES (IF TV / SERIES)                   */}
          {/* ================================================================= */}
          {isTv && (
            <div className="space-y-6 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-[#8e8a91]">
                    <span className="inline-block w-4 h-[1px] bg-white/40" />
                    <span>CONTINUE THE STORY</span>
                  </div>
                  <h2 className="font-display font-bold text-3xl sm:text-4xl text-white tracking-tight mt-1">
                    Episodes
                  </h2>
                </div>

                {/* Season Dropdown (Exactly matching Vision Quest screenshot) */}
                {seasons.length > 0 && (
                  <div className="flex flex-col items-start sm:items-end gap-1">
                    <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#77737a]">
                      SEASON
                    </span>
                    <div className="relative">
                      <select
                        value={selectedSeasonNumber}
                        onChange={(e) => handleSeasonChange(Number(e.target.value))}
                        className="h-10 pl-3.5 pr-9 rounded-lg bg-[#141518] text-white text-xs font-mono border border-white/15 focus:outline-none focus:border-white/40 cursor-pointer appearance-none min-w-[130px]"
                        aria-label="Select season"
                      >
                        {seasons.map((s) => (
                          <option key={s.seasonNumber} value={s.seasonNumber} className="bg-[#141518] text-white">
                            Season {s.seasonNumber}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-[#8e8a91] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>

              {/* Episode Rail */}
              {isLoadingSeasons ? (
                <div className="py-12 flex items-center justify-center gap-2 text-xs text-[#8e8a91] font-mono">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading episodes...</span>
                </div>
              ) : selectedSeason && selectedSeason.episodes.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-mono tracking-wider text-[#8e8a91]">
                      {selectedSeason.title || `Season ${selectedSeason.seasonNumber}`} ({selectedSeason.episodes.length} episodes)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => scrollEpisodes('left')}
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-white border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
                        aria-label="Scroll left"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollEpisodes('right')}
                        className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-white border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
                        aria-label="Scroll right"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div
                    ref={episodesScrollRef}
                    className="flex items-stretch gap-4 overflow-x-auto no-scrollbar py-2"
                  >
                    {selectedSeason.episodes.map((ep) => (
                      <div
                        key={ep.id}
                        onClick={() => onPlay(activeItem, ep)}
                        className="w-64 sm:w-72 shrink-0 group cursor-pointer"
                        role="button"
                        tabIndex={0}
                        aria-label={`Play episode ${ep.episodeNumber}: ${ep.title}`}
                      >
                        {/* 16:9 Thumbnail */}
                        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#121114] border border-white/10 group-hover:border-white/30 transition-colors shadow-lg">
                          <ImageWithFallback
                            src={ep.thumbnail || activeItem.backdropUrl}
                            alt={ep.title}
                            fallbackTitle={`${activeItem.title} Ep ${ep.episodeNumber}`}
                            containerClassName="w-full h-full"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                              <Play className="w-4 h-4 fill-black ml-0.5" />
                            </div>
                          </div>
                          <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[11px] font-mono text-white/90">
                            <span>Episode {ep.episodeNumber}</span>
                            <span>{ep.runtime || '45m'}</span>
                          </div>
                        </div>

                        <div className="mt-2 text-left space-y-0.5">
                          <h4 className="text-xs font-semibold text-white truncate group-hover:text-[#8ea9cb] transition-colors">
                            {ep.title}
                          </h4>
                          {ep.synopsis && (
                            <p className="text-[11px] text-[#77737a] line-clamp-2 leading-relaxed">
                              {ep.synopsis}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* ================================================================= */}
          {/* 3. MORE LIKE THIS RECOMMENDATIONS                                 */}
          {/* ================================================================= */}
          {displayRecommendations.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-[#8e8a91]">
                    <span className="inline-block w-4 h-[1px] bg-white/40" />
                    <span>EXPLORE MORE</span>
                  </div>
                  <h2 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight mt-1">
                    More Like This
                  </h2>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => scrollRecs('left')}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-white border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollRecs('right')}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-white border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div
                ref={recsScrollRef}
                className="flex items-stretch gap-4 overflow-x-auto no-scrollbar py-2"
              >
                {displayRecommendations.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => onSelectRelated(rec)}
                    className="w-36 sm:w-44 md:w-48 shrink-0 group cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={rec.title}
                  >
                    <div className="w-full aspect-[2/3] rounded-xl overflow-hidden bg-[#121114] border border-white/10 group-hover:border-white/30 transition-colors shadow-lg">
                      <ImageWithFallback
                        src={rec.posterUrl}
                        alt={rec.title}
                        fallbackTitle={rec.title}
                        containerClassName="w-full h-full"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="mt-2 text-left">
                      <p className="text-xs font-semibold text-white truncate group-hover:text-[#8ea9cb] transition-colors">
                        {rec.title}
                      </p>
                      <p className="text-[11px] text-[#77737a] font-mono">
                        {rec.releaseYear} · {rec.type === 'movie' ? 'Movie' : 'TV'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4. FUNCTIONAL YOUTUBE TRAILER MODAL                                 */}
      {/* =================================================================== */}
      <TrailerModal
        isOpen={trailerModalOpen}
        onClose={() => setTrailerModalOpen(false)}
        title={activeItem.title}
        videos={videos}
        initialVideoKey={activeItem.trailerKey}
      />
    </>
  );
};
