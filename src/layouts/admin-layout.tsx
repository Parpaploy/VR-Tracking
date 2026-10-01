import { Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/use-auth";
import AdminNavbar from "../components/admin-navbar";
import { useEffect, useRef } from "react";

export default function AdminLayout() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const redirecting = useRef(false);

  const isAuthorized =
    !!session && session.status !== "suspend" && session.role === "admin";

  useEffect(() => {
    if (isAuthorized) return;
    if (redirecting.current) return;
    redirecting.current = true;

    if (!session || session.status === "suspend") {
      navigate("/", { replace: true });
    } else {
      navigate("/private", { replace: true });
    }
  }, [isAuthorized, session, navigate]);

  if (!isAuthorized) return null;

  return <div className="app-shell" translate="no"><AdminNavbar /><div className="app-content"><Outlet /></div></div>;
}
