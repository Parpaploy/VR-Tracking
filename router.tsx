import { createBrowserRouter, Navigate } from "react-router-dom";
import PublicLayout from "./src/layouts/public-layout";
import PrivateLayout from "./src/layouts/private-layout";
import AdminLayout from "./src/layouts/admin-layout";
import Homepage from "./src/pages/homepage";
import LoginPage from "./src/pages/login-page";
import RegisterPage from "./src/pages/register-page";
import DashboardPage from "./src/pages/dashboard-page";
import ReturnPage from "./src/pages/return-page";
import UserManagementPage from "./src/pages/user-management-page";
export const router = createBrowserRouter([
  { element: <PublicLayout />, children: [
    { index: true, element: <LoginPage /> },
    { path: "register", element: <RegisterPage /> },
  ] },
  { path: "private", element: <PrivateLayout />, children: [
    { index: true, element: <Homepage /> },
    { path: "*", element: <Navigate to="/private" replace /> },
  ] },
  { path: "admin", element: <AdminLayout />, children: [
    { index: true, element: <DashboardPage /> },
    { path: "return", element: <ReturnPage /> },
    { path: "user-management", element: <UserManagementPage /> },
    { path: "*", element: <Navigate to="/admin" replace /> },
  ] },
]);
