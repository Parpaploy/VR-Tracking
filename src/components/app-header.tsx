import { NavLink, useNavigate } from "react-router-dom";
import {
  LuLayoutDashboard,
  LuScanLine,
  LuUsers,
  LuLogOut,
} from "react-icons/lu";
import Swal from "sweetalert2";
import { useAuth } from "../hooks/use-auth";

export default function AppHeader({ admin = false }: { admin?: boolean }) {
  const { session, logout } = useAuth();
  const isAdmin = admin || session?.role === "admin";
  const navigate = useNavigate();
  async function signOut() {
    const result = await Swal.fire({
      icon: "question",
      title: "ออกจากระบบ?",
      text: "คุณสามารถเข้าสู่ระบบอีกครั้งได้ทุกเมื่อ",
      showCancelButton: true,
      confirmButtonText: "ออกจากระบบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#2e2f70",
    });
    if (!result.isConfirmed) return;
    try {
      await logout();
      navigate("/", { replace: true });
    } catch {
      await Swal.fire({
        icon: "error",
        title: "ออกจากระบบไม่สำเร็จ",
        text: "กรุณาลองอีกครั้ง",
        confirmButtonText: "ตกลง",
      });
    }
  }
  return (
    <header className="app-header">
      <div className="header-inner">
        <NavLink to={isAdmin ? "/admin" : "/private"} className="brand">
          <span className="brand-icon">
            <img src="/vr.png" alt="" />
          </span>
          <span>
            ICAT Tracker<small>ระบบยืม–คืนอุปกรณ์</small>
          </span>
        </NavLink>
        <nav className="app-nav" aria-label="เมนูหลัก">
          {isAdmin ? (
            <>
              <NavLink end to="/admin">
                <LuLayoutDashboard /> ภาพรวมอุปกรณ์
              </NavLink>
              <NavLink to="/private">
                <LuScanLine /> ยืมอุปกรณ์และรายการของฉัน
              </NavLink>
              <NavLink to="/admin/return">
                <LuScanLine /> รับคืนอุปกรณ์
              </NavLink>
              <NavLink to="/admin/user-management">
                <LuUsers /> จัดการผู้ใช้
              </NavLink>
            </>
          ) : (
            <NavLink end to="/private">
              <LuScanLine /> ยืมอุปกรณ์และรายการของฉัน
            </NavLink>
          )}
        </nav>
        <div className="header-account">
          <span className="account-avatar">
            {session?.name?.slice(0, 1) || "V"}
          </span>
          <div className="account-name">
            <strong>{session?.name}</strong>
            <small>{isAdmin ? "ผู้ดูแลระบบ" : "สมาชิก"}</small>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="icon-button"
            aria-label="ออกจากระบบ"
            title="ออกจากระบบ"
          >
            <LuLogOut size={19} />
          </button>
        </div>
      </div>
    </header>
  );
}
