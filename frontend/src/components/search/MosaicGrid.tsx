import { useMemo } from 'react';
import { Play } from 'lucide-react';
import type { SearchGame } from '../../pages/SearchPage';

interface MosaicGridProps {
  games: SearchGame[];
  onGameClick: (game: SearchGame) => void;
}

export function MosaicGrid({ games, onGameClick }: MosaicGridProps) {
  // Sort games to push one with a banner to the 2nd slot (index 1) if possible
  const arrangedGames = useMemo(() => {
    if (games.length < 2) return games;

    const withBanner = games.filter(g => g.banner_url);
    const withoutBanner = games.filter(g => !g.banner_url);

    if (withBanner.length > 0) {
      const bannerGame = withBanner[0];
      const rest = [...withBanner.slice(1), ...withoutBanner];
      if (rest.length > 0) {
        return [rest[0], bannerGame, ...rest.slice(1)];
      }
    }
    return games;
  }, [games]);

  if (arrangedGames.length === 0) return null;

  return (
    <div className="grid grid-cols-5 gap-2 px-3 pb-8">
      {arrangedGames.map((game, index) => {
        // Slot 2 (index 1) is the wide banner slot IF we have at least 2 games
        const isWideSlot = index === 1;
        const imageUrl = (isWideSlot && game.banner_url) ? game.banner_url : game.thumbnail_url;

        return (
          <div
            key={game.id}
            onClick={() => onGameClick(game)}
            className={`
              relative cursor-pointer overflow-hidden rounded-xl bg-surface border border-white/5 
              group shadow-md hover:shadow-primary/20 hover:border-primary/50 transition-all
              ${isWideSlot ? 'col-span-3 aspect-[16/9]' : 'col-span-1 aspect-[9/16]'}
            `}
          >
            <img 
              src={imageUrl} 
              alt={game.title} 
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
            
            <div className={`absolute bottom-0 left-0 w-full p-2 flex flex-col justify-end ${isWideSlot ? 'pl-3' : ''}`}>
              <h3 className={`text-white font-bold leading-tight drop-shadow-md truncate ${isWideSlot ? 'text-sm' : 'text-[10px]'}`}>
                {game.title}
              </h3>
              <div className="flex items-center gap-1 text-gray-300 mt-0.5">
                <Play className="w-3 h-3" />
                <span className={`font-medium ${isWideSlot ? 'text-xs' : 'text-[9px]'}`}>{game.play_count || 0}</span>
              </div>
            </div>
            
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors pointer-events-none" />
          </div>
        );
      })}
    </div>
  );
}
