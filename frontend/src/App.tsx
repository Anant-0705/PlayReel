import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { FeedPage } from './pages/FeedPage';
import { AuthPage } from './pages/AuthPage';
import { UploadPage } from './pages/UploadPage';
import { ProfilePage } from './pages/ProfilePage';
import { BottomNav } from './components/navigation/BottomNav';
import { Ghost } from 'lucide-react';

export default function App() {
  return (
    <BrowserRouter>
      <div className="w-full min-h-[100dvh] bg-black text-white selection:bg-primary/30 font-sans antialiased overflow-hidden">
        <Routes>
          <Route path="/" element={<FeedPage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/search" element={
            <div className="flex flex-col h-screen items-center justify-center bg-background text-gray-500 px-6 text-center">
               <Ghost className="w-16 h-16 mb-4 opacity-20" />
               <h2 className="text-xl font-bold text-white/50">Search Empty</h2>
               <p className="mt-2 font-medium">Coming soon...</p>
            </div>
          } />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}
