import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/use-auth";
import { FaEdit } from "react-icons/fa";
import {
  createUser,
  deleteUser,
  fetchUsers,
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

export default function UserManagementPage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<ICreateUserPayload>(EMPTY_FORM);
  const [pinConfirm, setPinConfirm] = useState<string>("");
  const [users, setUsers] = useState<IUserListItem[]>([]);
  const [saving, setSaving] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [tab, setTab] = useState<"list" | "create">("list");
  const [selectedUser, setSelectedUser] = useState<IUserListItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    nickname: "",
    phone: "",
    role: "user" as "admin" | "user",
    status: "active" as "active" | "suspend",
    pin: "",
  });
  const [editPinConfirm, setEditPinConfirm] = useState<string>("");

  const [isLoading, setIsLoading] = useState(true);

  const isFormValid =
    form.name.trim().length > 0 &&
    form.nickname.trim().length > 0 &&
    form.phone.trim().length === 10 &&
    form.pin.length === 4 &&
    pinConfirm.length === 4 &&
    form.pin === pinConfirm;

  useEffect(() => {
    if (session?.role !== "admin") navigate("/private", { replace: true });
  }, [session, navigate]);

  const loadUsers = async () => {
    const data = await fetchUsers();
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
        const data = await fetchUsers();
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
    setForm((prev) => ({ ...prev, [name]: value }));
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
      title: "ยืนยันการลบ?",
      text: `ต้องการลบบัญชี "${nickname}" ใช่หรือไม่`,
      showCancelButton: true,
      confirmButtonText: "ลบ",
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
        title: "ลบสำเร็จ",
        text: `ลบบัญชี "${nickname}" แล้ว`,
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

  const isPinValid =
    editForm.pin.length === 0 ||
    (editForm.pin.length === 4 &&
      editPinConfirm.length === 4 &&
      editForm.pin === editPinConfirm);

  const isEditChanged =
    selectedUser &&
    (editForm.name !== selectedUser.name ||
      editForm.nickname !== selectedUser.nickname ||
      editForm.phone !== selectedUser.phone ||
      editForm.role !== selectedUser.role ||
      editForm.status !== selectedUser.status ||
      editForm.pin.length > 0) &&
    isPinValid;

  const tabIndex = USER_TABS.findIndex((t) => t.key === tab);
  const isLastTab = tabIndex === USER_TABS.length - 1;

  if (session?.role !== "admin") return null;

  return (
    <main
      className={`w-full h-[90svh] flex flex-col gap-y-5 min-h-0 p-3 bg-white text-black ${tab === "create" ? "pb-5" : "pb-0"}`}
    >
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
                PIN 4 หลัก <span className="text-red-400">*</span>
              </label>
              <input
                name="pin"
                type="password"
                value={form.pin}
                autoComplete="one-time-code"
                inputMode="numeric"
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    pin: e.target.value.replace(/\D/g, ""),
                  }))
                }
                placeholder="••••"
                maxLength={4}
                className="w-full h-11 px-4 rounded-[10px] bg-white border border-black/20 text-black text-xl text-center tracking-[0.4em] placeholder:text-black/30 placeholder: placeholder:tracking-normal focus:outline-none focus:ring-0 focus:ring-offset-0 transition-all"
              />
            </div>
            <div>
              <label className="block uppercase tracking-widest mb-1.5">
                ยืนยัน PIN <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={pinConfirm}
                autoComplete="one-time-code"
                inputMode="numeric"
                onChange={(e) => {
                  setPinConfirm(e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                placeholder="••••"
                maxLength={4}
                className={`w-full h-11 px-4 rounded-[10px] bg-white border text-xl text-center tracking-[0.4em] placeholder:text-black/30 placeholder: placeholder:tracking-normal focus:outline-none focus:ring-0 focus:ring-offset-0 transition-all ${
                  pinConfirm && form.pin !== pinConfirm
                    ? "border-red-500/50 focus:border-red-500"
                    : pinConfirm && form.pin === pinConfirm
                      ? "border-emerald-500/50 focus:border-emerald-500"
                      : "border-black/20 focus:outline-none focus:ring-0 focus:ring-offset-0"
                }`}
              />
            </div>

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
              disabled={saving || !isFormValid}
              className={`rounded-[10px] py-3 text-white transition-all active:scale-[0.98] mt-1 bg-black ${
                saving || !isFormValid ? "opacity-50" : "opacity-100"
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
        <div className="flex text-[18px] flex-col gap-y-3 justify-start items-center w-full h-full pb-5 overflow-y-auto">
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
                    className={`w-full flex items-center gap-3 ${u.status === "active" ? "bg-white" : "bg-black/10"} border border-black/7 px-5 py-2 rounded-[10px]`}
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
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedUser(u);
                          setEditForm({
                            name: u.name,
                            nickname: u.nickname,
                            phone: u.phone,
                            role: u.role,
                            status: u.status,
                            pin: "",
                          });
                          setEditPinConfirm("");
                        }}
                        className="text-black/30 transition-colors p-1.5 rounded-[10px]"
                      >
                        <FaEdit size={18} />
                      </button>

                      {u.id !== session?.id && (
                        <button
                          onClick={() => handleDelete(u.id, u.nickname)}
                          disabled={deleting === u.id}
                          className="text-black/30 disabled:opacity-30 transition-colors p-1.5 rounded-[10px]"
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
        <div className="mx-auto fixed inset-0 bg-black/40 flex items-center justify-center z-99">
          <div className="relative bg-white lg:w-[35%] w-[85%] lg:h-[85%] h-[70%] rounded-[10px] shadow-xl p-6 pb-0 flex flex-col">
            <h2 className="text-[24px] font-bold mb-2">แก้ไขบัญชี</h2>

            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-3 right-3 border border-black/10 rounded-full p-2"
            >
              <RxCross2 size={18} />
            </button>

            <div className="text-[18px] w-full h-full flex flex-col gap-4 overflow-y-auto pt-2 pb-6">
              <div className="w-full">
                <label className="block text-[18px] text-black/50 mb-1">
                  ชื่อ-นาสกุล
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
                <label className="block text-black/50 mb-1">
                  PIN ใหม่ (4 หลัก)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editForm.pin}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      pin: e.target.value.replace(/\D/g, ""),
                    }))
                  }
                  placeholder="••••"
                  autoComplete="off"
                  maxLength={4}
                  style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
                  className="w-full h-11 px-4 rounded-[10px] bg-white border border-black/20 text-[18px] text-center tracking-[0.4em] placeholder:text-black/30 focus:outline-none focus:ring-0 focus:ring-offset-0 transition-all"
                />
              </div>

              <div>
                <label className="block text-black/50 mb-1">ยืนยัน PIN</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editPinConfirm}
                  autoComplete="off"
                  onChange={(e) =>
                    setEditPinConfirm(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="••••"
                  maxLength={4}
                  style={{ WebkitTextSecurity: "disc" } as React.CSSProperties}
                  className={`w-full h-11 px-4 rounded-[10px] bg-white border text-[18px] text-center tracking-[0.4em] placeholder:text-black/30 focus:outline-none focus:ring-0 focus:ring-offset-0 transition-all ${
                    editPinConfirm && editForm.pin !== editPinConfirm
                      ? "border-red-500/50"
                      : editPinConfirm && editForm.pin === editPinConfirm
                        ? "border-emerald-500/50"
                        : "border-black/20"
                  }`}
                />
              </div>

              <div>
                <label className="block  text-black">Role</label>
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
                <label className="block text-black mb-1">Status</label>
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
                disabled={!isEditChanged}
                onClick={async () => {
                  if (!isEditChanged) return;

                  try {
                    Swal.fire({
                      title: "กำลังบันทึก...",
                      allowOutsideClick: false,
                      allowEscapeKey: false,
                      didOpen: () => Swal.showLoading(),
                    });

                    const result = await updateUser(selectedUser!.id, {
                      ...editForm,
                      pin: editForm.pin.length === 4 ? editForm.pin : undefined,
                    });

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
