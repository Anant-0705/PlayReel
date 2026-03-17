import axios from 'axios';
import { useUploadStore } from '../store/uploadStore';
import { useAuthStore } from '../store/authStore';

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks (must match backend MAX_CHUNK_SIZE)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:80';

export function useChunkedUpload() {
  const uploadStore = useUploadStore();
  const token = useAuthStore(state => state.token);

  const startUpload = async (
    file: File, 
    metadata: { title: string, description: string, genre: string }
  ) => {
    if (!token) return uploadStore.setError('Not authenticated');
    
    uploadStore.setProgress(0, 'Initializing secure upload...');
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    
    try {
      // 1. Init upload session
      const { data: initRes } = await axios.post(`${API_URL}/upload/init`, {
        filename: file.name,
        fileSize: file.size,
        totalChunks,
        metadata
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const { sessionId } = initRes.data;
      
      // 2. Upload chunks sequentially
      let uploadedBytes = 0;
      
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        uploadStore.setProgress(
          Math.round((chunkIndex / totalChunks) * 100), 
          `Uploading chunk ${chunkIndex + 1}/${totalChunks}...`
        );
        
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        const formData = new FormData();
        formData.append('sessionId', sessionId);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('chunk', chunk);
        
        await axios.post(`${API_URL}/upload/chunk`, formData, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        });
        
        uploadedBytes += chunk.size;
        uploadStore.setProgress(Math.round((uploadedBytes / file.size) * 100));
      }
      
      uploadStore.setProgress(100, 'Upload complete! Game makes its way through processing pipeline.');
      
      // Complete state displayed for 4s
      setTimeout(() => uploadStore.reset(), 4000);
      return true;
      
    } catch (err: any) {
      console.error('Upload failed', err);
      uploadStore.setError(err.response?.data?.error || err.message || 'Upload failed');
      return false;
    }
  };

  return { startUpload };
}
