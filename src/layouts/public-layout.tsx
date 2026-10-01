import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/use-auth";

export default function PublicLayout() {
  const { session } = useAuth();

  if (session) {
    return (
      <Navigate to={session.role === "admin" ? "/admin" : "/private"} replace />
    );
  }

  return (
    <div className="public-shell">
      <Outlet />
    </div>
  );
}
