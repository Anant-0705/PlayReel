import { useEffect, useState, useCallback } from 'react';
import type { Game } from '../../store/feedStore';
import { useIntersection } from '../../hooks/useIntersection';
import { SocialBar } from './SocialBar';
import axios from 'axios';
import { useAuthStore } from '../../store/authStore';

interface GameCardProps {
  game: Game;
  onCommentClick: () => void;
  onShareClick: () => void;
}

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:80').replace(/\/+$/, '');
const API_ROOT = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

export function GameCard({ game, onCommentClick, onShareClick }: GameCardProps) {
  // 60% intersection threshold. When mostly visible, we boot the game.
  const { ref, isIntersecting } = useIntersection<HTMLDivElement>(0.6);
  const token = useAuthStore(state => state.token);
  const [localLiked, setLocalLiked] = useState(!!game.isLikedByMe);
  const [playStarted, setPlayStarted] = useState(false);
  const [gameUrl, setGameUrl] = useState<string | null>(null);
  const [interacting, setInteracting] = useState(false);

  // Fetch the manifest.json to get the real indexUrl (entry point varies per ZIP structure)
  useEffect(() => {
    if (!game.manifest_url) return;
    let cancelled = false;
    axios.get(game.manifest_url).then((res) => {
      if (!cancelled && res.data?.indexUrl) {
        // Fix any old localhost:9000 references in the manifest
        const url = (res.data.indexUrl as string).replace('http://localhost:9000', 'http://localhost');
        setGameUrl(url);
      }
    }).catch(() => {
      // Fallback: try the naive approach
      if (!cancelled) {
        setGameUrl(game.manifest_url!.replace('manifest.json', 'index.html'));
      }
    });
    return () => { cancelled = true; };
  }, [game.manifest_url]);

  useEffect(() => {
    if (isIntersecting) {
      setPlayStarted(true);
    } else {
      setPlayStarted(false);
      setInteracting(false); // Reset overlay when scrolled away
    }
  }, [isIntersecting]);

  const handleLikeToggle = async () => {
    if (!token) {
       alert("Please login to like games");
       return;
    }
    const intent = !localLiked;
    setLocalLiked(intent);
    
    try {
      if (intent) {
        await axios.post(`${API_ROOT}/social/like/${game.id}`, {}, { headers: { Authorization: `Bearer ${token}` }});
      } else {
        await axios.delete(`${API_ROOT}/social/unlike/${game.id}`, { headers: { Authorization: `Bearer ${token}` }});
      }
    } catch (err) {
      setLocalLiked(!intent); // Revert on failure
    }
  };

  const handleOverlayClick = useCallback(() => {
    setInteracting(true);
  }, []);

  return (
    <div ref={ref} className="w-full h-full snap-start relative bg-[#0a0f1c] flex items-center justify-center overflow-hidden border-b border-white/5">
      
      {/* Game Rendering Layer */}
      {playStarted && gameUrl ? (
        <>
          <iframe 
            src={gameUrl} 
            className="w-full h-full border-none z-0"
            sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms"
            title={game.title}
          />
          {/* Scroll-capture overlay: allows parent scroll, tap to interact with game */}
          {!interacting && (
            <div 
              onClick={handleOverlayClick}
              className="absolute inset-0 z-[1] cursor-pointer"
              style={{ touchAction: 'pan-y' }}
            >
              <div className="absolute bottom-[45%] left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none animate-pulse">
                <div className="px-4 py-2 bg-black/60 backdrop-blur-sm rounded-full border border-white/20 text-white/90 text-sm font-medium shadow-lg">
                  Tap to play · Scroll for next
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-full relative">
          <img src={game.thumbnail_url} alt={game.title} className="w-full h-full object-cover opacity-30 saturate-50 blur-sm scale-110" />
          <img src={game.thumbnail_url} alt={game.title} className="absolute inset-0 w-full h-full object-contain drop-shadow-2xl" />
          
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
             <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center mb-4 shadow-2xl transition-transform hover:scale-105">
               <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-2 shadow-lg"></div>
             </div>
             <p className="text-white/80 font-medium tracking-wide">Scroll to Play</p>
          </div>
        </div>
      )}

      {/* Info Overlay (Bottom Left) */}
      <div className="absolute bottom-6 left-5 z-10 max-w-[70%]">
        <h2 className="text-white text-2xl font-bold mb-1.5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">{game.title}</h2>
        <p className="text-white/90 text-sm line-clamp-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] mb-3 leading-snug">{game.description}</p>
        <div className="flex gap-2">
           <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-xs font-semibold text-white uppercase tracking-wider shadow-lg">{game.genre}</span>
        </div>
      </div>

      {/* Interaction Overlay (Bottom Right) */}
      <SocialBar 
        game={{ ...game, isLikedByMe: localLiked }} 
        onLikeToggle={handleLikeToggle}
        onCommentClick={onCommentClick}
        onShareClick={onShareClick}
      />
      
      {/* Vignette Shadows for text readability */}
      <div className="absolute bottom-0 w-full h-[35%] bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />
      <div className="absolute top-0 w-full h-[15%] bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
    </div>
  );
}
