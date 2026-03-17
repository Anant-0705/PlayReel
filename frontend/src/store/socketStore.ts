import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './authStore';
import { useFeedStore } from './feedStore';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
}

const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:80';

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  
  connect: () => {
    if (get().socket?.connected) return;
    
    const token = useAuthStore.getState().token;
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      path: '/socket.io/',
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('[websocket] connected');
      set({ isConnected: true });
    });

    socket.on('disconnect', () => {
      console.log('[websocket] disconnected');
      set({ isConnected: false });
    });

    // Handle real-time stat updates broadcasted from social-service
    socket.on('stats_updated', (data: { gameId: string, likes: number, comments: number }) => {
      useFeedStore.getState().updateGameStats(data.gameId, {
        like_count: data.likes,
        comment_count: data.comments
      });
    });

    set({ socket });
  },
  
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, isConnected: false });
    }
  }
}));
