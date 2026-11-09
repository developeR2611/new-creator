import React, { useEffect, useState } from 'react';
import { X, Film, AlertCircle } from 'lucide-react';
import { TmdbVideo } from '../types';
import { extractBestTrailer } from '../services/tmdb';

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

  // Always determine and pick ONLY the first official trailer
  useEffect(() => {
    if (!isOpen) return;

    if (initialVideoKey) {
      setSelectedKey(initialVideoKey);
    } else if (videos && videos.length > 0) {
      const best = extractBestTrailer(videos);
      setSelectedKey(best ? best.key : videos[0].key);
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
                    Official Trailer
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#8e8a91] font-mono truncate">
                {currentVideo?.name || 'Official TMDB YouTube Trailer'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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

        {/* Video Player Area: 16:9 Full Responsive Embed (No sandbox to avoid YouTube player blocks) */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          {hasValidVideo ? (
            <iframe
              key={selectedKey}
              src={`https://www.youtube.com/embed/${selectedKey}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
              title={`${title} Official Trailer`}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
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
