import { UploadDropzone } from '../components/upload/UploadDropzone';
import { UploadProgress } from '../components/upload/UploadProgress';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { Rocket } from 'lucide-react';

export function UploadPage() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <div className="w-full h-full min-h-[100dvh] flex flex-col items-center justify-center bg-background px-6 pb-20">
        <h2 className="text-3xl font-bold text-white mb-4 text-center">Creators Only</h2>
        <p className="text-gray-400 mb-8 text-center max-w-sm">You need to be signed in to publish games to the GameReel universe.</p>
        <button 
          onClick={() => navigate('/login')}
          className="bg-primary px-8 py-3 rounded-full text-white font-bold shadow-lg"
        >
          Sign in now
        </button>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[100dvh] bg-background pt-12 px-4 pb-32">
       <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-8 pl-2">
            <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
               <Rocket className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Post to Feed</h1>
              <p className="text-gray-400 text-sm font-medium">Upload your web game build and manifest.</p>
            </div>
          </div>
          
          <UploadDropzone onSuccess={() => {
             // Let user see 100% success state via UploadProgress modal, then it handles timeout
          }} />
       </div>
       
       <UploadProgress />
    </div>
  );
}
