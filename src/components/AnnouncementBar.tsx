import React, { useState } from 'react';
import { Sparkles, X, ChevronRight, Zap } from 'lucide-react';

interface AnnouncementBarProps {
  onJoinCommunity?: () => void;
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ onJoinCommunity }) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="relative w-full bg-[#0d0e12] border-b border-white/10 text-xs px-4 py-2 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 truncate">
          <span className="flex items-center gap-1 font-semibold text-white bg-white/10 px-2 py-0.5 rounded-md border border-white/15 shrink-0 font-mono text-[11px]">
            <Zap className="w-3 h-3 text-amber-300 fill-amber-300" />
            CRATOR 4K
          </span>
          <p className="text-[#beb9bc] truncate font-medium">
            Dolby Vision & Spatial Audio active across all 4K HDR streams · 100% Ad-Free experience.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {onJoinCommunity && (
            <button
              onClick={onJoinCommunity}
              className="hidden sm:flex items-center gap-1 text-white hover:text-white/80 font-medium hover:underline cursor-pointer"
            >
              <span>Join Telegram</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          )}

          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-md text-[#8e8a91] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Dismiss banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
