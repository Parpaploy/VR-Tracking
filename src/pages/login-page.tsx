import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchUsers, fetchAndVerifyPin } from "../lib/auth.services";
import { useAuth } from "../hooks/use-auth";
import type { IUserOption } from "../interfaces/user.interface";
import { IoIosArrowDown } from "react-icons/io";
import Swal from "sweetalert2";

export default function LoginPage() {
  const { login, session } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<IUserOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [pin, setPin] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [shake, setShake] = useState<boolean>(false);

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) return;
    navigate(session.role === "admin" ? "/admin" : "/private", {
      replace: true,
    });
  }, [session, navigate]);

  useEffect(() => {
    fetchUsers()
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch(async (err: Error) => {
        setLoading(false);

        await Swal.fire({
          icon: "error",
          title: "โหลดข้อมูลไม่สำเร็จ",
          text: err.message,
          confirmButtonColor: "#dc2626",
        });
      });
  }, [session]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 300);
  };

  const handlePad = (digit: string) => {
    if (pin.length >= 4 || verifying) return;
    const next = pin + digit;
    setPin(next);
    setError("");
    if (next.length === 4) verify(next);
  };

  const handleBack = () => {
    if (verifying) return;
    setPin((p) => p.slice(0, -1));
    setError("");
  };

  const verify = async (inputPin: string) => {
    try {
      setVerifying(true);

      const result = await fetchAndVerifyPin(selectedId, inputPin);

      if (result.success && result.session) {
        login(result.session);
      } else {
        triggerShake();
        setPin("");
        setError("PIN ไม่ถูกต้อง");
        setVerifying(false);
      }
    } catch (err: unknown) {
      setVerifying(false);

      let message = "กรุณาลองใหม่อีกครั้ง";

      if (err instanceof Error) {
        message = err.message;
      }

      setError(message);
    }
  };

  const selectedUser = users.find((u) => u.id === selectedId);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black">
      <section className="h-[25%] w-full p-10 text-center text-white">
        <h1 className="text-[24px] font-bold mb-3">VR Tracker · เข้าสู่ระบบ</h1>

        {loading ? (
          <div className="w-full 2xl:h-20 lg:h-15 md:h-18 h-12 flex justify-center items-center bg-white rounded-xl mb-5">
            <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen((o) => !o)}
              className="w-full 2xl:h-20 lg:h-15 md:h-18 h-12 px-4 rounded-xl border border-gray-300 bg-white text-left text-gray-700 flex items-center justify-between focus:outline-none focus:ring-0 focus:ring-offset-0"
            >
              <span
                className={`${selectedUser ? "font-bold" : ""} 2xl:text-[24px] text-[18px] text-black`}
              >
                {selectedUser ? selectedUser.nickname : "เลือกบัญชีผู้ใช้"}
              </span>
              <span
                className={`transition-transform ${open ? "-rotate-180" : ""}`}
              >
                <IoIosArrowDown size={24} />
              </span>
            </button>

            {open && (
              <div className="animate-fadeIn bg-white border border-gray-200 absolute z-10 mt-2 w-full rounded-[10px] shadow-lg 2xl:max-h-100 xl:max-h-75 lg:max-h-60 md:max-h-80 max-h-50 overflow-y-auto">
                {users
                  .filter((u) => u.status === "active")
                  .map((u) => (
                    <div
                      key={u.id}
                      onClick={() => {
                        setSelectedId(u.id);
                        setPin("");
                        setError("");
                        setOpen(false);
                      }}
                      className={`${
                        u.nickname === selectedUser?.nickname
                          ? "text-black"
                          : "text-black/50"
                      } md:text-left text-center bg-white font-bold text-[18px] 2xl:text-[24px] px-4 py-3 transition`}
                    >
                      <span className="md:hidden block">{u.nickname}</span>
                      <span className="md:block hidden">
                        {u.name} ({u.nickname})
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="relative text-black rounded-t-[30px] p-10 pb-7 w-full h-[75%] flex flex-col justify-start items-center backdrop-blur-3xl bg-white transition-all duration-300">
        <div className={`${shake ? "animate-shake" : ""} w-full`}>
          <div className="flex justify-center gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`xl:w-12 xl:h-12 md:w-10 md:h-10 w-7 h-7 rounded-full border-2 transition-all duration-150 ${
                  pin.length > i ? "bg-black" : "bg-transparent border-black/20"
                } ${!selectedId ? "opacity-30" : ""}`}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 h-5 flex items-center justify-center">
          {verifying ? (
            <span className="text-[16px] text-black/30">กำลังตรวจสอบ...</span>
          ) : error ? (
            <span className="text-[16px] text-red-400">{error}</span>
          ) : (
            <span className="text-transparent text-[16px]">placeholder</span>
          )}
        </div>

        <div
          className={`2xl:mt-7 md:mt-5 mt-3 justify-items-center lg:w-[50%] md:w-[70%] w-full grid grid-cols-3 xl:gap-3 lg:gap-5 md:gap-10 gap-2.5 text-[18px] font-semibold transition-opacity duration-200 ${!selectedId ? "opacity-30 pointer-events-none" : ""}`}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              onClick={() => handlePad(String(n))}
              disabled={verifying}
              className="2xl:h-35 xl:h-20 lg:h-17 md:h-30 h-20 w-auto aspect-square rounded-full bg-white border border-white/20 shadow-[0px_1px_4px_0px_#00000040] active:scale-95 active:bg-black/10 transition-all duration-100 disabled:text-black/50"
            >
              {n}
            </button>
          ))}
          <div />
          <button
            onClick={() => handlePad("0")}
            disabled={verifying}
            className="2xl:h-35 xl:h-20 lg:h-17 md:h-30 h-20 w-auto aspect-square rounded-full bg-white border border-white/20 shadow-[0px_1px_4px_0px_#00000040] active:scale-95 active:bg-black/10 transition-all duration-100 disabled:text-black/50"
          >
            0
          </button>
          <button
            onClick={handleBack}
            disabled={verifying}
            className="2xl:h-35 xl:h-20 lg:h-17 md:h-30 h-20 w-auto aspect-square rounded-full bg-white border border-white/20 shadow-[0px_1px_4px_0px_#00000040] active:scale-95 active:bg-black/10 transition-all duration-100 disabled:text-black/50"
          >
            ⌫
          </button>
        </div>
      </section>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-10px); }
          40%, 80% { transform: translateX(10px); }
        }
        .animate-shake { animation: shake 0.4s ease; }
      `}</style>
    </div>
  );
}
