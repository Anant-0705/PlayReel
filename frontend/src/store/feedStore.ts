import { create } from 'zustand';

export interface Game {
  id: string;
  title: string;
  description: string;
  genre: string;
  format: 'html5' | 'godot' | 'unity' | 'wasm' | 'unity-webgl' | 'godot-html5';
  thumbnail_url: string;
  manifest_url: string;
  wasm_url: string | null;
  uploader_username: string;
  play_count: number;
  like_count: number;
  comment_count: number;
  isLikedByMe?: boolean;
}

interface FeedState {
  games: Game[];
  nextCursor: string | null;
  isLoading: boolean;
  hasMore: boolean;
  setFeed: (games: Game[], nextCursor: string | null) => void;
  appendGames: (newGames: Game[], nextCursor: string | null) => void;
  updateGameStats: (gameId: string, updates: Partial<Game>) => void;
  setLoading: (loading: boolean) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  games: [],
  nextCursor: null,
  isLoading: false,
  hasMore: true,
  setLoading: (loading) => set({ isLoading: loading }),
  setFeed: (games, nextCursor) => set({ games, nextCursor, hasMore: !!nextCursor, isLoading: false }),
  appendGames: (newGames, nextCursor) => set((state) => {
    // Prevent duplicates from rapid infinite scroll trigger
    const existingIds = new Set(state.games.map(g => g.id));
    const uniqueNew = newGames.filter(g => !existingIds.has(g.id));
    return { 
      games: [...state.games, ...uniqueNew], 
      nextCursor, 
      hasMore: !!nextCursor,
      isLoading: false 
    };
  }),
  updateGameStats: (gameId, updates) => set((state) => ({
    games: state.games.map(g => g.id === gameId ? { ...g, ...updates } : g)
  })),
}));
