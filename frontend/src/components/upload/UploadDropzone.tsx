import { useCallback, useState } from 'react';
import { UploadCloud, FileArchive, Binary } from 'lucide-react';
import { useChunkedUpload } from '../../hooks/useChunkedUpload';
import { useUploadStore } from '../../store/uploadStore';

interface UploadDropzoneProps {
  onSuccess: () => void;
}

export function UploadDropzone({ onSuccess }: UploadDropzoneProps) {
  const { startUpload } = useChunkedUpload();
  const { isUploading } = useUploadStore();
  const [file, setFile] = useState<File | null>(null);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [errorLocal, setErrorLocal] = useState('');

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) validateAndSetFile(droppedFile);
  }, []);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setErrorLocal('');
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext !== 'zip' && ext !== 'wasm') {
      setErrorLocal('Only .zip and .wasm files are supported.');
      return;
    }
    setFile(selectedFile);
  };

  const normalizeGenre = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'arcade') return 'other';
    return normalized;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title || !description || !genre) {
      setErrorLocal('Please fill out all fields and select a file.');
      return;
    }

    const normalizedGenre = normalizeGenre(genre);
    if (!normalizedGenre) {
      setErrorLocal('Please select a valid genre.');
      return;
    }
    
    let bannerBase64: string | undefined = undefined;
    if (bannerFile) {
      try {
        const buffer = await bannerFile.arrayBuffer();
        // Construct the base64 string
        const base64Str = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
        bannerBase64 = `data:${bannerFile.type};base64,${base64Str}`;
      } catch (err) {
        setErrorLocal('Failed to read banner image.');
        return;
      }
    }
    
    const success = await startUpload(file, { title, description, genre: normalizedGenre, bannerBase64 });
    if (success) {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto space-y-6">
      
      <div 
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="w-full h-56 border-2 border-dashed border-white/20 rounded-3xl bg-surface/40 hover:bg-surface/60 transition-colors flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)]"
      >
        <input 
          type="file" 
          accept=".zip,.wasm" 
          onChange={onFileSelect} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          disabled={isUploading}
        />
        
        {file ? (
          <div className="flex flex-col items-center animate-fade-in z-0 pointer-events-none">
             {file.name.endsWith('.wasm') ? <Binary className="w-14 h-14 text-blue-400 mb-3 drop-shadow-[0_0_10px_rgba(96,165,250,0.5)]" /> : <FileArchive className="w-14 h-14 text-amber-500 mb-3 drop-shadow-[0_0_10px_rgba(245,158,11,0.5)]" />}
             <p className="text-white font-bold text-lg">{file.name}</p>
             <p className="text-gray-400 text-sm mt-1 bg-black/30 px-3 py-1 rounded-full">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        ) : (
          <div className="flex flex-col items-center group-hover:scale-105 transition-transform duration-300 z-0 pointer-events-none">
            <div className="p-5 bg-primary/20 rounded-full mb-4 shadow-[0_0_15px_rgba(108,99,255,0.4)]">
              <UploadCloud className="w-10 h-10 text-primary" />
            </div>
            <p className="text-white font-semibold text-lg">Click or Drag Game Archive</p>
            <p className="text-gray-500 text-sm mt-2 font-medium">Supports Unity / Godot / HTML5 (.zip) or Raw Payload (.wasm)</p>
          </div>
        )}
      </div>

      {errorLocal && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm font-medium animate-fade-in shadow-inner">{errorLocal}</div>}

      <div className="space-y-5 bg-surface/30 p-6 rounded-3xl border border-white/5">
        <div>
          <label className="block text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">Game Title</label>
          <input 
            type="text" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)}
            disabled={isUploading}
            className="w-full bg-[#0d1425] border border-white/10 rounded-xl px-5 py-3.5 text-white font-medium focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
            placeholder="e.g. Flappy Bird Web3"
          />
        </div>

        <div>
           <label className="block text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">Primary Genre</label>
           <div className="relative">
             <select 
               value={genre} 
               onChange={(e) => setGenre(e.target.value)}
               disabled={isUploading}
               className="w-full bg-[#0d1425] border border-white/10 rounded-xl px-5 py-3.5 text-white font-medium focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all appearance-none shadow-inner"
             >
               <option value="" disabled>Select a genre</option>
               <option value="action">Action</option>
               <option value="puzzle">Puzzle</option>
               <option value="platformer">Platformer</option>
               <option value="rpg">RPG</option>
               <option value="shooter">Shooter</option>
               <option value="strategy">Strategy</option>
               <option value="sports">Sports</option>
               <option value="horror">Horror</option>
               <option value="simulation">Simulation</option>
               <option value="other">Other</option>
             </select>
             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-5 text-gray-400">
               <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
             </div>
           </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">Description</label>
          <textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)}
            disabled={isUploading}
            rows={3}
            className="w-full bg-[#0d1425] border border-white/10 rounded-xl px-5 py-3.5 text-white font-medium focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all resize-none shadow-inner"
            placeholder="Tell the world what makes your game fun..."
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">Search Banner (Optional 16:9 Landscape)</label>
          <div className="relative">
            <input 
              type="file" 
              accept="image/jpeg, image/png, image/webp"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setBannerFile(e.target.files[0]);
                }
              }}
              disabled={isUploading}
              className="w-full bg-[#0d1425] border border-white/10 rounded-xl px-5 py-3.5 text-white font-medium focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 cursor-pointer"
            />
          </div>
          {bannerFile && (
            <p className="text-xs text-primary mt-2 flex items-center gap-1">
              ✓ Banner selected: {bannerFile.name}
            </p>
          )}
        </div>
      </div>

      <button 
        type="submit" 
        disabled={isUploading || !file || !title || !description || !genre}
        className="w-full bg-gradient-to-r from-primary to-indigo-600 hover:from-indigo-500 hover:to-purple-600 text-white font-bold text-lg py-4 rounded-2xl shadow-[0_8px_25px_rgba(108,99,255,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] mt-4"
      >
        {isUploading ? 'Securely Uploading...' : 'Publish Game to Feed'}
      </button>

    </form>
  );
}
