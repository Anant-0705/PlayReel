import { useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { Gamepad2, Mail, Lock, User as UserIcon } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:80';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const login = useAuthStore((state: any) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        const res = await axios.post(`${API_URL}/auth/login`, { email, password });
        login(res.data.data.token, res.data.data.user);
        navigate('/');
      } else {
        const res = await axios.post(`${API_URL}/auth/register`, { email, password, username });
        login(res.data.data.token, res.data.data.user);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center py-12 px-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md z-10 text-center mb-8 animate-slide-up">
        <Gamepad2 className="mx-auto h-20 w-20 text-white shadow-[0_0_30px_rgba(108,99,255,0.4)] bg-gradient-to-br from-primary to-indigo-600 p-4 rounded-[2rem] border border-white/20" />
        <h2 className="mt-8 text-center text-5xl font-black text-white tracking-tighter drop-shadow-md">
          GameReel
        </h2>
        <p className="mt-3 text-center text-base text-gray-400 font-medium">
          {isLogin ? 'Welcome back! Ready to play?' : 'Join the infinite arcade.'}
        </p>
      </div>

      <div className="w-full max-w-md z-10 animate-fade-in">
        <div className="bg-surface/60 backdrop-blur-xl py-10 px-8 shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/10 rounded-3xl">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium p-3 rounded-xl shadow-inner text-center">
                {error}
              </div>
            )}

            {!isLogin && (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <UserIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Username"
                  className="block w-full pl-11 pr-4 py-3.5 bg-[#0d1425] border border-white/5 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-sm"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="email"
                required
                placeholder="Email address"
                className="block w-full pl-11 pr-4 py-3.5 bg-[#0d1425] border border-white/5 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                required
                placeholder="Password"
                className="block w-full pl-11 pr-4 py-3.5 bg-[#0d1425] border border-white/5 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <button
                type="submit"
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-[1rem] shadow-[0_5px_20px_rgba(108,99,255,0.4)] text-sm font-bold text-white bg-gradient-to-r from-primary to-indigo-600 hover:from-indigo-500 hover:to-primary active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-background"
              >
                {isLogin ? 'Sign in' : 'Create account'}
              </button>
            </div>
          </form>

          <div className="mt-8 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-surface text-gray-400 font-medium">Or</span>
            </div>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:text-white font-semibold transition-colors text-sm"
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
