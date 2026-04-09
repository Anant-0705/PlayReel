import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { LogOut, Grid, Heart, Box, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { DirectoryGrid } from '../components/search/DirectoryGrid';
import type { SearchGame } from '../pages/SearchPage';

interface ProfileData {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  following_count: number;
  game_count: number;
}

export function ProfilePage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [games, setGames] = useState<SearchGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchProfile = async () => {
      try {
        const [profileRes, gamesRes] = await Promise.all([
          api.get(`/users/profile/${user.id}`),
          api.get(`/users/profile/${user.id}/games`)
        ]);
        
        setProfile(profileRes.data.data);
        setGames(gamesRes.data.data.games || []);
      } catch (err) {
        console.error('Failed to load profile', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="min-h-[100dvh] bg-background text-white pb-24 font-sans">
      <div className="pt-10 px-6 pb-6 border-b border-white/5 flex justify-between items-center bg-surface sticky top-0 z-40 shadow-sm backdrop-blur-xl bg-background/90">
         <h1 className="text-xl font-bold tracking-tight">{user.username}</h1>
         <div className="flex gap-4">
            <button onClick={handleLogout} className="p-2 -mr-2 rounded-full hover:bg-white/5 transition-colors">
               <LogOut className="w-5 h-5 text-gray-400 hover:text-red-400 transition-colors" />
            </button>
         </div>
      </div>
      
      {isLoading ? (
        <div className="flex flex-col items-center justify-center mt-32">
          <Loader2 className="w-8 h-8 animate-spin text-primary opacity-50" />
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center mt-8 animate-fade-in">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center shadow-2xl mb-5 border-2 border-white/10 overflow-hidden">
                 {profile?.avatar_url ? (
                   <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                 ) : (
                   <span className="text-4xl font-black">{user.username[0].toUpperCase()}</span>
                 )}
              </div>
            </div>
            <h2 className="text-2xl font-bold">@{user.username}</h2>
            {profile?.bio && <p className="text-white/60 text-sm mt-2 max-w-[280px] text-center">{profile.bio}</p>}
            
            <div className="flex gap-10 mt-6 w-full max-w-sm justify-center">
               <div className="text-center group cursor-pointer">
                 <div className="text-xl font-bold text-white group-hover:text-primary transition-colors">{profile?.following_count || 0}</div>
                 <div className="text-xs text-gray-400 font-medium mt-0.5">Following</div>
               </div>
               <div className="text-center border-l w-[1px] border-white/10 mx-2"></div>
               <div className="text-center group cursor-pointer">
                 <div className="text-xl font-bold text-white group-hover:text-primary transition-colors">{profile?.follower_count || 0}</div>
                 <div className="text-xs text-gray-400 font-medium mt-0.5">Followers</div>
               </div>
               <div className="text-center border-l w-[1px] border-white/10 mx-2"></div>
               <div className="text-center group cursor-pointer">
                 <div className="text-xl font-bold text-white group-hover:text-primary transition-colors">{profile?.game_count || 0}</div>
                 <div className="text-xs text-gray-400 font-medium mt-0.5">Games</div>
               </div>
            </div>
          </div>

          <div className="mt-10 flex border-b border-white/5 sticky top-[76px] z-30 bg-background/95 backdrop-blur-md">
            <button className="flex-1 pb-4 flex justify-center text-white relative">
               <Grid className="w-6 h-6" />
               <div className="absolute bottom-0 w-1/3 h-[2px] bg-white rounded-t-full" />
            </button>
            <button className="flex-1 pb-4 flex justify-center text-gray-600 hover:text-gray-300 transition-colors">
               <Heart className="w-6 h-6" />
            </button>
          </div>

          <div className="mt-6 flex flex-col gap-6 animate-slide-up">
            {games.length === 0 ? (
              <div className="p-4 flex flex-col items-center justify-center text-center mt-12 mb-12">
                 <Box className="w-16 h-16 text-white/5 mb-4" />
                 <h3 className="text-lg font-bold text-white/40">No Games Yet</h3>
                 <p className="text-sm text-white/30 max-w-[200px] mt-1">Upload your first game to see it here.</p>
              </div>
            ) : (
              <DirectoryGrid 
                games={games} 
                onGameClick={() => {
                  // Game playback inside profile page grid feature can be added later
                  console.log("Game clicked on profile");
                }} 
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
