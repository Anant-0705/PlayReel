import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { FeedPage } from './pages/FeedPage';
import { AuthPage } from './pages/AuthPage';
import { UploadPage } from './pages/UploadPage';
import { ProfilePage } from './pages/ProfilePage';
import { SearchPage } from './pages/SearchPage';
import { BottomNav } from './components/navigation/BottomNav';

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
          <Route path="/search" element={<SearchPage />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}
