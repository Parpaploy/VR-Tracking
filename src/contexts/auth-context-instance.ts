import { createContext } from "react";
import type { AuthContextType } from "../interfaces/user.interface";

export const AuthContext = createContext<AuthContextType | null>(null);
