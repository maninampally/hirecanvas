import { create } from 'zustand'

export type User = {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  tier: 'free' | 'pro' | 'elite' | 'admin'
}

type AuthStore = {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  logout: () => set({ user: null }),
}))
