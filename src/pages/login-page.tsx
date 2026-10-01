import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchAndVerifyPin } from "../lib/auth.services";
import { useAuth } from "../hooks/use-auth";

export default function LoginPage() {
  const { login, session } = useAuth(); const navigate = useNavigate();
  const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  useEffect(()=>{if(session)navigate(session.role==='admin'?'/admin':'/private',{replace:true});},[session,navigate]);
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");const result=await fetchAndVerifyPin(email,password);if(result.success&&result.session)login(result.session);else setError(result.error??"เข้าสู่ระบบไม่สำเร็จ");setBusy(false);}
  return <main className="min-h-full w-full flex items-center justify-center bg-black p-5"><form onSubmit={e=>void submit(e)} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl space-y-5"><div><h1 className="text-2xl font-bold">VR Tracker</h1><p className="mt-1 text-gray-500">เข้าสู่ระบบด้วยอีเมลนักศึกษา</p></div><label className="block text-sm font-medium">อีเมลนักศึกษา<input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value.toLowerCase())} className="mt-1 w-full rounded-xl border p-3" /></label><label className="block text-sm font-medium">รหัสผ่าน<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>{error&&<p role="alert" className="text-sm text-red-600">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-black p-3 font-bold text-white disabled:opacity-50">{busy?"กำลังเข้าสู่ระบบ…":"เข้าสู่ระบบ"}</button><p className="text-center text-sm text-gray-600">ยังไม่มีบัญชี? <Link className="font-semibold underline" to="/register">สมัครสมาชิก</Link></p></form></main>;
}
