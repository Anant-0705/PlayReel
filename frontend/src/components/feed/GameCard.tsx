import { useEffect, useState, useCallback, useRef } from 'react';
import type { Game } from '../../store/feedStore';
import { useIntersection } from '../../hooks/useIntersection';
import { SocialBar } from './SocialBar';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

interface GameCardProps {
  game: Game;
  onCommentClick: () => void;
  onShareClick: () => void;
  standalone?: boolean;
}

export function GameCard({ game, onCommentClick, onShareClick, standalone }: GameCardProps) {
  // 60% intersection threshold. When mostly visible, we boot the game.
  const { ref, isIntersecting } = useIntersection<HTMLDivElement>(0.6);
  const token = useAuthStore(state => state.token);
  const [localLiked, setLocalLiked] = useState(!!game.isLikedByMe);
  const [playStarted, setPlayStarted] = useState(false);
  const [gameUrl, setGameUrl] = useState<string | null>(null);
  const [interacting, setInteracting] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fetch the manifest.json to get the real indexUrl (entry point varies per ZIP structure)
  useEffect(() => {
    if (!game.manifest_url) return;
    let cancelled = false;
    api.get(game.manifest_url).then((res) => {
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
    if (standalone) {
      setPlayStarted(true);
      setInteracting(true);
      return;
    }
    if (isIntersecting) {
      setPlayStarted(true);
    } else {
      setPlayStarted(false);
      setInteracting(false); // Reset overlay when scrolled away
    }
  }, [isIntersecting, standalone]);

  const handleLikeToggle = async () => {
    if (!token) {
       alert("Please login to like games");
       return;
    }
    const intent = !localLiked;
    setLocalLiked(intent);
    
    try {
      if (intent) {
        await api.post(`/social/like/${game.id}`);
      } else {
        await api.delete(`/social/unlike/${game.id}`);
      }
    } catch (err) {
      setLocalLiked(!intent); // Revert on failure
    }
  };

  const handleOverlayClick = useCallback(() => {
    setInteracting(true);
    // Explicitly focus the iframe so keyboard events (like Arrow keys) go to the game
    setTimeout(() => {
      if (iframeRef.current) {
        iframeRef.current.focus();
        iframeRef.current.contentWindow?.focus();
      }
    }, 50);
  }, []);

  // Autofocus when standalone mounts
  useEffect(() => {
    if (standalone && playStarted) {
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.focus();
          iframeRef.current.contentWindow?.focus();
        }
      }, 300);
    }
  }, [standalone, playStarted]);

  // Prevent arrow keys from scrolling the main feed when the user is playing the game.
  // This acts as a fallback case if focus leaks out of the iframe but interacting is still true.
  useEffect(() => {
    if (!interacting) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow interacting with inputs like the comment box
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
        return;
      }
      
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [interacting]);

  return (
    <div ref={ref} className="w-full h-full snap-start relative bg-[#060a14] flex items-center justify-center overflow-hidden border-b border-white/5">
      
      {/* Main Full-Screen Game Container */}
      <div className="relative w-full h-full flex flex-col items-center justify-center">
        {playStarted && gameUrl ? (
          <>
            <iframe 
              ref={iframeRef}
              src={gameUrl} 
              className="w-full h-full border-none z-0"
              sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-forms"
              title={game.title}
            />
            {/* Scroll-capture overlay */}
            {!standalone && !interacting && (
              <div 
                onClick={handleOverlayClick}
                className="absolute inset-0 z-10 cursor-pointer bg-black/10 flex items-center justify-center"
                style={{ touchAction: 'pan-y' }}
              >
                <div className="flex flex-col items-center gap-2 pointer-events-none animate-pulse">
                  <div className="px-5 py-2.5 bg-black/80 backdrop-blur-md rounded-full border border-white/20 text-white font-bold text-sm shadow-xl drop-shadow-2xl mt-32">
                    Tap to play · Scroll for next
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <img src={game.thumbnail_url} alt={game.title} className="w-full h-full object-cover opacity-30 saturate-50 blur-3xl scale-110 absolute inset-0" />
            <img src={game.thumbnail_url} alt={game.title} className="w-full h-full object-contain drop-shadow-2xl z-0 relative" />
            
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-10 cursor-pointer">
               <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center mb-4 shadow-2xl transition-transform hover:scale-110">
                 <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-white border-b-[12px] border-b-transparent ml-2 shadow-lg w-full"></div>
               </div>
               <p className="text-white font-bold tracking-wide text-lg drop-shadow-md">Scroll to Play</p>
            </div>
          </>
        )}
      </div>

      {/* Info Overlay (Bottom Left) */}
      {!standalone && (
        <div className="absolute bottom-[6.5rem] left-5 z-20 max-w-[calc(100%-5rem)] pointer-events-none pb-2">
          <h2 className="text-white text-2xl font-bold mb-1.5 drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">{game.title}</h2>
          <p className="text-white/90 text-[13px] line-clamp-2 drop-shadow-[0_1px_4px_rgba(0,0,0,1)] mb-3 leading-snug">{game.description}</p>
          <div className="flex gap-2">
             <span className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-bold text-white uppercase tracking-wider shadow-lg">{game.genre}</span>
          </div>
        </div>
      )}

      {/* Interaction Overlay (Bottom Right) */}
      {!standalone && (
        <SocialBar 
          game={{ ...game, isLikedByMe: localLiked }} 
          onLikeToggle={handleLikeToggle}
          onCommentClick={onCommentClick}
          onShareClick={onShareClick}
        />
      )}
      
      {/* Vignette Shadows for text readability */}
      <div className="absolute bottom-0 w-full h-[35%] bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />
      <div className="absolute top-0 w-full h-[15%] bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />
    </div>
  );
}
