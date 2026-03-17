import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { LogOut, Grid, Heart, Box } from 'lucide-react';

export function ProfilePage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="min-h-[100dvh] bg-background text-white pb-24">
      <div className="pt-10 px-6 pb-6 border-b border-white/5 flex justify-between items-center bg-surface sticky top-0 z-10 shadow-sm">
         <h1 className="text-xl font-bold tracking-tight">{user.username}</h1>
         <div className="flex gap-4">
            <button onClick={handleLogout} className="p-2 -mr-2 rounded-full hover:bg-white/5 transition-colors">
               <LogOut className="w-5 h-5 text-gray-400 hover:text-red-400 transition-colors" />
            </button>
         </div>
      </div>
      
      <div className="flex flex-col items-center mt-8 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
          <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center shadow-2xl mb-5 border-2 border-white/10">
             <span className="text-4xl font-black">{user.username[0].toUpperCase()}</span>
          </div>
        </div>
        <h2 className="text-2xl font-bold">@{user.username}</h2>
        
        <div className="flex gap-10 mt-6 w-full max-w-sm justify-center">
           <div className="text-center group cursor-pointer">
             <div className="text-xl font-bold text-white group-hover:text-primary transition-colors">0</div>
             <div className="text-xs text-gray-400 font-medium mt-0.5">Following</div>
           </div>
           <div className="text-center border-l w-[1px] border-white/10 mx-2"></div>
           <div className="text-center group cursor-pointer">
             <div className="text-xl font-bold text-white group-hover:text-primary transition-colors">0</div>
             <div className="text-xs text-gray-400 font-medium mt-0.5">Followers</div>
           </div>
           <div className="text-center border-l w-[1px] border-white/10 mx-2"></div>
           <div className="text-center group cursor-pointer">
             <div className="text-xl font-bold text-white group-hover:text-primary transition-colors">0</div>
             <div className="text-xs text-gray-400 font-medium mt-0.5">Likes</div>
           </div>
        </div>
      </div>

      <div className="mt-10 flex border-b border-white/5">
        <button className="flex-1 pb-4 flex justify-center text-white relative">
           <Grid className="w-6 h-6" />
           <div className="absolute bottom-0 w-1/3 h-[2px] bg-white rounded-t-full" />
        </button>
        <button className="flex-1 pb-4 flex justify-center text-gray-600 hover:text-gray-300 transition-colors">
           <Heart className="w-6 h-6" />
        </button>
      </div>

      <div className="p-4 flex flex-col items-center justify-center text-center mt-12 animate-slide-up">
         <Box className="w-16 h-16 text-white/5 mb-4" />
         <h3 className="text-lg font-bold text-white/40">No Games Yet</h3>
         <p className="text-sm text-white/30 max-w-[200px] mt-1">Upload your first game to see it here.</p>
      </div>
    </div>
  );
}
