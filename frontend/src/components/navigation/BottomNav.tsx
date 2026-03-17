import { Home, PlusSquare, User, Search } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  // Don't show nav on auth pages
  if (path === '/login' || path === '/register') return null;

  return (
    <div className="fixed bottom-0 w-full h-[5.5rem] bg-black/95 backdrop-blur-xl border-t border-white/10 flex items-start justify-around z-[90] px-4 pt-3 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
      <Link to="/" className={`flex flex-col items-center gap-1.5 p-1 transition-all group ${path === '/' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
        <Home className={`w-6 h-6 transition-transform ${path === '/' ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'group-active:scale-95'}`} strokeWidth={path === '/' ? 2.5 : 2} />
        <span className={`text-[10px] font-bold ${path === '/' ? 'opacity-100' : 'opacity-80'}`}>Home</span>
      </Link>
      
      <Link to="/search" className={`flex flex-col items-center gap-1.5 p-1 transition-all group ${path === '/search' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
        <Search className={`w-6 h-6 transition-transform ${path === '/search' ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'group-active:scale-95'}`} strokeWidth={path === '/search' ? 2.5 : 2} />
        <span className={`text-[10px] font-bold ${path === '/search' ? 'opacity-100' : 'opacity-80'}`}>Search</span>
      </Link>

      <Link to="/upload" className="flex flex-col items-center justify-center -mt-8 relative group">
        <div className="absolute inset-0 bg-primary/20 blur-md rounded-2xl group-hover:bg-primary/40 transition-colors" />
        <div className="w-[3.25rem] h-[2.25rem] bg-gradient-to-r from-cyan-400 via-primary to-purple-500 rounded-xl flex items-center justify-center shadow-[0_4px_15px_rgba(108,99,255,0.5)] relative z-10 transition-transform group-active:scale-95 group-hover:scale-105">
          <div className="w-[88%] h-[82%] bg-white rounded-[7px] flex items-center justify-center">
             <PlusSquare className="w-5 h-5 text-black ml-0.5" strokeWidth={3} />
          </div>
        </div>
      </Link>

      <Link to="/profile" className={`flex flex-col items-center gap-1.5 p-1 transition-all group ${path === '/profile' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}>
        <User className={`w-6 h-6 transition-transform ${path === '/profile' ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : 'group-active:scale-95'}`} strokeWidth={path === '/profile' ? 2.5 : 2} />
        <span className={`text-[10px] font-bold ${path === '/profile' ? 'opacity-100' : 'opacity-80'}`}>Profile</span>
      </Link>
    </div>
  );
}
