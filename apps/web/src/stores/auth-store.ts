import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  role: 'player' | 'referee' | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setRole: (role: 'player' | 'referee' | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  setLoading: (isLoading) => set({ isLoading }),
  signOut: () => set({ user: null, role: null }),
}));
