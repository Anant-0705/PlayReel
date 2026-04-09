import { Play } from 'lucide-react';
import type { SearchGame } from '../../pages/SearchPage';

interface DirectoryGridProps {
  games: SearchGame[];
  onGameClick: (game: SearchGame) => void;
}

export function DirectoryGrid({ games, onGameClick }: DirectoryGridProps) {
  if (games.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-4 pb-8">
      {games.map((game) => {
        const imageUrl = game.banner_url || game.thumbnail_url;

        return (
          <div
            key={game.id}
            onClick={() => onGameClick(game)}
            className="flex flex-col group cursor-pointer"
          >
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-surface border border-white/5 shadow-md group-hover:shadow-primary/20 group-hover:border-primary/50 transition-all">
              <img 
                src={imageUrl} 
                alt={game.title} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors pointer-events-none" />
              <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded border border-white/10 flex items-center gap-1">
                <Play className="w-3 h-3 text-white" />
                <span className="text-white text-[10px] font-bold">{game.play_count || 0}</span>
              </div>
            </div>
            
            <div className="mt-2.5 px-1">
              <h3 className="text-white font-bold text-sm truncate leading-tight group-hover:text-primary transition-colors">{game.title}</h3>
              <p className="text-gray-400 text-xs truncate mt-1">by <span className="text-gray-300 font-medium">{game.uploader_username}</span></p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
