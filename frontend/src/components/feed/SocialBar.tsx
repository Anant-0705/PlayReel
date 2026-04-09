import { Heart, MessageCircle, Share2, Plus } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import type { Game } from '../../store/feedStore';

interface SocialBarProps {
  game: Game;
  onLikeToggle: () => void;
  onCommentClick: () => void;
  onShareClick: () => void;
}

export function SocialBar({ game, onLikeToggle, onCommentClick, onShareClick }: SocialBarProps) {
  const { user } = useAuthStore();
  const [isFollowing, setIsFollowing] = useState(false);

  const handleFollow = async () => {
    if (!user) {
      alert("Please login to follow creators");
      return;
    }
    if (game.uploader_id === user.id) return; // Can't follow self

    try {
      await api.post(`/users/follow/${game.uploader_id}`);
      setIsFollowing(true);
    } catch (err) {
      console.error('Failed to follow', err);
    }
  };

  const showFollow = user?.id !== game.uploader_id && !isFollowing;

  return (
    <div className="absolute right-3.5 bottom-[7rem] flex flex-col items-center gap-5 z-20">
      
      <div className="relative group mb-2 cursor-pointer transition-transform hover:scale-105" onClick={handleFollow}>
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/80 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
           <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${game.uploader_username}`} className="w-full h-full bg-surface" alt="avatar" />
        </div>
        {showFollow && (
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-primary rounded-full p-0.5 border border-white shadow-lg z-10 transition-transform active:scale-95">
            <Plus className="w-3.5 h-3.5 text-white" strokeWidth={3} />
          </div>
        )}
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
