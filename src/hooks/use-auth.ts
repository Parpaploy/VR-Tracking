import { useContext } from "react";
import type { AuthContextType } from "../interfaces/user.interface";
import { AuthContext } from "../contexts/auth-context-instance";

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
