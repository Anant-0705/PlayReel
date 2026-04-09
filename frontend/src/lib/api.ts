import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:80').replace(/\/+$/, '');
export const API_ROOT = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

export const api = axios.create({
  baseURL: API_ROOT,
});

// Intercept requests to inject the Authorization token automatically
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercept responses to catch 401 Unauthorized errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('[API] Caught 401 Unauthorized. Logging out...');
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
