import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/use-auth";
import { IoIosArrowBack } from "react-icons/io";
import { LuLogOut } from "react-icons/lu";
import Swal from "sweetalert2";

export default function AdminNavbar() {
  const { session } = useAuth();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const result = await Swal.fire({
      icon: "warning",
      title: "ออกจากระบบ?",
      text: "คุณต้องการออกจากระบบใช่หรือไม่",
      showCancelButton: true,
      confirmButtonText: "ออกจากระบบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
    });

    if (!result.isConfirmed) return;

    Swal.fire({
      title: "กำลังออกจากระบบ...",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    await logout();

    Swal.close();
    navigate("/", { replace: true });
  };

  const handleBack = () => {
    const path = location.pathname;

    switch (path) {
      case "/admin/user-management":
      case "/admin/vr-management":
      case "/admin/vr":
        navigate("/admin");
        break;

      default:
        navigate("/admin");
    }
  };

  return (
    <header className="mx-auto fixed top-0 left-0 right-0 h-[10svh] bg-black px-6 flex items-center justify-between z-50">
      {location.pathname !== "/admin" && (
        <button onClick={handleBack} className="text-white">
          <IoIosArrowBack size={32} />
        </button>
      )}

      <h1 className="text-[24px] text-white">{session?.name}</h1>

      <button onClick={handleLogout} className="rounded-[7px] p-1.5 bg-white">
        <LuLogOut size={20} />
      </button>
    </header>
  );
}
