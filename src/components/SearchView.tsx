import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  X, 
  Clock, 
  Loader2, 
  TrendingUp, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Info, 
  Film, 
  Tv, 
  Star 
} from 'lucide-react';
import { MediaItem } from '../types';
import { MediaCard } from './MediaCard';
import { ImageWithFallback } from './ImageWithFallback';
import { searchTmdb } from '../services/tmdb';

interface SearchViewProps {
  mediaCatalog: MediaItem[];
  onPlay: (item: MediaItem) => void;
  onOpenDetails: (item: MediaItem) => void;
  onToggleWatchlist: (item: MediaItem) => void;
  isInWatchlist: (id: string) => boolean;
}

const TRENDING_SEARCH_TERMS = [
  'Avatar',
  'Dune: Part Two',
  'Severance',
  'Shōgun',
  'Deadpool & Wolverine',
  'Arcane',
  'The Batman',
  'Gladiator II',
  'Breaking Bad',
  'Stranger Things',
  'Cyberpunk',
  'Interstellar'
];

const SEARCH_GENRES = [
  'All',
  'Action',
  'Adventure',
  'Animation',
  'Comedy',
  'Crime',
  'Drama',
  'Fantasy',
  'Horror',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Thriller'
];

export const SearchView: React.FC<SearchViewProps> = ({
  mediaCatalog,
  onPlay,
  onOpenDetails,
  onToggleWatchlist,
  isInWatchlist,
}) => {
  const [query, setQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'all' | 'movie' | 'series'>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');

  // Search API State
  const [results, setResults] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Request race-condition tracking
  const searchRequestIdRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const recommendedScrollRef = useRef<HTMLDivElement>(null);

  // Recent searches with persistence
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('crator_recent_searches');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      }
      return ['Avatar', 'Dune', 'Severance', 'Shōgun'];
    } catch {
      return ['Avatar', 'Dune', 'Severance', 'Shōgun'];
    }
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const saveRecentSearch = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const filtered = safePrev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 10);
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('crator_recent_searches', JSON.stringify(updated));
        }
      } catch {}
      return updated;
    });
  };

  const removeRecentSearch = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const updated = safePrev.filter((s) => s !== text);
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('crator_recent_searches', JSON.stringify(updated));
        }
      } catch {}
      return updated;
    });
  };

  const clearAllRecent = () => {
    setRecentSearches([]);
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('crator_recent_searches');
      }
    } catch {}
  };

  // Perform search (TMDB live with local catalogue fallback)
  const executeSearch = async (searchKeyword: string, targetPage: number = 1, append: boolean = false) => {
    const keyword = searchKeyword.trim();
    if (!keyword) {
      setResults([]);
      setIsLoading(false);
      setHasMore(false);
      return;
    }

    const currentRequestId = ++searchRequestIdRef.current;

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const tmdbRes = await searchTmdb(keyword, targetPage);
      if (currentRequestId !== searchRequestIdRef.current) return;

      if (tmdbRes.items && tmdbRes.items.length > 0) {
        setHasMore(tmdbRes.hasMore);
        setPage(targetPage);
        setResults((prev) => {
          if (append) {
            const existingIds = new Set(prev.map((i) => i.id));
            const newUnique = tmdbRes.items.filter((i) => !existingIds.has(i.id));
            return [...prev, ...newUnique];
          }
          return tmdbRes.items;
        });
      } else {
        // Fallback to local catalog
        const lower = keyword.toLowerCase();
        const localMatches = mediaCatalog.filter((item) =>
          item.title.toLowerCase().includes(lower) ||
          item.genres.some((g) => g.toLowerCase().includes(lower)) ||
          item.cast?.some((c) => c.name.toLowerCase().includes(lower))
        );
        setResults(localMatches);
        setHasMore(false);
      }
    } catch {
      if (currentRequestId !== searchRequestIdRef.current) return;
      const lower = keyword.toLowerCase();
      const localMatches = mediaCatalog.filter((item) =>
        item.title.toLowerCase().includes(lower) ||
        item.genres.some((g) => g.toLowerCase().includes(lower))
      );
      setResults(localMatches);
      setHasMore(false);
    } finally {
      if (currentRequestId === searchRequestIdRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  };

  // Live debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      executeSearch(query, 1, false);
      saveRecentSearch(query);
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      executeSearch(query, 1, false);
      saveRecentSearch(query);
    }
  };

  const handleTermClick = (term: string) => {
    setQuery(term);
    executeSearch(term, 1, false);
    saveRecentSearch(term);
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      executeSearch(query, page + 1, true);
    }
  };

  const scrollRecommended = (direction: 'left' | 'right') => {
    if (recommendedScrollRef.current) {
      const offset = direction === 'left' ? -380 : 380;
      recommendedScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Filter currently displayed results by Type and Genre
  const filteredResults = useMemo(() => {
    return results.filter((item) => {
      if (selectedType !== 'all') {
        const isTv = item.type === 'series' || item.type === 'anime' || (item.type as any) === 'tv';
        if (selectedType === 'movie' && isTv) return false;
        if (selectedType === 'series' && !isTv) return false;
      }
      if (selectedGenre !== 'All' && !item.genres.includes(selectedGenre)) return false;
      return true;
    });
  }, [results, selectedType, selectedGenre]);

  // Curated Featured Recommendation (e.g. Dune 2, Avatar, or Severance)
  const featuredRecommendation = useMemo(() => {
    return (
      mediaCatalog.find((m) => m.id === 'dune-2') ||
      mediaCatalog.find((m) => m.featuredInHero) ||
      mediaCatalog[0]
    );
  }, [mediaCatalog]);

  // Recommended carousel items
  const recommendedItems = useMemo(() => {
    return mediaCatalog.filter((m) => m.id !== featuredRecommendation?.id);
  }, [mediaCatalog, featuredRecommendation]);

  const isSearchActive = Boolean(query.trim());

  return (
    <div className="w-full min-h-screen py-8 px-[4.5vw] space-y-8 max-w-7xl mx-auto text-[#f3f0ea]">
      {/* =================================================================== */}
      {/* A. PAGE HEADER (7Movies visual hierarchy)                           */}
      {/* =================================================================== */}
      <div className="text-left space-y-1.5 pt-4">
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl md:text-5xl text-white tracking-tight uppercase">
          Search
        </h1>
        <p className="text-sm md:text-base text-[#beb9bc]">
          Discover movies, television shows and more.
        </p>
      </div>

      {/* =================================================================== */}
      {/* B. SEARCH INPUT                                                     */}
      {/* =================================================================== */}
      <form onSubmit={handleSearchSubmit} className="relative w-full text-left">
        <div className="relative flex items-center bg-[#111215] border border-white/12 hover:border-white/25 focus-within:border-white/45 focus-within:ring-1 focus-within:ring-white/20 rounded-2xl transition-all shadow-2xl">
          <Search className="w-5 h-5 text-[#8e8a91] absolute left-4 sm:left-5 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, TV shows, actors..."
            className="w-full bg-transparent pl-12 sm:pl-14 pr-24 py-4 sm:py-4.5 text-sm sm:text-base text-white placeholder-[#77737a] focus:outline-none"
          />

          <div className="absolute right-4 flex items-center gap-2">
            {isLoading && (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            )}
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  inputRef.current?.focus();
                }}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white hover:text-black text-[#beb9bc] flex items-center justify-center transition-colors cursor-pointer"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </form>

      {/* =================================================================== */}
      {/* C. CONTENT FILTERS (Compact segmented controls)                     */}
      {/* =================================================================== */}
      <div className="space-y-3 pt-1 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Type Segmented Pill */}
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[#111215] border border-white/10 shrink-0 self-start">
            {[
              { id: 'all', label: 'All' },
              { id: 'movie', label: 'Movies' },
              { id: 'series', label: 'TV Shows' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedType(t.id as any)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedType === t.id
                    ? 'bg-white text-black shadow-md'
                    : 'text-[#beb9bc] hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Result Count / Status indicator */}
          {isSearchActive && (
            <span className="text-xs font-mono text-[#8e8a91]">
              {isLoading ? 'Searching TMDB...' : `${filteredResults.length} title${filteredResults.length === 1 ? '' : 's'} found`}
            </span>
          )}
        </div>

        {/* Horizontally Scrollable Genre Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {SEARCH_GENRES.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => setSelectedGenre(genre)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 whitespace-nowrap transition-all cursor-pointer ${
                selectedGenre === genre
                  ? 'bg-[#f3f0ea] text-black font-semibold'
                  : 'bg-[#111215] text-[#beb9bc] hover:text-white border border-white/10 hover:border-white/20'
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* =================================================================== */}
      {/* DEFAULT DISCOVERY SECTIONS (Only shown when no search query is active)*/}
      {/* =================================================================== */}
      {!isSearchActive && (
        <div className="space-y-10 pt-2 text-left animate-fadeIn">
          {/* D. Recent searches & E. Trending searches in clean compact layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* D. Recent Searches */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-mono tracking-wider text-[#8e8a91] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Recent searches
                </span>
                {recentSearches.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAllRecent}
                    className="text-[11px] font-mono text-[#77737a] hover:text-[#beb9bc] transition-colors cursor-pointer"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {recentSearches.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => handleTermClick(term)}
                      className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111215] hover:bg-white hover:text-black text-xs text-[#beb9bc] border border-white/10 hover:border-white transition-all cursor-pointer"
                    >
                      <span>{term}</span>
                      <span
                        onClick={(e) => removeRecentSearch(term, e)}
                        className="p-0.5 rounded-full hover:bg-black/20 text-[#8e8a91] group-hover:text-black transition-colors"
                        title="Remove"
                      >
                        <X className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#77737a] font-mono py-2">
                  No recent searches. Search above to find titles.
                </p>
              )}
            </div>

            {/* E. Trending searches */}
            <div className="space-y-2.5">
              <span className="text-xs uppercase font-mono tracking-wider text-[#8e8a91] flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Trending searches
              </span>

              <div className="flex flex-wrap gap-2">
                {TRENDING_SEARCH_TERMS.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleTermClick(term)}
                    className="px-3 py-1.5 rounded-full bg-[#111215] hover:bg-white hover:text-black text-xs text-[#beb9bc] border border-white/10 hover:border-white transition-all cursor-pointer"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* F. RECOMMENDED TO BROWSE (Cinematic Card + Horizontal Carousel)     */}
          {/* ================================================================= */}
          <div className="space-y-6 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display font-bold text-xl md:text-2xl text-white">
                  Recommended to Browse
                </h2>
                <p className="text-xs text-[#8e8a91] font-mono">
                  Curated premium cinema and masterworks
                </p>
              </div>
            </div>

            {/* Cinematic Featured Recommendation Card */}
            {featuredRecommendation && (
              <div 
                className="relative w-full h-[320px] sm:h-[380px] md:h-[420px] rounded-2xl overflow-hidden border border-white/12 shadow-2xl group cursor-pointer"
                onClick={() => onOpenDetails(featuredRecommendation)}
              >
                {/* Backdrop Image */}
                <div className="absolute inset-0">
                  <ImageWithFallback
                    src={featuredRecommendation.backdropUrl || featuredRecommendation.posterUrl}
                    alt={featuredRecommendation.title}
                    fallbackTitle={featuredRecommendation.title}
                    containerClassName="w-full h-full"
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  />
                </div>

                {/* 7Movies Gradients */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-transparent hidden sm:block" />

                {/* Content Overlay */}
                <div className="absolute bottom-6 left-6 sm:bottom-8 sm:left-8 right-6 max-w-2xl space-y-3 z-10">
                  <div className="flex items-center gap-2 text-xs text-[#beb9bc]">
                    <span className="flex items-center gap-1 text-amber-300 font-bold font-mono">
                      <Star className="w-3.5 h-3.5 fill-amber-300" />
                      {(typeof featuredRecommendation.rating === 'number' ? featuredRecommendation.rating : 8.8).toFixed(1)}
                    </span>
                    <span className="text-white/30">·</span>
                    <span>{featuredRecommendation.releaseYear}</span>
                    <span className="text-white/30">·</span>
                    <span>{featuredRecommendation.genres.slice(0, 2).join(' / ')}</span>
                    <span className="text-white/30">·</span>
                    <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-black/60 border border-white/20">
                      {featuredRecommendation.quality || '4K Ultra HD'}
                    </span>
                  </div>

                  <h3 className="font-display font-extrabold text-2xl sm:text-3xl md:text-4xl text-white tracking-tight leading-tight">
                    {featuredRecommendation.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#beb9bc] line-clamp-2 max-w-xl leading-relaxed">
                    {featuredRecommendation.synopsis}
                  </p>

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlay(featuredRecommendation);
                      }}
                      className="h-10 px-5 rounded-full bg-[#f3f0ea] hover:bg-white text-black font-semibold text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
                      <span>Watch Now</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetails(featuredRecommendation);
                      }}
                      className="h-10 px-4 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>More info</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Horizontal Carousel of Recommended Movie Posters */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-mono tracking-wider text-[#8e8a91]">
                  Popular in cinema & streaming
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => scrollRecommended('left')}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-white border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollRecommended('right')}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-white border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div
                ref={recommendedScrollRef}
                className="flex items-stretch gap-4 overflow-x-auto no-scrollbar py-2"
              >
                {recommendedItems.map((item) => (
                  <div key={item.id} className="w-36 sm:w-44 md:w-48 shrink-0">
                    <MediaCard
                      item={item}
                      onPlay={onPlay}
                      onOpenDetails={onOpenDetails}
                      onToggleWatchlist={onToggleWatchlist}
                      isInWatchlist={isInWatchlist(item.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* G. SEARCH RESULTS POSTER GRID                                       */}
      {/* =================================================================== */}
      {isSearchActive && (
        <div className="space-y-6 pt-2 text-left">
          {/* Loading Skeletons */}
          {isLoading && results.length === 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex flex-col space-y-2 animate-pulse">
                  <div className="aspect-[2/3] rounded-xl bg-[#111215] border border-white/10" />
                  <div className="h-3.5 bg-white/10 rounded w-3/4" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                </div>
              ))}
            </div>
          )}

          {/* Results Grid */}
          {filteredResults.length > 0 ? (
            <div className="space-y-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-5">
                {filteredResults.map((item) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    onPlay={onPlay}
                    onOpenDetails={onOpenDetails}
                    onToggleWatchlist={onToggleWatchlist}
                    isInWatchlist={isInWatchlist(item.id)}
                  />
                ))}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="h-11 px-8 rounded-full bg-white/10 hover:bg-white hover:text-black text-white border border-white/20 font-semibold text-xs transition-all disabled:opacity-40 cursor-pointer"
                  >
                    {isLoadingMore ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Loading more titles...</span>
                      </span>
                    ) : (
                      <span>Load More Titles</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* No Results Empty State */
            !isLoading && (
              <div className="py-24 text-center bg-[#111215] rounded-2xl border border-white/10 max-w-lg mx-auto space-y-4">
                <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-[#8e8a91]">
                  <Search className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display font-bold text-lg text-white">
                    No results found for "{query}"
                  </h3>
                  <p className="text-xs text-[#8e8a91] max-w-xs mx-auto leading-relaxed">
                    Check your spelling, or try searching with different keywords, actor names, or genres.
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setSelectedGenre('All');
                      setSelectedType('all');
                      inputRef.current?.focus();
                    }}
                    className="h-9 px-5 text-xs font-semibold rounded-full bg-white text-black hover:bg-[#f3f0ea] transition-colors cursor-pointer"
                  >
                    Clear Search
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};
