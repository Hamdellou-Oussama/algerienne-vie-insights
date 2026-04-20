import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as api from "./endpoints";
import { clearTokens, getStoredUser, storeTokens } from "./tokens";
import type { TokenUser } from "./types";

interface AuthCtx {
  user: TokenUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  bootstrap: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TokenUser | null>(() => getStoredUser());
  const [isLoading, setIsLoading] = useState<boolean>(() => !!getStoredUser());

  const refreshMe = useCallback(async () => {
    try {
      const res = await api.me();
      setUser({
        user_id: res.user_id,
        username: res.username,
        role: res.role as TokenUser["role"],
        status: res.status as TokenUser["status"],
      });
    } catch {
      setUser(null);
      clearTokens();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (getStoredUser()) {
      refreshMe();
    } else {
      setIsLoading(false);
    }
  }, [refreshMe]);

  const login = useCallback(async (username: string, password: string) => {
    const env = await api.login(username, password);
    storeTokens(env);
    setUser(env.user);
  }, []);

  const bootstrap = useCallback(async (username: string, password: string) => {
    const env = await api.bootstrap(username, password);
    storeTokens(env);
    setUser(env.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    clearTokens();
    setUser(null);
  }, []);

  return (
    <Ctx.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, bootstrap, logout, refreshMe }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
