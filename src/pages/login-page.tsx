import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchAndVerifyPin } from "../lib/auth.services";
import { useAuth } from "../hooks/use-auth";

export default function LoginPage() {
  const { login, session } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (session)
      navigate(session.role === "admin" ? "/admin" : "/private", {
        replace: true,
      });
  }, [session, navigate]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const result = await fetchAndVerifyPin(email, password);
    if (result.success && result.session) login(result.session);
    else setError(result.error ?? "เข้าสู่ระบบไม่สำเร็จ");
    setBusy(false);
  }
  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="flex justify-start items-center gap-2">
          <span className="brand-icon">
            <img src="/vr.svg" alt="" />
          </span>
          <div className="flex flex-col justify-center items-start">
            <p className="-mb-1.5">ICAT Tracker</p>
            <p>ระบบยืม–คืนอุปกรณ์</p>
          </div>
        </div>

        <p className="story-description">
          ยืมอุปกรณ์ได้ง่าย ๆ สแกน แนบรูป และติดตามคำขอได้ในที่เดียว
        </p>
        <div className="auth-graphic" aria-hidden="true">
          <img src="/vr-nobg.svg" alt="" />
        </div>

        <footer>สแกน QR · ส่งคำขอ · รออนุมัติ · พร้อมใช้งาน</footer>
      </section>
      <section className="auth-form-area">
        <div className="auth-form">
          <h2>เข้าสู่ระบบ</h2>
          <p className="mt-2 text-sm text-slate-500">
            ใช้อีเมลนักศึกษาและรหัสผ่านของคุณ
          </p>
          <form onSubmit={(e) => void submit(e)} className="surface space-y-5">
            <label className="block text-sm font-medium">
              อีเมลนักศึกษา
              <input
                required
                type="email"
                autoComplete="username"
                placeholder="name@student.ac.th"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                className="mt-2 w-full p-3"
              />
            </label>
            <label className="block text-sm font-medium">
              รหัสผ่าน
              <input
                required
                type="password"
                autoComplete="current-password"
                placeholder="กรอกรหัสผ่าน"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full p-3"
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button
              disabled={busy}
              className="primary-button w-full disabled:opacity-50"
            >
              {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            </button>
            <p className="text-center text-sm text-slate-500">
              ยังไม่มีบัญชี?
              <Link className="font-semibold" to="/register">
                สมัครสมาชิก
              </Link>
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}
