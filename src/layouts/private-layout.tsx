import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/use-auth";
import Navbar from "../components/navbar";

export default function PrivateLayout() {
  const { session } = useAuth();

  if (!session || session.status === "suspend") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="w-full min-h-[90svh] h-[90svh] max-h-[90svh] mt-[10svh] flex justify-center">
      <div className="w-full max-w-107.5 mx-auto">
        <Outlet />

        <Navbar />
      </div>
    </div>
  );
}
