import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/use-auth";
import Navbar from "../components/navbar";

export default function PrivateLayout() {
  const { session } = useAuth();

  if (!session || session.status === "suspend") {
    return <Navigate to="/" replace />;
  }

  return <div className="app-shell"><Navbar /><div className="app-content"><Outlet /></div></div>;
}
