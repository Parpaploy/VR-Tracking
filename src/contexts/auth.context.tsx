import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import type { ISession } from "../interfaces/user.interface";
import { AuthContext } from "./auth-context-instance";
import { restoreSession, logoutUser } from "../lib/auth.services";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ISession | null>(null);
  const [restoring, setRestoring] = useState<boolean>(true);

  useEffect(() => {
    restoreSession()
      .then((s) => {
        if (s) setSession(s);
      })
      .finally(() => setRestoring(false));
  }, []);

  const login = useCallback((s: ISession) => {
    setSession(s);
  }, []);

  const logout = useCallback(async () => {
    if (session) {
      await logoutUser(session.id);
    }
    setSession(null);
  }, [session]);

  if (restoring) {
    return (
      <div className="w-full flex justify-center items-center h-svh">
        <div className="w-18 h-18 border-6 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ session, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
