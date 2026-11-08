import React, { useEffect, useState } from 'react';
import { X, Film, AlertCircle, Play, ChevronDown, Check } from 'lucide-react';
import { TmdbVideo } from '../types';

interface TrailerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  videos: TmdbVideo[];
  initialVideoKey?: string;
}

export const TrailerModal: React.FC<TrailerModalProps> = ({
  isOpen,
  onClose,
  title,
  videos,
  initialVideoKey,
}) => {
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [showSelector, setShowSelector] = useState<boolean>(false);

  // Sync selected video key when modal opens or videos change
  useEffect(() => {
    if (!isOpen) return;

    if (initialVideoKey) {
      setSelectedKey(initialVideoKey);
    } else if (videos && videos.length > 0) {
      const best = videos.find((v) => v.key) || videos[0];
      setSelectedKey(best.key);
    } else {
      setSelectedKey('');
    }
  }, [isOpen, initialVideoKey, videos]);

  // Lock background scroll when open & handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentVideo = videos.find((v) => v.key === selectedKey) || videos[0];
  const hasValidVideo = Boolean(selectedKey);

  // Filter YouTube videos for the switcher
  const availableVideos = videos.filter((v) => v.site === 'YouTube' && v.key);

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 md:p-10 select-none animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${title} Official Trailer`}
    >
      <div
        className="relative w-full max-w-5xl bg-[#0a0a0c] border border-white/12 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/10 bg-[#101114]">
          <div className="flex items-center gap-3 overflow-hidden min-w-0 pr-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center shrink-0">
              <Film className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-sm sm:text-base text-white truncate">
                  {title}
                </h3>
                {currentVideo && (
                  <span className="hidden sm:inline-flex text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/10 text-[#beb9bc] shrink-0 border border-white/10">
                    {currentVideo.type || 'Trailer'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8e8a91] font-mono truncate">
                {currentVideo?.name || 'Official TMDB YouTube Trailer'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Multi-Trailer Switcher Dropdown */}
            {availableVideos.length > 1 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSelector(!showSelector)}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-[#beb9bc] hover:text-white border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Switch trailer version"
                >
                  <span className="hidden md:inline">Trailers</span>
                  <span className="font-mono text-[11px]">({availableVideos.length})</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#8e8a91]" />
                </button>

                {showSelector && (
                  <div className="absolute right-0 top-full mt-2 w-64 max-h-60 overflow-y-auto bg-[#141518] border border-white/15 rounded-xl shadow-2xl p-1 z-30 space-y-0.5">
                    {availableVideos.map((v) => (
                      <button
                        key={v.id || v.key}
                        type="button"
                        onClick={() => {
                          setSelectedKey(v.key);
                          setShowSelector(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          selectedKey === v.key
                            ? 'bg-white text-black font-semibold'
                            : 'text-[#beb9bc] hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="truncate">{v.name}</p>
                          <span className={`text-[10px] font-mono ${selectedKey === v.key ? 'text-black/70' : 'text-[#77737a]'}`}>
                            {v.type}
                          </span>
                        </div>
                        {selectedKey === v.key && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white hover:text-black text-white/80 border border-white/10 flex items-center justify-center transition-colors cursor-pointer"
              title="Close trailer (Esc)"
              aria-label="Close trailer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Player Area: 16:9 Full Responsive Embed */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          {hasValidVideo ? (
            <iframe
              key={selectedKey}
              src={`https://www.youtube.com/embed/${selectedKey}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
              title={`${title} Trailer`}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              sandbox="allow-scripts allow-same-origin allow-presentation"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#8e8a91]">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-display font-bold text-base text-white">
                  No trailer available
                </h4>
                <p className="text-xs text-[#8e8a91] max-w-sm">
                  An official YouTube trailer is not available on The Movie Database for this title yet.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
