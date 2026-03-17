import { Heart, MessageCircle, Share2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Game } from '../../store/feedStore';

interface SocialBarProps {
  game: Game;
  onLikeToggle: () => void;
  onCommentClick: () => void;
  onShareClick: () => void;
}

export function SocialBar({ game, onLikeToggle, onCommentClick, onShareClick }: SocialBarProps) {
  return (
    <div className="absolute right-4 bottom-24 flex flex-col items-center gap-6 z-10">
      
      <div className="relative group mb-2">
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/80 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
           <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${game.uploader_username}`} className="w-full h-full bg-surface" alt="avatar" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={onLikeToggle}>
        <div className="bg-black/40 p-3 rounded-full backdrop-blur-md group-hover:bg-black/60 transition-all shadow-lg active:scale-90">
          <Heart 
            className={cn("w-7 h-7 transition-colors", game.isLikedByMe ? "fill-red-500 text-red-500" : "text-white")} 
          />
        </div>
        <span className="text-white text-xs font-semibold drop-shadow-md">{game.like_count || 0}</span>
      </div>

      <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={onCommentClick}>
        <div className="bg-black/40 p-3 rounded-full backdrop-blur-md group-hover:bg-black/60 transition-all shadow-lg active:scale-90">
          <MessageCircle className="w-7 h-7 text-white" />
        </div>
        <span className="text-white text-xs font-semibold drop-shadow-md">{game.comment_count || 0}</span>
      </div>

      <div className="flex flex-col items-center gap-1 cursor-pointer group" onClick={onShareClick}>
        <div className="bg-black/40 p-3 rounded-full backdrop-blur-md group-hover:bg-black/60 transition-all shadow-lg active:scale-90">
          <Share2 className="w-7 h-7 text-white" />
        </div>
        <span className="text-white text-xs font-semibold drop-shadow-md">Share</span>
      </div>
    </div>
  );
}
