import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { DirectoryGrid } from '../components/search/DirectoryGrid';
import { GameCard } from '../components/feed/GameCard';
import { Search, X, Loader2 } from 'lucide-react';

// This interface matches our Elasticsearch document payload returned by /api/search
export interface SearchGame {
  id: string;
  title: string;
  description: string;
  genre: string;
  format: any;
  uploader_username: string;
  thumbnail_url: string;
  banner_url: string | null;
  manifest_url: string;
  play_count: number;
  like_count: number;
  created_at: string;
}

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [games, setGames] = useState<SearchGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeGame, setActiveGame] = useState<any>(null);
  const token = useAuthStore(state => state.token);

  const GENRES = [
    'All', 'Action', 'Puzzle', 'Platformer', 'RPG', 
    'Shooter', 'Strategy', 'Sports', 'Horror', 'Simulation', 'Other'
  ];

  useEffect(() => {
    const fetchGames = async () => {
      setIsLoading(true);
      try {
        const params: any = { q: query };
        if (selectedGenre && selectedGenre !== 'All') {
          params.genre = selectedGenre.toLowerCase();
        }

        const res = await api.get(`/search`, {
          params,
          // token is automatically injected by api interceptor
        });
        setGames(res.data.data.games || []);
      } catch (err) {
        console.error('Search failed', err);
      } finally {
        setIsLoading(false);
      }
    };

    const timeout = setTimeout(fetchGames, query ? 300 : 0);
    return () => clearTimeout(timeout);
  }, [query, selectedGenre, token]);

  const handleGameClick = (g: SearchGame) => {
    // Map SearchGame properties to what GameCard expects
    setActiveGame({
      id: g.id,
      title: g.title,
      description: g.description,
      genre: g.genre,
      format: g.format || 'wasm',
      thumbnail_url: g.thumbnail_url,
      manifest_url: g.manifest_url,
      uploader_username: g.uploader_username,
      play_count: g.play_count,
      like_count: g.like_count,
      comment_count: 0,
      isLikedByMe: false, // Could fetch this or leave false
    });
  };

  return (
    <div className="w-full min-h-[100dvh] bg-background pb-32 pt-8 font-sans">
      
      {/* Sticky Search Header */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-white/5 pb-3">
        <div className="px-4 pt-4 pb-3">
          <label className="text-white text-2xl font-extrabold tracking-tight block mb-4">Discover</label>
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search games, genres, creators..."
              className="w-full bg-surface/50 border border-white/10 rounded-max py-3.5 pl-12 pr-4 text-white font-medium focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner placeholder:text-gray-500 rounded-2xl"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            {isLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary animate-spin" />}
          </div>
        </div>

        {/* Genre Filters Scroll Row */}
        <div className="px-4 overflow-x-auto no-scrollbar flex items-center gap-2 pb-1">
          {GENRES.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(g)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                (selectedGenre === g || (!selectedGenre && g === 'All'))
                  ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105'
                  : 'bg-surface/50 text-gray-400 hover:text-white hover:bg-surface border border-white/5'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Results / Grid */}
      <div className="mt-6 flex flex-col gap-6">
        {games.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center mt-20 opacity-50">
            <Search className="w-16 h-16 mb-4 text-gray-600" />
            <p className="text-gray-400 font-medium pb-2 text-center">
              No games found <br/>
              <span className="text-xs">{query ? `for "${query}"` : 'in this category'}</span>
            </p>
          </div>
        )}

        <DirectoryGrid games={games} onGameClick={handleGameClick} />
      </div>

      {/* Full Screen Playback Modal */}
      {activeGame && (
        <div className="fixed inset-0 z-[100] bg-black animate-slide-up flex flex-col">
          {/* Close button layered ON TOP of GameCard */}
          <button 
            onClick={() => setActiveGame(null)}
            className="absolute top-6 left-4 z-50 p-2.5 bg-black/40 backdrop-blur-lg rounded-full border border-white/10 shadow-xl hover:bg-black/60 transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          
          <div className="flex-1 w-full relative">
            <GameCard 
              game={activeGame} 
              standalone={true}
              onCommentClick={() => console.log('Comments coming soon to search view')}
              onShareClick={() => navigator.clipboard.writeText(`${window.location.origin}`)}
            />
          </div>
        </div>
      )}
      
    </div>
  );
}
