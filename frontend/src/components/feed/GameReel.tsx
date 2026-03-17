import { useEffect, useRef, useState } from 'react';
import { useFeedStore } from '../../store/feedStore';
import { GameCard } from './GameCard';
import { CommentSheet } from './CommentSheet';
import axios from 'axios';
import { useAuthStore } from '../../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:80';

export function GameReel() {
  const { games, nextCursor, isLoading, hasMore, appendGames, setLoading } = useFeedStore();
  const token = useAuthStore(state => state.token);
  const containerRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);

  const [activeCommentGameId, setActiveCommentGameId] = useState<string | null>(null);

  // Initialize Worker for background caching
  useEffect(() => {
    workerRef.current = new Worker('/game.worker.js');
    return () => workerRef.current?.terminate();
  }, []);

  // Fetch initial batch
  useEffect(() => {
    if (games.length === 0) fetchNextBatch(null);
  }, []);

  const fetchNextBatch = async (cursor: string | null) => {
    if (isLoading || (!hasMore && cursor !== null)) return;
    setLoading(true);
    try {
      const endpoint = cursor ? `/feed?cursor=${cursor}` : '/feed';
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_URL}${endpoint}`, { headers });
      
      const newGames = res.data.data.games;
      const newCursor = res.data.data.nextCursor;
      
      appendGames(newGames, newCursor);

      // Tell worker to pre-fetch the URLs for these new games (index.html + wasm)
      if (workerRef.current && newGames.length > 0) {
        const urlsToCache = newGames.flatMap((g: any) => {
           if (!g.manifest_url) return [];
           const baseUrl = g.manifest_url.replace('manifest.json', '');
           return [
             `${baseUrl}index.html`,
             g.wasm_url
           ].filter(Boolean);
        });
        workerRef.current.postMessage({ type: 'PRELOAD', urls: urlsToCache });
      }

    } catch (err) {
      console.error('Feed fetch failed', err);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget;
    // If we are within 2 viewports from the bottom, fetch more
    if (scrollHeight - scrollTop <= clientHeight * 2.5) {
       fetchNextBatch(nextCursor);
    }
  };

  if (games.length === 0 && isLoading) {
    return <div className="w-full h-[100dvh] flex flex-col items-center justify-center bg-background">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin-slow"></div>
      </div>
      <div className="mt-6 text-gray-400 font-medium animate-pulse tracking-widest text-sm uppercase">Loading Feed</div>
    </div>;
  }

  return (
    <div 
      ref={containerRef}
      onScroll={handleScroll}
      className="w-full h-[100dvh] overflow-y-scroll snap-y-mandatory no-scrollbar bg-black relative"
    >
      {games.length === 0 && !isLoading && (
        <div className="w-full h-[100dvh] flex flex-col flex-1 items-center justify-center bg-background text-gray-400">
           <h2>No games found. Check back later!</h2>
        </div>
      )}

      {games.map(game => (
        <GameCard 
          key={game.id} 
          game={game} 
          onCommentClick={() => setActiveCommentGameId(game.id)}
          onShareClick={() => navigator.clipboard.writeText(`${window.location.origin}/game/${game.id}`)}
        />
      ))}

      {activeCommentGameId && (
        <CommentSheet 
          gameId={activeCommentGameId} 
          isOpen={true} 
          onClose={() => setActiveCommentGameId(null)} 
        />
      )}
    </div>
  );
}
