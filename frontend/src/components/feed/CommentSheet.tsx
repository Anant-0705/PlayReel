import { useState, useEffect } from 'react';
import { X, Send, MessageCircle } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/authStore';

interface Comment {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

interface CommentSheetProps {
  gameId: string;
  isOpen: boolean;
  onClose: () => void;
}

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:80').replace(/\/+$/, '');
const API_ROOT = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

export function CommentSheet({ gameId, isOpen, onClose }: CommentSheetProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const token = useAuthStore(state => state.token);

  useEffect(() => {
    if (isOpen) fetchComments();
  }, [isOpen, gameId]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_ROOT}/social/comments/${gameId}`);
      if (res.data?.data?.comments) {
          setComments(res.data.data.comments);
      }
    } catch (err) {
      console.error('Failed to fetch comments', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !token) return;
    try {
      await axios.post(`${API_ROOT}/social/comment`, { gameId, content: newComment }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewComment('');
      fetchComments(); // In a full implementation, socketStore broadcast handles this instantly if we listen.
    } catch (err) {
      console.error('Post comment failed', err);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="absolute inset-0 bg-black/60 z-40 animate-fade-in backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 h-[70vh] bg-surface rounded-t-3xl z-50 flex flex-col animate-slide-up shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5">
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-surface rounded-t-3xl">
          <h3 className="font-bold text-lg text-white">Comments <span className="text-gray-400 text-sm font-normal ml-2">{comments.length}</span></h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition-colors bg-white/5"><X className="w-5 h-5 text-gray-300" /></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 bg-[#0d1425]">
          {loading ? (
            <div className="text-center text-gray-400 text-sm py-8 animate-pulse">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-12 flex flex-col items-center">
              <MessageCircle className="w-12 h-12 mb-3 opacity-20" />
              Be the first to comment on this game!
            </div>
          ) : (
            comments.map(c => (
              <div key={c.id} className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md">
                  {c.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-gray-400 mb-1 flex items-center justify-between">
                    {c.username}
                    <span className="text-[10px] text-gray-600 font-normal">{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-sm text-white/95 leading-relaxed bg-white/5 rounded-2xl rounded-tl-sm p-3 px-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">{c.content}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handlePost} className="p-4 border-t border-white/5 flex gap-3 bg-surface pb-6">
          <input 
            type="text" 
            placeholder={token ? "Add a comment..." : "Log in to comment"} 
            className="flex-1 bg-[#1a2542] rounded-full px-5 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-primary/50 transition-shadow placeholder:text-gray-500 shadow-inner"
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            disabled={!token}
          />
          <button disabled={!token || !newComment.trim()} type="submit" className="p-3 bg-primary rounded-full disabled:opacity-50 disabled:cursor-not-allowed text-white shrink-0 hover:bg-indigo-500 transition-colors shadow-lg shadow-primary/20">
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </form>
      </div>
    </>
  );
}
