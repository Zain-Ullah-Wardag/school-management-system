import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { schoolApi } from '../services/schoolApi';
import { queryKeys } from '../services/queryKeys';
import type { User } from '../types';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  can: (...permissions: string[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const tokenKey = 'school_erp_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const clearProtectedData = useCallback(() => {
    // A dashboard (or any other protected query) must never be reused after a
    // login/logout transition. This also removes a cached 401 from a partially
    // established session before the new route mounts.
    queryClient.clear();
  }, [queryClient]);

  const refresh = useCallback(async () => {
    if (!localStorage.getItem(tokenKey)) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      setUser(await schoolApi.auth.me());
    } catch {
      localStorage.removeItem(tokenKey);
      clearProtectedData();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [clearProtectedData]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const result = await schoolApi.auth.login({ username, password });

    // Persist the token before rendering any authenticated route. Axios reads
    // this synchronously in its request interceptor.
    localStorage.setItem(tokenKey, result.token);
    clearProtectedData();
    setUser(result.user);
    setLoading(false);
    if (result.user?.id) {
      try {
        await queryClient.prefetchQuery({
          queryKey: queryKeys.dashboard.overview(result.user.id),
          queryFn: schoolApi.dashboard
        });
      } catch {
        // Login must still succeed; the dashboard will retry on mount.
      }
    }
  }, [clearProtectedData, queryClient]);

  const logout = useCallback(() => {
    localStorage.removeItem(tokenKey);
    clearProtectedData();
    setUser(null);
    setLoading(false);
  }, [clearProtectedData]);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    refresh,
    can: (...permissions: string[]) => permissions.some((permission) => user?.permissions.includes(permission))
  }), [user, loading, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
