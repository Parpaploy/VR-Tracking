import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/use-auth";
import { FaEdit } from "react-icons/fa";
import {
  createUser,
  deleteUser,
  fetchUserList,
  fetchIdentityImage,
  updateUser,
} from "../lib/auth.services";
import Swal from "sweetalert2";
import type {
  ICreateUserPayload,
  IUserListItem,
} from "../interfaces/user.interface";
import { FaTrash } from "react-icons/fa";
import { EMPTY_FORM, USER_TABS } from "../constants/label";
import { RxCross2 } from "react-icons/rx";
import { compressPhoto } from "../lib/cloudinary";

export default function UserManagementPage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<ICreateUserPayload>(EMPTY_FORM);
  const [pinConfirm, setPinConfirm] = useState<string>("");
  const [identityPreview, setIdentityPreview] = useState("");
  const [identityBusy, setIdentityBusy] = useState(false);
  const [users, setUsers] = useState<IUserListItem[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [tab, setTab] = useState<"list" | "create">("list");
  const [selectedUser, setSelectedUser] = useState<IUserListItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    nickname: "",
    studentId: "",
    studentEmail: "",
    phone: "",
    role: "user" as "admin" | "user",
    status: "active" as "active" | "suspend",
    identityImage: "",
    consent: false,
  });
  const [identityOriginalUrl, setIdentityOriginalUrl] = useState("");
  const [identityLoading, setIdentityLoading] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  const isFormValid =
    form.name.trim().length > 0 &&
    form.nickname.trim().length > 0 &&
    /^[A-Za-z0-9-]{4,20}$/.test(form.studentId.trim()) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.studentEmail.trim()) &&
    Boolean(form.identityImage) &&
    form.consent &&
    form.phone.trim().length === 10 &&
    form.password.length >= 6 &&
    pinConfirm.length >= 6 &&
    form.password === pinConfirm;

  useEffect(() => {
    if (session?.role !== "admin") navigate("/private", { replace: true });
  }, [session, navigate]);

  const loadUsers = async () => {
    const data = await fetchUserList();
    setUsers(data);
  };

  useEffect(() => {
    if (selectedUser) {
      const scrollBarWidth =
        window.innerWidth - document.documentElement.clientWidth;

      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = `${scrollBarWidth}px`;
    } else {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [selectedUser]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const data = await fetchUserList();
        setUsers(data);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: name === "studentEmail" ? value.toLowerCase() : value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      Swal.fire({
        title: "กำลังดำเนินการ...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });

      const result = await createUser(form);

      Swal.close();

      if (!result.success) {
        setSaving(false);

        await Swal.fire({
          icon: "error",
          title: "สร้างไม่สำเร็จ",
          text: "เกิดข้อผิดพลาด",
          confirmButtonColor: "#dc2626",
        });
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "สำเร็จ",
        text: `สร้างบัญชี "${form.nickname}" เรียบร้อยแล้ว`,
        confirmButtonColor: "#000",
      });

      setForm(EMPTY_FORM);
      setPinConfirm("");
      setIdentityPreview("");
      loadUsers();
    } catch {
      Swal.close();

      await Swal.fire({
        icon: "error",
        title: "ระบบขัดข้อง",
        text: "กรุณาลองใหม่อีกครั้ง",
        confirmButtonColor: "#dc2626",
      });
    }

    setSaving(false);
  };

  const handleDelete = async (id: string, nickname: string) => {
    const confirmResult = await Swal.fire({
      icon: "warning",
      title: "ระงับบัญชี?",
      text: `ต้องการระงับบัญชี "${nickname}" ใช่หรือไม่`,
      showCancelButton: true,
      confirmButtonText: "ระงับบัญชี",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
    });

    if (!confirmResult.isConfirmed) return;

    try {
      setDeleting(id);

      await deleteUser(id);
      setDeleting(null);
      loadUsers();

      await Swal.fire({
        icon: "success",
        title: "ระงับบัญชีสำเร็จ",
        text: `บัญชี "${nickname}" ถูกระงับแล้ว`,
        confirmButtonColor: "#000",
      });
    } catch {
      setDeleting(null);

      await Swal.fire({
        icon: "error",
        title: "ลบไม่สำเร็จ",
        text: "เกิดข้อผิดพลาด กรุณาลองใหม่",
        confirmButtonColor: "#dc2626",
      });
    }
  };

  const isEditChanged =
    selectedUser &&
    (editForm.name !== selectedUser.name ||
      editForm.nickname !== selectedUser.nickname ||
      editForm.studentId !== (selectedUser.studentId ?? "") ||
      editForm.phone !== selectedUser.phone ||
      editForm.role !== selectedUser.role ||
      editForm.status !== selectedUser.status || Boolean(editForm.identityImage));

  const tabIndex = USER_TABS.findIndex((t) => t.key === tab);
  const isLastTab = tabIndex === USER_TABS.length - 1;

  if (session?.role !== "admin") return null;

  return (
    <main
      className="user-page flex flex-col gap-y-5"
    >
      <header className="page-heading !mb-0"><h1>จัดการผู้ใช้</h1><p>ดูแลบัญชี ข้อมูลสมาชิก และสิทธิ์การใช้งาน</p></header>
      <div className="relative flex gap-1 border border-black/[0.07] rounded-[10px] p-1 bg-white overflow-hidden min-h-15">
        <div
          className="absolute top-1 bottom-1 rounded-[10px] bg-black transition-all duration-300 ease-in-out"
          style={{
            width: `calc(${100 / USER_TABS.length}% - 6px)`,
            left: `calc(${tabIndex} * ${100 / USER_TABS.length}% + 4px ${
              isLastTab ? "- 2px" : ""
            })`,
          }}
        />

        {USER_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="relative flex-1 px-2 py-2 text-[16px] font-bold text-black z-10"
          >
            {t.label}
            <span
              className={`absolute inset-0 flex items-center justify-center text-white transition-opacity duration-300 rounded-[10px] ${
                tab === t.key ? "opacity-100" : "opacity-0"
              }`}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>

      {tab === "create" && (
        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 text-[18px] text-black"
        >
          <div className="w-full h-full overflow-y-auto overflow-x-hidden flex flex-col gap-4 px-3">
            <div>
              <label className="block uppercase tracking-widest mb-1.5">
                ชื่อ-นามสกุล <span className="text-red-400">*</span>
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="สมชาย ใจดี"
                className="w-full h-11 px-4 rounded-[10px] bg-white border border-black/20 placeholder:text-black/30 focus:outline-none focus:ring-0 focus:ring-offset-0 transition-all"
              />
            </div>
            <div>
              <label className="block uppercase tracking-widest mb-1.5">
                ชื่อเล่น <span className="text-red-400">*</span>
              </label>
              <input
                name="nickname"
                value={form.nickname}
                onChange={handleChange}
                placeholder="ชาย"
                className="w-full h-11 px-4 rounded-[10px] bg-white border border-black/20 placeholder:text-black/30 focus:outline-none focus:ring-0 focus:ring-offset-0 transition-all"
              />
            </div>
            <div>
              <label className="block uppercase tracking-widest mb-1.5">
                รหัสนักศึกษา <span className="text-red-400">*</span>
              </label>
              <input name="studentId" required minLength={4} maxLength={20} pattern="[A-Za-z0-9-]{4,20}" value={form.studentId} onChange={handleChange} placeholder="เช่น 65123456" className="w-full h-11 px-4 rounded-[10px] bg-white border border-black/20 placeholder:text-black/30 focus:outline-none transition-all" />
            </div>

            <div>
              <label className="block uppercase tracking-widest mb-1.5">อีเมลนักศึกษา <span className="text-red-400">*</span></label>
              <input name="studentEmail" type="email" required maxLength={254} value={form.studentEmail} onChange={handleChange} placeholder="name@student.ac.th" className="w-full h-11 px-4 rounded-[10px] bg-white border border-black/20 placeholder:text-black/30 focus:outline-none transition-all" />
            </div>

            <div>
              <label className="block uppercase tracking-widest mb-1.5">
                เบอร์โทรศัพท์ <span className="text-red-400">*</span>
              </label>
              <input
                name="phone"
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    phone: e.target.value.replace(/\D/g, ""),
                  }))
                }
                placeholder="0812345678"
                maxLength={10}
                className="w-full h-11 px-4 rounded-[10px] bg-white border border-black/20 text-black  placeholder:text-black/30 focus:outline-none focus:ring-0 focus:ring-offset-0 transition-all"
              />
            </div>

            <div>
              <label className="block uppercase tracking-widest mb-1.5">
              รหัสผ่าน (อย่างน้อย 6 ตัว) <span className="text-red-400">*</span>
              </label>
              <input
                name="password"
                type="password"
                value={form.password}
                autoComplete="new-password"
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    password: e.target.value,
                  }))
                }
                placeholder="อย่างน้อย 6 ตัวอักษร"
                minLength={6}
                maxLength={128}
                className="w-full h-11 px-4 rounded-[10px] bg-white border border-black/20 text-black text-xl text-center tracking-[0.4em] placeholder:text-black/30 placeholder: placeholder:tracking-normal focus:outline-none focus:ring-0 focus:ring-offset-0 transition-all"
              />
            </div>
            <div>
              <label className="block uppercase tracking-widest mb-1.5">
                ยืนยันรหัสผ่าน <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={pinConfirm}
                autoComplete="new-password"
                onChange={(e) => {
                  setPinConfirm(e.target.value);
                  setError("");
                }}
                placeholder="ยืนยันรหัสผ่าน"
                minLength={6}
                className={`w-full h-11 px-4 rounded-[10px] bg-white border text-xl text-center tracking-[0.4em] placeholder:text-black/30 placeholder: placeholder:tracking-normal focus:outline-none focus:ring-0 focus:ring-offset-0 transition-all ${
                  pinConfirm && form.password !== pinConfirm
                    ? "border-red-500/50 focus:border-red-500"
                    : pinConfirm && form.password === pinConfirm
                      ? "border-emerald-500/50 focus:border-emerald-500"
                      : "border-black/20 focus:outline-none focus:ring-0 focus:ring-offset-0"
                }`}
              />
            </div>

            <div>
              <label className="block uppercase tracking-widest mb-1.5">
                สำเนาบัตรประชาชน <span className="text-red-400">* จำเป็น</span>
              </label>
              <input type="file" required accept="image/jpeg,image/png,image/webp" disabled={identityBusy || saving} onChange={async e => {
                const file = e.target.files?.[0]; e.target.value = "";
                setForm(p => ({ ...p, identityImage: "" })); setIdentityPreview(""); setError("");
                if (!file) return;
                setIdentityBusy(true);
                try {
                  const blob = await compressPhoto(file);
                  const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("อ่านเอกสารไม่สำเร็จ")); reader.readAsDataURL(blob); });
                  setForm(p => ({ ...p, identityImage: dataUrl })); setIdentityPreview(dataUrl);
                } catch (err) { setError(err instanceof Error ? err.message : "อ่านเอกสารไม่สำเร็จ"); }
                finally { setIdentityBusy(false); }
              }} className="w-full text-sm" />
              <p className="mt-1 text-xs text-black/50">JPG, PNG หรือ WebP ไม่เกิน 20 MB · ระบบย่อภาพก่อนส่ง</p>
              {identityBusy && <p className="text-sm">กำลังเตรียมรูป…</p>}
              {identityPreview && <img src={identityPreview} alt="ตัวอย่างสำเนาบัตรประชาชน" className="mt-2 max-h-48 w-full rounded-lg object-contain" />}
            </div>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={form.consent} onChange={e => setForm(p => ({ ...p, consent: e.target.checked }))} className="mt-1" /><span>ยืนยันส่งสำเนาบัตรประชาชนเพื่อประกอบการสร้างบัญชี</span></label>

            <div>
              <label className="block  text-black mb-1.5">Role</label>
              <div className="flex gap-2">
                {(["user", "admin"] as const).map((r) => (
                  <button
                    type="button"
                    key={r}
                    onClick={() => setForm((p) => ({ ...p, role: r }))}
                    className={`w-full py-3 text-[18px] rounded-[10px] border transition-all ${
                      form.role === r
                        ? r === "admin"
                          ? "bg-black text-white"
                          : "bg-black text-white"
                        : "bg-white border-black/20 text-black/40"
                    }`}
                  >
                    {r === "admin" ? "แอดมิน" : "ผู้ใช้"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-black mb-1.5">Status</label>
              <div className="flex gap-2">
                {(["active", "suspend"] as const).map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setForm((p) => ({ ...p, status: s }))}
                    className={`w-full py-3 text-[18px] rounded-[10px] border transition-all ${
                      form.status === s
                        ? s === "active"
                          ? "bg-black text-white"
                          : "bg-black text-white"
                        : "bg-white border-black/20 text-black/40"
                    }`}
                  >
                    {s === "active" ? "ใช้งานได้" : "ระงับการใช้งาน"}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-[10px]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving || identityBusy || !isFormValid}
              className={`rounded-[10px] py-3 text-white transition-all active:scale-[0.98] mt-1 bg-black ${
                saving || identityBusy || !isFormValid ? "opacity-50" : "opacity-100"
              }`}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  กำลังสร้าง...
                </span>
              ) : (
                "สร้างบัญชี"
              )}
            </button>
          </div>
        </form>
      )}

      {tab === "list" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start w-full pb-5">
          {isLoading ? (
            <div className="flex flex-1 justify-center items-center w-full text-gray-500">
              <div className="w-18 h-18 border-6 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="w-full h-full flex justify-center items-center text-center text-black/20 px-3">
              ยังไม่มีผู้ใช้งาน
            </div>
          ) : (
            <>
              {[...users]
                .sort((a, b) => {
                  if (a.role !== b.role) {
                    if (a.role === "admin") return -1;
                    if (b.role === "admin") return 1;
                  }

                  if (a.status !== b.status) {
                    if (a.status === "active") return -1;
                    if (b.status === "active") return 1;
                  }

                  return 0;
                })
                .map((u) => (
                  <div
                    key={u.id}
                    className={`w-full h-full flex items-center gap-3 ${u.status === "active" ? "bg-white" : "bg-black/10"} border border-black/7 px-5 py-5 rounded-2xl`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="pb-1 font-bold truncate">
                        {u.name}
                        <span
                          className={`text-[14px] font-bold px-3 py-1 rounded-full ml-2 ${
                            u.role === "admin"
                              ? "bg-black text-white"
                              : "bg-black/10 text-black/60"
                          }`}
                        >
                          {u.role === "admin" ? "แอดมิน" : "ผู้ใช้"}
                        </span>
                      </p>
                      <p className="mb-3">({u.nickname})</p>
                      <p className="text-black/30">เบอร์โทร: {u.phone}</p>
                      {u.studentId && <p className="text-black/30">รหัสนักศึกษา: {u.studentId}</p>}
                      {u.studentEmail && <p className="text-black/30 truncate">อีเมลนักศึกษา: {u.studentEmail}</p>}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedUser(u);
                          setEditForm({
                            name: u.name,
                            nickname: u.nickname,
                            studentId: u.studentId ?? "",
                            studentEmail: u.studentEmail ?? "",
                            phone: u.phone,
                            role: u.role,
                            status: u.status,
                            identityImage: "",
                            consent: false,
                          });
                          setIdentityPreview("");
                          setIdentityOriginalUrl("");
                          setIdentityLoading(true);
                          void fetchIdentityImage(u.id).then(setIdentityOriginalUrl).catch(() => setIdentityOriginalUrl("")).finally(() => setIdentityLoading(false));
                        }}
                        aria-label={`แก้ไขบัญชี ${u.nickname}`} className="icon-button"
                      >
                        <FaEdit size={18} />
                      </button>

                      {u.id !== session?.id && (
                        <button
                          onClick={() => handleDelete(u.id, u.nickname)}
                          disabled={deleting === u.id}
                          aria-label={`ระงับบัญชี ${u.nickname}`} className="icon-button disabled:opacity-30"
                        >
                          <FaTrash size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>
      )}

      {selectedUser && (
        <div className="mx-auto fixed inset-0 bg-black/40 p-4 flex items-center justify-center z-99">
          <div role="dialog" aria-modal="true" aria-label="แก้ไขบัญชีผู้ใช้" className="relative bg-white w-full max-w-xl h-[85svh] max-h-[900px] rounded-2xl shadow-xl p-6 pb-0 flex flex-col">
            <h2 className="text-[24px] font-bold mb-2">แก้ไขบัญชี</h2>

            <button
              onClick={() => setSelectedUser(null)}
              aria-label="ปิดหน้าต่างแก้ไขบัญชี"
              className="absolute top-3 right-3 border border-black/10 rounded-full p-2"
            >
              <RxCross2 size={18} />
            </button>

            <div className="text-[18px] w-full h-full flex flex-col gap-4 overflow-y-auto pt-2 pb-6">
              <div className="w-full">
                <label className="block text-[18px] text-black/50 mb-1">
                  ชื่อ-นามสกุล
                </label>
                <input
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full h-11 px-4 rounded-[10px] bg-white border border-black/20 placeholder:text-black/30 focus:outline-none focus:ring-0 focus:ring-offset-0 transition-all"
                  placeholder="ชื่อ"
                />
              </div>

              <div className="w-full">
                <label className="block text-[18px] text-black/50 mb-1">
                  ชื่อเล่น
                </label>
                <input
                  value={editForm.nickname}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, nickname: e.target.value }))
                  }
                  className="w-full h-11 px-4 rounded-[10px] bg-white border border-black/20 placeholder:text-black/30 focus:outline-none focus:ring-0 focus:ring-offset-0 transition-all"
                  placeholder="ชื่อเล่น"
                />
              </div>

              <div className="w-full">
                <label className="block text-[18px] text-black/50 mb-1">รหัสนักศึกษา <span className="text-red-500">*</span></label>
                <input required minLength={4} maxLength={20} pattern="[A-Za-z0-9-]{4,20}" value={editForm.studentId} onChange={e => setEditForm(p => ({ ...p, studentId: e.target.value.toUpperCase() }))} className="w-full h-11 px-4 rounded-[10px] bg-white border border-black/20" placeholder="เช่น 65123456" />
              </div>
              <div className="w-full">
                <label className="block text-[18px] text-black/50 mb-1">อีเมลนักศึกษา <span className="text-red-500">*</span></label>
                <input required type="email" maxLength={254} value={editForm.studentEmail} readOnly className="w-full h-11 px-4 rounded-[10px] bg-gray-100 border border-black/20" placeholder="name@student.ac.th" />
              </div>
              <div className="w-full">
                <label className="block text-[18px] text-black/50 mb-1">สำเนาบัตรประชาชน</label>
                {identityLoading && <p className="text-sm text-black/50">กำลังโหลดสำเนาบัตรเดิม…</p>}
                {identityOriginalUrl && <img src={identityOriginalUrl} alt="สำเนาบัตรประชาชนที่บันทึกไว้" className="max-h-48 w-full rounded-lg object-contain bg-black/5" />}
                {!identityLoading && !identityOriginalUrl && <p className="text-xs text-black/50">ไม่มีเอกสารเดิม หรือโหลดเอกสารไม่สำเร็จ</p>}
                <p className="text-xs text-black/50 mt-1">เลือกไฟล์ใหม่ด้านล่างเพื่อเปลี่ยนสำเนาบัตรเดิม</p>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={async e => {
                  const file = e.target.files?.[0]; e.target.value = "";
                  setEditForm(p => ({ ...p, identityImage: "", consent: false })); setError("");
                  if (!file) return;
                  setIdentityBusy(true);
                  try {
                    const blob = await compressPhoto(file);
                    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("อ่านเอกสารไม่สำเร็จ")); reader.readAsDataURL(blob); });
                    setEditForm(p => ({ ...p, identityImage: dataUrl })); setIdentityPreview(dataUrl);
                  } catch (err) { setError(err instanceof Error ? err.message : "อ่านเอกสารไม่สำเร็จ"); }
                  finally { setIdentityBusy(false); }
                }} className="w-full text-sm" />
                <p className="text-xs text-black/50">อัปโหลดใหม่เพื่อแทนที่เอกสารเดิม · JPG, PNG หรือ WebP ไม่เกิน 20 MB</p>
                {identityPreview && <img src={identityPreview} alt="ตัวอย่างสำเนาบัตรใหม่" className="mt-2 max-h-40 w-full rounded-lg object-contain" />}
              </div>
              {editForm.identityImage && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={Boolean(editForm.consent)} onChange={e => setEditForm(p => ({ ...p, consent: e.target.checked }))} className="mt-1" /><span>ยืนยันบันทึกสำเนาบัตรประชาชนที่อัปโหลดใหม่</span></label>}
              <div className="w-full">
                <label className="block text-[18px] text-black/50 mb-1">
                  เบอร์โทร
                </label>
                <input
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      phone: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                  maxLength={10}
                  className="w-full h-11 px-4 rounded-[10px] bg-white border border-black/20 placeholder:text-black/30 focus:outline-none focus:ring-0 focus:ring-offset-0 transition-all"
                  placeholder="เบอร์โทร"
                />
              </div>

              <div>
                <label className="block text-black">สิทธิ์ผู้ใช้</label>
                <div className="flex gap-2">
                  {(["user", "admin"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setEditForm((p) => ({ ...p, role: r }))}
                      className={`flex-1 py-2 rounded-[10px] border ${
                        editForm.role === r
                          ? "bg-black text-white"
                          : "border-black/10"
                      }`}
                    >
                      {r === "admin" ? "แอดมิน" : "ผู้ใช้"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-1.5">
                <label className="block text-black mb-1">สถานะบัญชี</label>
                <div className="flex gap-2">
                  {(["active", "suspend"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setEditForm((p) => ({ ...p, status: s }))}
                      className={`flex-1 py-2 rounded-[10px] border ${
                        editForm.status === s
                          ? s === "active"
                            ? "bg-black text-white"
                            : "bg-black text-white"
                          : "border-black/10"
                      }`}
                    >
                      {s === "active" ? "ใช้งานได้" : "ระงับการใช้งาน"}
                    </button>
                  ))}
                </div>
              </div>

              <button
                disabled={!isEditChanged || identityBusy || (Boolean(editForm.identityImage) && !editForm.consent)}
                onClick={async () => {
                  if (!isEditChanged) return;

                  try {
                    Swal.fire({
                      title: "กำลังบันทึก...",
                      allowOutsideClick: false,
                      allowEscapeKey: false,
                      didOpen: () => Swal.showLoading(),
                    });

                    const result = await updateUser(selectedUser!.id, editForm);

                    setSelectedUser(null);

                    await new Promise((r) => requestAnimationFrame(r));

                    Swal.close();

                    if (!result?.success) {
                      await Swal.fire({
                        icon: "error",
                        title: "แก้ไขไม่สำเร็จ",
                        text: "เกิดข้อผิดพลาด",
                        confirmButtonColor: "#dc2626",
                      });
                      return;
                    }

                    await Swal.fire({
                      icon: "success",
                      title: "สำเร็จ",
                      text: `อัปเดตบัญชี "${editForm.nickname}" เรียบร้อยแล้ว`,
                      confirmButtonColor: "#000",
                    });

                    loadUsers();
                  } catch {
                    Swal.close();
                    await Swal.fire({
                      icon: "error",
                      title: "ระบบขัดข้อง",
                      text: "กรุณาลองใหม่อีกครั้ง",
                      confirmButtonColor: "#dc2626",
                    });
                  }
                }}
                className={`w-full rounded-[10px] py-2 text-white transition-all bg-black ${
                  !isEditChanged ? "opacity-50" : "opacity-100"
                }`}
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
