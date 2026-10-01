import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { compressPhoto } from "../lib/cloudinary";
import { registerUser } from "../lib/auth.services";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", nickname: "", studentId: "", studentEmail: "", phone: "", password: "", confirmPassword: "" });
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  async function choose(file?: File) {
    setPhoto(null); setPreview(""); setError("");
    if (!file) return;
    setPreparing(true);
    try { setPhoto(await compressPhoto(file)); }
    catch (err) { setError(err instanceof Error ? err.message : "อ่านรูปไม่สำเร็จ"); }
    finally { setPreparing(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || preparing) return;
    if (!photo) return setError("กรุณาแนบสำเนาบัตรประชาชน");
    if (form.password.length < 6) return setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
    if (form.password !== form.confirmPassword) return setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    lock.current = true; setBusy(true); setError("");
    try {
      const identityImage = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("อ่านเอกสารไม่สำเร็จ"));
        reader.readAsDataURL(photo);
      });
      await registerUser({ ...form, identityImage, consent, role: "user", status: "active" }, form.password);
      setPhoto(null); setPreview(""); setForm({ name: "", nickname: "", studentId: "", studentEmail: "", phone: "", password: "", confirmPassword: "" }); setSuccess(true);
    } catch (err) { setError(err instanceof Error ? err.message : "สมัครไม่สำเร็จ กรุณาลองใหม่"); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main className="register-page">
    <div className="surface">
      <Link to="/" className="mb-6 inline-block text-sm font-semibold text-blue-700">← กลับไปเข้าสู่ระบบ</Link>
      <h1 className="text-2xl font-bold">สร้างบัญชีผู้ใช้</h1>
      <p className="text-sm text-gray-500 mt-2 mb-6">สมัครเพื่อใช้งาน VR Tracker</p>
      {success ? <div role="status" className="space-y-4"><p className="text-green-700">สมัครสำเร็จแล้ว ใช้อีเมลนักศึกษาและรหัสผ่านที่ตั้งไว้เพื่อเข้าสู่ระบบ</p><Link to="/" className="block bg-black text-white text-center rounded-xl p-3">ไปหน้าเข้าสู่ระบบ</Link></div> : <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={busy || preparing} className="space-y-4 disabled:opacity-60">
          <div className="register-fields">{([
            ["name", "ชื่อ-นามสกุล", "text", 120], ["nickname", "ชื่อเล่น", "text", 60], ["studentId", "รหัสนักศึกษา", "text", 20], ["studentEmail", "อีเมลนักศึกษา", "email", 254], ["phone", "เบอร์โทรศัพท์", "tel", 10], ["password", "รหัสผ่าน (อย่างน้อย 6 ตัว)", "password", 128], ["confirmPassword", "ยืนยันรหัสผ่าน", "password", 128],
          ] as const).map(([key, label, type, maxLength]) => <label key={key} className="block text-sm font-medium">{label} <span className="text-red-600">*</span>
            <input required name={key} type={type} minLength={type === "password" ? 6 : undefined} maxLength={maxLength} inputMode={key === "phone" ? "numeric" : type === "email" ? "email" : "text"} pattern={key === "phone" ? "0[0-9]{9}" : key === "studentId" ? "[A-Za-z0-9-]{4,20}" : undefined} autoComplete={type === "password" ? "new-password" : key === "name" ? "name" : key === "phone" ? "tel" : key === "studentId" ? "off" : type === "email" ? "email" : "nickname"} value={form[key]} onChange={e => setForm({ ...form, [key]: type === "email" ? e.target.value.toLowerCase() : e.target.value })} className="block mt-1 border border-gray-300 rounded-lg p-3 w-full" />
          </label>)}</div>
          <label className="block text-sm font-medium">สำเนาบัตรประชาชน <span className="text-red-600">* จำเป็น</span>
            <input required type="file" accept="image/jpeg,image/png,image/webp" onChange={e => void choose(e.target.files?.[0])} className="block mt-2 w-full text-sm" />
          </label>
          <p className="text-xs text-gray-500">JPG, PNG หรือ WebP ไม่เกิน 20 MB กรุณาใช้ภาพที่อ่านชัด และใส่ลายน้ำ “ใช้สมัคร VR Tracker เท่านั้น”</p>
          {preview && <img src={preview} alt="ตัวอย่างสำเนาบัตรก่อนส่ง" className="max-h-56 w-full object-contain rounded-lg" />}
          <label className="flex gap-2 items-start text-sm"><input required type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" /><span>ยืนยันส่งสำเนาบัตรประชาชนเพื่อประกอบการสมัครบัญชี VR Tracker</span></label>
          <button type="submit" disabled={!photo || !consent} className="w-full bg-black text-white rounded-xl p-3 disabled:opacity-40">{busy ? "กำลังสมัคร..." : "สร้างบัญชีผู้ใช้"}</button>
        </fieldset>
        {preparing && <p role="status">กำลังเตรียมรูปเอกสาร...</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {!busy && <Link to="/" className="block text-center text-sm underline">กลับไปเข้าสู่ระบบ</Link>}
      </form>}
    </div>
  </main>;
}
