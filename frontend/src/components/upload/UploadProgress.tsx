import { useUploadStore } from '../../store/uploadStore';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export function UploadProgress() {
  const { isUploading, progress, statusText, error, reset } = useUploadStore();

  if (!isUploading && !error) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-6">
      <div className="bg-surface w-full max-w-md rounded-[2rem] p-10 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,1)] animate-slide-up flex flex-col items-center text-center relative overflow-hidden">
        
        {/* Ambient Glow behind modal content */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-40 bg-primary/10 blur-[60px] -z-10 rounded-[100%]" />

        {error ? (
          <>
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6 shadow-inner border border-red-500/20">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Upload Failed</h3>
            <p className="text-red-400 text-sm mb-8 font-medium px-4">{error}</p>
            <button 
              onClick={reset}
              className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-bold transition-all active:scale-95"
            >
              Dismiss
            </button>
          </>
        ) : progress === 100 ? (
          <>
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6 shadow-inner border border-emerald-500/20">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Success!</h3>
            <p className="text-emerald-400 text-sm font-medium">{statusText}</p>
            <p className="text-gray-500 text-xs mt-4">Generating thumbnails in background...</p>
          </>
        ) : (
          <>
            <div className="relative w-28 h-28 mb-8 drop-shadow-[0_0_15px_rgba(108,99,255,0.3)]">
               <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle className="text-white/5 stroke-current" strokeWidth="8" cx="50" cy="50" r="42" fill="transparent"></circle>
                  <circle 
                    className="text-primary stroke-current transition-all duration-300 ease-out" 
                    strokeWidth="8" 
                    strokeLinecap="round" 
                    cx="50" 
                    cy="50" 
                    r="42" 
                    fill="transparent" 
                    strokeDasharray="263.89" 
                    strokeDashoffset={263.89 - (263.89 * progress) / 100}
                  ></circle>
               </svg>
               <div className="absolute inset-0 flex items-center justify-center bg-surface/50 rounded-full m-2 backdrop-blur-sm">
                 <span className="text-2xl font-black text-white">{progress}%</span>
               </div>
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">Processing Game</h3>
            <p className="text-primary/80 text-sm font-medium px-4 h-10 flex items-center justify-center">{statusText}</p>
          </>
        )}
      </div>
    </div>
  );
}
