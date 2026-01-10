import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthUser } from '@/lib/auth';

interface AuthStore {
  user: AuthUser | null;
  loading: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuth = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      loading: true,
      login: (user) => set({ user, loading: false }),
      logout: () => set({ user: null, loading: false }),
      setLoading: (loading) => set({ loading }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
