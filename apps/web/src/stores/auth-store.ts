import { create } from 'zustand';

interface SessionUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

interface AuthState {
  user: SessionUser | null;
  role: 'player' | 'referee' | null;
  isLoading: boolean;
  setUser: (user: SessionUser | null) => void;
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
