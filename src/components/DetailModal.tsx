import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Play, 
  Bookmark, 
  Check, 
  Share2, 
  Star, 
  Tv, 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  Film,
  User,
  Sparkles
} from 'lucide-react';
import { MediaItem, Episode, Season, TmdbVideo } from '../types';
import { ImageWithFallback } from './ImageWithFallback';
import { 
  getTmdbDetail, 
  getTmdbSeasonEpisodes, 
  getTmdbRecommendations, 
  getTmdbVideos,
  extractBestTrailer 
} from '../services/tmdb';
import { TrailerModal } from './TrailerModal';

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
  const castScrollRef = useRef<HTMLDivElement>(null);
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

      // 1. Fetch live TMDB details (with credits, videos, recommendations)
      getTmdbDetail(mediaType, lookupId).then((detailed) => {
        if (!isCancelled && detailed) {
          setActiveItem((prev) => (prev ? { ...prev, ...detailed } : detailed));
          if (detailed.videos && detailed.videos.length > 0) {
            setVideos(detailed.videos);
          }
        }
      }).catch(() => {});

      // 2. Fetch TMDB Videos explicitly if not already attached
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

      // 4. Fetch TV season episodes if series
      if (isTv) {
        setIsLoadingSeasons(true);
        getTmdbSeasonEpisodes(item.id, selectedSeasonNumber).then((episodes) => {
          if (!isCancelled && episodes.length > 0) {
            setSeasons((prevSeasons) => {
              if (prevSeasons.length > 0) {
                return prevSeasons.map((s) =>
                  s.seasonNumber === selectedSeasonNumber ? { ...s, episodes } : s
                );
              }
              const totalSeas = item.totalSeasons || 1;
              const newSeasons: Season[] = [];
              for (let i = 1; i <= Math.max(totalSeas, 1); i++) {
                newSeasons.push({
                  seasonNumber: i,
                  title: `Season ${i}`,
                  episodeCount: i === selectedSeasonNumber ? episodes.length : 10,
                  episodes: i === selectedSeasonNumber ? episodes : [],
                });
              }
              return newSeasons;
            });
          }
        }).catch(() => {}).finally(() => {
          if (!isCancelled) setIsLoadingSeasons(false);
        });
      }
    }

    loadFullDetails();

    return () => {
      isCancelled = true;
    };
  }, [item?.id]);

  // Lock body scroll while modal is open
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

  // Best trailer resolution
  const bestTrailer = extractBestTrailer(videos) || (activeItem.trailerKey ? { key: activeItem.trailerKey } as TmdbVideo : null);

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
      getTmdbSeasonEpisodes(activeItem.id, newSeasonNumber).then((episodes) => {
        if (episodes.length > 0) {
          setSeasons((prev) =>
            prev.map((s) =>
              s.seasonNumber === newSeasonNumber ? { ...s, episodes, episodeCount: episodes.length } : s
            )
          );
        }
      }).catch(() => {}).finally(() => setIsLoadingSeasons(false));
    }
  };

  const scrollCast = (direction: 'left' | 'right') => {
    if (castScrollRef.current) {
      const offset = direction === 'left' ? -320 : 320;
      castScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const scrollRecs = (direction: 'left' | 'right') => {
    if (recsScrollRef.current) {
      const offset = direction === 'left' ? -400 : 400;
      recsScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Safe rating & display formatting
  const formattedRating = (
    typeof activeItem.rating === 'number' && !isNaN(activeItem.rating) ? activeItem.rating : 8.2
  ).toFixed(1);

  const displayRecommendations = tmdbRecommendations.length > 0 ? tmdbRecommendations : relatedItems;

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
        {/* 1. CINEMATIC FULL-WIDTH BACKDROP (IMAX-SCALE PROPORTIONS)        */}
        {/* ================================================================= */}
        <div className="relative w-full h-[520px] sm:h-[640px] md:h-[760px] lg:h-[860px] xl:h-[940px] min-h-[75vh] bg-black overflow-hidden">
          {/* Backdrop Image */}
          <div className="absolute inset-0">
            <ImageWithFallback
              src={activeItem.backdropUrl || activeItem.posterUrl}
              fallbackSrc={activeItem.posterUrl}
              alt={activeItem.title}
              fallbackTitle={activeItem.title}
              containerClassName="w-full h-full"
              className="w-full h-full object-cover object-top filter brightness-95"
            />
          </div>

          {/* 7Movies Multi-Layered Gradients: Seamless black fade into page content */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/30 to-transparent hidden md:block" />
          <div className="absolute inset-x-0 bottom-0 h-64 sm:h-80 md:h-96 bg-gradient-to-t from-black via-black to-transparent" />

          {/* Top Floating Action Bar */}
          <div className="absolute top-5 sm:top-8 inset-x-0 px-6 sm:px-10 md:px-14 flex items-center justify-between z-20 pointer-events-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-12 h-12 rounded-full bg-black/75 backdrop-blur-md border border-white/20 hover:border-white text-white flex items-center justify-center transition-all cursor-pointer shadow-2xl hover:scale-105 active:scale-95"
              title="Close (Esc)"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex px-4 py-1.5 rounded-full text-xs font-mono bg-black/70 backdrop-blur-md border border-white/20 text-white font-semibold shadow-lg">
                VidRift 4K Ultra HD · Ad-Free
              </span>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2. MAIN MOVIE INFORMATION & BALANCED EXPANSIVE POSTER LAYOUT     */}
        {/* ================================================================= */}
        <div className="relative z-10 -mt-52 sm:-mt-68 md:-mt-84 lg:-mt-[400px] xl:-mt-[440px] px-4 sm:px-8 md:px-12 lg:px-16 max-w-[1600px] w-full mx-auto space-y-16 pb-28">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-8 md:gap-12 lg:gap-14">
            {/* High-Resolution Grand Portrait Poster */}
            <div className="w-60 sm:w-72 md:w-80 lg:w-96 xl:w-[420px] aspect-[2/3] shrink-0 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_35px_90px_-15px_rgba(0,0,0,0.98)] border border-white/25 bg-[#111215] group">
              <ImageWithFallback
                src={activeItem.posterUrl}
                fallbackSrc={activeItem.backdropUrl}
                alt={activeItem.title}
                fallbackTitle={activeItem.title}
                containerClassName="w-full h-full"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>

            {/* Movie / TV Metadata and Title */}
            <div className="flex-1 space-y-5 text-center md:text-left min-w-0">
              {/* Unboxed Metadata Line (No static pills) */}
              <div className="flex items-center justify-center md:justify-start gap-2.5 sm:gap-3 flex-wrap text-sm sm:text-base md:text-lg text-[#beb9bc]">
                <span className="flex items-center gap-1.5 font-bold text-amber-300">
                  <Star className="w-5 h-5 fill-amber-300 text-amber-300" />
                  <span className="text-base sm:text-lg">{formattedRating}</span>
                  {activeItem.voteCount && (
                    <span className="text-[#8e8a91] font-normal text-xs sm:text-sm">({activeItem.voteCount})</span>
                  )}
                </span>
                <span className="text-white/30" aria-hidden="true">·</span>
                <span className="font-semibold">{activeItem.releaseYear}</span>
                <span className="text-white/30" aria-hidden="true">·</span>
                <span>{activeItem.runtime || (activeItem.totalSeasons ? `${activeItem.totalSeasons} Season${activeItem.totalSeasons > 1 ? 's' : ''}` : 'Series')}</span>
                <span className="text-white/30" aria-hidden="true">·</span>
                <span className="px-2 py-0.5 rounded text-xs font-mono uppercase bg-white/10 text-white border border-white/15">
                  {activeItem.ageRating || 'PG-13'}
                </span>
                <span className="text-white/30" aria-hidden="true">·</span>
                <span>{activeItem.language || 'English'}</span>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <h1 className="font-display font-black text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl text-white tracking-tight leading-[1.02]">
                  {activeItem.title}
                </h1>
                {activeItem.tagline && (
                  <p className="text-base sm:text-lg md:text-xl lg:text-2xl italic text-[#beb9bc] font-serif">
                    "{activeItem.tagline}"
                  </p>
                )}
              </div>

              {/* Genres Line */}
              <div className="flex items-center justify-center md:justify-start gap-2.5 flex-wrap text-xs sm:text-sm md:text-base text-[#8e8a91]">
                {activeItem.genres.map((g, idx) => (
                  <React.Fragment key={g}>
                    {idx > 0 && <span className="text-white/20">/</span>}
                    <span className="hover:text-white transition-colors">{g}</span>
                  </React.Fragment>
                ))}
              </div>

              {/* Action Buttons Row - Grand & Substantial */}
              <div className="flex items-center justify-center md:justify-start gap-3 sm:gap-4 flex-wrap pt-3">
                {/* 1. Watch Now (VidRift) */}
                <button
                  type="button"
                  onClick={() => onPlay(activeItem, isTv && selectedSeason?.episodes?.[0] ? selectedSeason.episodes[0] : undefined)}
                  className="h-14 sm:h-16 px-8 sm:px-10 rounded-full bg-[#f3f0ea] hover:bg-white text-black font-bold text-base sm:text-lg flex items-center gap-3 shadow-2xl transition-transform active:scale-95 cursor-pointer"
                  title="Stream full video on VidRift"
                >
                  <Play className="w-5 h-5 fill-black ml-0.5" />
                  <span>
                    {isTv ? 'Watch Episode 1' : 'Watch Now'}
                  </span>
                </button>

                {/* 2. Watch Trailer (Real YouTube Embed) */}
                <button
                  type="button"
                  onClick={() => setTrailerModalOpen(true)}
                  className="h-14 sm:h-16 px-7 sm:px-9 rounded-full bg-white/10 hover:bg-white/18 text-white border border-white/20 font-semibold text-base sm:text-lg flex items-center gap-2.5 transition-all active:scale-95 cursor-pointer backdrop-blur-sm"
                  title="Watch Official YouTube Trailer"
                >
                  <Film className="w-5 h-5 text-white" />
                  <span>Watch Trailer</span>
                  {videos.length > 1 && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/15 text-white/90">
                      {videos.length}
                    </span>
                  )}
                </button>

                {/* 3. Add to My List */}
                <button
                  type="button"
                  onClick={() => onToggleWatchlist(activeItem)}
                  className={`h-14 sm:h-16 px-6 sm:px-8 rounded-full border text-base sm:text-lg font-semibold flex items-center gap-2.5 transition-all active:scale-95 cursor-pointer ${
                    inWatchlist
                      ? 'bg-white text-black border-white'
                      : 'bg-white/5 hover:bg-white/10 text-white border-white/15'
                  }`}
                  title={inWatchlist ? 'Remove from My List' : 'Save to My List'}
                >
                  {inWatchlist ? <Check className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                  <span>{inWatchlist ? 'In List' : 'My List'}</span>
                </button>

                {/* 4. Share */}
                <button
                  type="button"
                  onClick={handleShare}
                  className="h-14 sm:h-16 w-14 sm:w-16 rounded-full bg-white/5 hover:bg-white/10 text-white border border-white/15 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                  title="Copy share link"
                >
                  <Share2 className="w-5 h-5" />
                </button>
              </div>

              {/* Overview / Synopsis */}
              <div className="pt-3 text-left">
                <p className="text-base sm:text-lg md:text-xl text-[#beb9bc] leading-relaxed max-w-5xl font-normal">
                  {activeItem.synopsis || 'No synopsis available for this title.'}
                </p>
              </div>

              {/* Director & Stream Platform Info */}
              <div className="pt-4 flex items-center gap-8 flex-wrap text-xs sm:text-sm text-[#8e8a91] font-mono border-t border-white/15">
                {activeItem.director && (
                  <div>
                    <span className="text-white/40 block text-[11px] uppercase tracking-wider">Director</span>
                    <span className="text-white font-medium text-sm sm:text-base">{activeItem.director}</span>
                  </div>
                )}
                <div>
                  <span className="text-white/40 block text-[11px] uppercase tracking-wider">Streaming Engine</span>
                  <span className="text-white font-medium text-sm sm:text-base">{activeItem.platform || 'VidRift'}</span>
                </div>
                <div>
                  <span className="text-white/40 block text-[11px] uppercase tracking-wider">Audio / HDR</span>
                  <span className="text-white font-medium text-sm sm:text-base">{activeItem.audio || 'Dolby Atmos / 4K'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* 3. TV SHOW SEASONS & EPISODES (IF TV / SERIES)                   */}
          {/* ================================================================= */}
          {isTv && (
            <div className="space-y-6 pt-10 border-t border-white/15 text-left">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white shadow-lg">
                    <Tv className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-display font-black text-2xl sm:text-3xl md:text-4xl text-white">Episodes</h2>
                    <p className="text-xs sm:text-sm text-[#8e8a91] font-mono">
                      Stream full episodes instantly via VidRift 4K Ultra HD
                    </p>
                  </div>
                </div>

                {/* Season Selector Tabs */}
                {seasons.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    {seasons.map((s) => (
                      <button
                        key={s.seasonNumber}
                        type="button"
                        onClick={() => handleSeasonChange(s.seasonNumber)}
                        className={`px-5 sm:px-6 py-2.5 sm:py-3 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                          selectedSeasonNumber === s.seasonNumber
                            ? 'bg-white text-black shadow-xl scale-105'
                            : 'bg-white/5 hover:bg-white/10 text-[#beb9bc] hover:text-white border border-white/10'
                        }`}
                      >
                        Season {s.seasonNumber}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Episodes Rail / List */}
              {isLoadingSeasons ? (
                <div className="flex items-center justify-center py-20 text-[#8e8a91] gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                  <span className="text-sm font-mono">Loading Season {selectedSeasonNumber} episodes...</span>
                </div>
              ) : selectedSeason && selectedSeason.episodes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  {selectedSeason.episodes.map((ep) => (
                    <div
                      key={ep.id}
                      onClick={() => onPlay(activeItem, ep)}
                      className="group flex items-start gap-4 sm:gap-5 p-3.5 sm:p-4 rounded-2xl bg-[#111215] hover:bg-[#18191e] border border-white/10 hover:border-white/30 transition-all cursor-pointer text-left shadow-lg"
                    >
                      {/* 16:9 Episode Thumbnail */}
                      <div className="relative aspect-video w-36 sm:w-48 md:w-56 rounded-xl overflow-hidden shrink-0 bg-black">
                        <ImageWithFallback
                          src={ep.thumbnail || activeItem.backdropUrl || activeItem.posterUrl}
                          alt={ep.title}
                          fallbackTitle={ep.title}
                          containerClassName="w-full h-full"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                          <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform">
                            <Play className="w-4 h-4 fill-black ml-0.5" />
                          </div>
                        </div>
                        <span className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded bg-black/85 text-[11px] font-mono text-white font-semibold">
                          {ep.runtime}
                        </span>
                      </div>

                      {/* Episode Content */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-mono font-bold text-white/80">
                            E{ep.episodeNumber}
                          </span>
                          <span className="text-white/20">·</span>
                          <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-white truncate">
                            {ep.title}
                          </h3>
                        </div>
                        <p className="text-xs sm:text-sm text-[#8e8a91] line-clamp-2 sm:line-clamp-3 leading-relaxed">
                          {ep.synopsis || 'Full HD stream available with multi-subtitles and fast streaming.'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Fallback Episode Quick Grid */
                <div className="p-8 rounded-2xl bg-[#111215] border border-white/10 space-y-5">
                  <p className="text-sm text-[#beb9bc] font-medium">
                    Select any episode to stream immediately in VidRift:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((epNum) => (
                      <button
                        key={`quick-ep-${epNum}`}
                        type="button"
                        onClick={() =>
                          onPlay(activeItem, {
                            id: `${activeItem.id}-s${selectedSeasonNumber}e${epNum}`,
                            episodeNumber: epNum,
                            seasonNumber: selectedSeasonNumber,
                            title: `Episode ${epNum}`,
                            runtime: '50m',
                            synopsis: activeItem.synopsis,
                            thumbnail: activeItem.backdropUrl || activeItem.posterUrl,
                          })
                        }
                        className="p-3.5 rounded-xl bg-[#17181c] hover:bg-white hover:text-black border border-white/10 hover:border-white text-left transition-all cursor-pointer flex items-center justify-between group shadow-md"
                      >
                        <div>
                          <span className="text-sm font-bold block text-white group-hover:text-black">
                            Ep {epNum}
                          </span>
                          <span className="text-xs text-[#8e8a91] group-hover:text-neutral-700 font-mono">
                            Season {selectedSeasonNumber}
                          </span>
                        </div>
                        <Play className="w-4 h-4 text-white/60 group-hover:text-black fill-current shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* 4. CAST AND CREW SECTION                                          */}
          {/* ================================================================= */}
          {activeItem.cast && activeItem.cast.length > 0 && (
            <div className="space-y-6 pt-10 border-t border-white/15 text-left">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display font-black text-2xl sm:text-3xl md:text-4xl text-white">Top Cast</h2>
                  <p className="text-xs sm:text-sm text-[#8e8a91] font-mono">
                    Actors and characters from The Movie Database
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => scrollCast('left')}
                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 text-white border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Scroll cast left"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCast('right')}
                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 text-white border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Scroll cast right"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Cast Portrait Carousel - Bigger Cards */}
              <div 
                ref={castScrollRef}
                className="flex items-stretch gap-4 overflow-x-auto no-scrollbar py-2"
              >
                {activeItem.cast.map((member) => (
                  <div
                    key={member.name}
                    className="w-36 sm:w-44 md:w-48 shrink-0 rounded-2xl overflow-hidden bg-[#111215] border border-white/10 flex flex-col group hover:border-white/35 transition-all shadow-lg"
                  >
                    {/* Actor Portrait */}
                    <div className="aspect-[3/4] w-full bg-[#18191e] overflow-hidden relative">
                      {member.avatar ? (
                        <ImageWithFallback
                          src={member.avatar}
                          alt={member.name}
                          fallbackTitle={member.name}
                          containerClassName="w-full h-full"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/5 text-[#8e8a91]">
                          <User className="w-10 h-10 opacity-40" />
                        </div>
                      )}
                    </div>

                    {/* Actor Names */}
                    <div className="p-3 space-y-1">
                      <h3 className="font-bold text-sm text-white truncate" title={member.name}>
                        {member.name}
                      </h3>
                      <p className="text-xs text-[#8e8a91] truncate" title={member.character}>
                        {member.character || 'Cast'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* 5. MORE LIKE THIS (RECOMMENDATIONS)                              */}
          {/* ================================================================= */}
          {displayRecommendations.length > 0 && (
            <div className="space-y-6 pt-10 border-t border-white/15 text-left">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display font-black text-2xl sm:text-3xl md:text-4xl text-white">More Like This</h2>
                  <p className="text-xs sm:text-sm text-[#8e8a91] font-mono">
                    Titles you might enjoy based on {activeItem.title}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => scrollRecs('left')}
                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 text-white border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Scroll recommendations left"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollRecs('right')}
                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/15 text-white border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Scroll recommendations right"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Recommendations Horizontal Carousel - Bigger Cards */}
              <div 
                ref={recsScrollRef}
                className="flex items-stretch gap-5 overflow-x-auto no-scrollbar py-2"
              >
                {displayRecommendations.map((rel) => {
                  const relRating = (
                    typeof rel.rating === 'number' && !isNaN(rel.rating) ? rel.rating : 8.2
                  ).toFixed(1);

                  return (
                    <div
                      key={rel.id}
                      onClick={() => onSelectRelated(rel)}
                      className="w-44 sm:w-56 md:w-64 shrink-0 flex flex-col group cursor-pointer text-left"
                    >
                      {/* Portrait Poster */}
                      <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden bg-[#111215] border border-white/10 group-hover:border-white/40 transition-all relative shadow-xl">
                        <ImageWithFallback
                          src={rel.posterUrl}
                          fallbackSrc={rel.backdropUrl}
                          alt={rel.title}
                          fallbackTitle={rel.title}
                          containerClassName="w-full h-full"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-xl transform group-hover:scale-110 transition-transform">
                            <Play className="w-4 h-4 fill-black ml-0.5" />
                          </div>
                        </div>
                      </div>

                      {/* Copy */}
                      <div className="pt-2.5 space-y-1">
                        <h3 className="font-bold text-sm sm:text-base text-white group-hover:text-white truncate" title={rel.title}>
                          {rel.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-[#8e8a91]">
                          <span>{rel.releaseYear}</span>
                          <span>·</span>
                          <span className="flex items-center gap-0.5 text-amber-300 font-mono font-bold">
                            ★ {relRating}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 6. CINEMATIC YOUTUBE TRAILER MODAL                                  */}
      {/* =================================================================== */}
      <TrailerModal
        isOpen={trailerModalOpen}
        onClose={() => setTrailerModalOpen(false)}
        title={activeItem.title}
        videos={videos}
        initialVideoKey={bestTrailer?.key}
      />
    </>
  );
};
