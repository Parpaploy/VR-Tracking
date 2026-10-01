import { createBrowserRouter, Navigate } from "react-router-dom";

import PublicLayout from "./src/layouts/public-layout";
import PrivateLayout from "./src/layouts/private-layout";
import Homepage from "./src/pages/homepage";
import LoginPage from "./src/pages/login-page";
import DashboardPage from "./src/pages/dashboard-page";
import StorePage from "./src/pages/store-page";
import StoreScanPage from "./src/pages/store-scan-page";
import UserManagementPage from "./src/pages/user-management-page";
import AdminLayout from "./src/layouts/admin-layout";
import TruckPage from "./src/pages/truck-page";
import TruckScanPage from "./src/pages/truck-scan-page";
import VRManagementPage from "./src/pages/vr-management-page";
import WarehouseScanPage from "./src/pages/warehouse-scan-page";
import ScanPage from "./src/pages/scan-page";
import DriverManagementPage from "./src/pages/driver-management-page";

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      {
        index: true,
        element: <LoginPage />,
      },
    ],
  },

  {
    path: "private",
    element: <PrivateLayout />,
    children: [
      {
        index: true,
        element: <Homepage />,
      },
      { path: "warehouse/:warehouseId", element: <WarehouseScanPage /> },
      { path: "truck", element: <TruckPage /> },
      { path: "truck/:truckId", element: <TruckScanPage /> },
      { path: "store", element: <StorePage /> },
      { path: "store/:storeId", element: <StoreScanPage /> },
    ],
  },

  {
    path: "admin",
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      { path: "vr", element: <ScanPage /> },
      { path: "gas", element: <Navigate to="/admin/vr" replace /> },
      { path: "gas-management", element: <Navigate to="/admin/vr-management" replace /> },
      { path: "user-management", element: <UserManagementPage /> },
      { path: "vr-management", element: <VRManagementPage /> },
      { path: "driver-management", element: <DriverManagementPage /> },
    ],
  },
]);
