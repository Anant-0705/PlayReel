import { useEffect } from 'react';
import { GameReel } from '../components/feed/GameReel';
import { useSocketStore } from '../store/socketStore';
import { useAuthStore } from '../store/authStore';

export function FeedPage() {
  const connectSocket = useSocketStore(state => state.connect);
  const disconnectSocket = useSocketStore(state => state.disconnect);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  useEffect(() => {
    // Only connect WebSocket if logged in (token required for auth)
    if (isAuthenticated) {
      connectSocket();
    }
    return () => disconnectSocket();
  }, [isAuthenticated]);

  return (
    <div className="w-full h-screen bg-black overflow-hidden relative">
      <GameReel />
      
      {/* Top Gradient for status bar readability on mobile */}
      <div className="absolute top-0 w-full h-24 bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-10" />
      
      {/* "Following | For You" TikTok style header */}
      <div className="absolute top-6 w-full flex justify-center gap-6 z-20 pointer-events-auto">
        <button className="text-white/60 font-semibold text-lg drop-shadow-md hover:text-white transition-colors">Following</button>
        <div className="w-[2px] h-6 bg-white/20 my-auto rounded-full" />
        <button className="text-white font-bold text-lg drop-shadow-md border-b-2 border-white pb-1">For You</button>
      </div>
    </div>
  );
}
