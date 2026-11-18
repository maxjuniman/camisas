import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';

type User = { id: string; email: string; name: string; role: string };

type AuthValue = {
  user: User | null;
  ready: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  async function refresh() {
    try {
      const { data } = await api.get<{ user: User }>('/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  }

  async function logout() {
    await api.post('/auth/logout');
    setUser(null);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return <AuthContext.Provider value={{ user, ready, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider ausente');
  return value;
}
