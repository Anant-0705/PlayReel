import { create } from 'zustand';

interface UploadState {
  isUploading: boolean;
  progress: number; // 0 to 100
  statusText: string;
  error: string | null;
  reset: () => void;
  setProgress: (progress: number, text?: string) => void;
  setError: (error: string) => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  isUploading: false,
  progress: 0,
  statusText: '',
  error: null,
  reset: () => set({ isUploading: false, progress: 0, statusText: '', error: null }),
  setProgress: (progress, text) => set((state) => ({ 
    isUploading: true, 
    progress, 
    statusText: text || state.statusText,
    error: null
  })),
  setError: (error) => set({ error, isUploading: false }),
}));
