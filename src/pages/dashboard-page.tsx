import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean>(true);

  return (
    <main className="w-full h-full p-4 flex flex-col gap-6 bg-white">
      <div className="w-full justify-between flex items-center">
        <h1 className="font-bold text-[24px]">
          {isAdmin ? "เมนูสำหรับแอดมิน" : "เมนูสำหรับผู้ใช้"}
        </h1>

        <div className="lg:w-[15%] md:w-[25%] w-[40%] relative flex bg-gray-100 rounded-full p-1">
          <div
            className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full shadow transform transition-all duration-300 ${
              isAdmin
                ? "translate-x-full bg-blue-900"
                : "translate-x-0 bg-black"
            }`}
          />

          <button
            onClick={() => setIsAdmin(false)}
            className={`relative z-10 w-1/2 py-1.5 rounded-full text-[18px] font-bold ${
              !isAdmin ? "text-white" : "text-gray-500"
            }`}
          >
            ผู้ใช้
          </button>

          <button
            onClick={() => setIsAdmin(true)}
            className={`relative z-10 w-1/2 py-1.5 rounded-full text-[18px] font-bold ${
              isAdmin ? "text-white" : "text-gray-500"
            }`}
          >
            แอดมิน
          </button>
        </div>
      </div>

      <div className="w-full h-fulll flex-1 flex lg:flex-row flex-col lg:items-start items-center justify-start gap-4">
        {isAdmin ? (
          <>
            <button
              onClick={() => navigate("/admin/vr-management")}
              className="w-full p-5 rounded-[20px] bg-blue-900 text-white text-[18px] font-bold text-center"
            >
              Dashboard
            </button>

            <button
              onClick={() => navigate("/admin/vr")}
              className="w-full p-5 rounded-[20px] bg-blue-900 text-white text-[18px] font-bold text-center"
            >
              เช็คสถานะอุปกรณ์ VR
            </button>

            <button
              onClick={() => navigate("/admin/user-management")}
              className="w-full p-5 rounded-[20px] bg-blue-900 text-white text-[18px] font-bold text-center"
            >
              จัดการผู้ใช้
            </button>

            <button
              onClick={() => navigate("/admin/driver-management")}
              className="w-full p-5 rounded-[20px] bg-blue-900 text-white text-[18px] font-bold text-center"
            >
              จัดการคนขับรถประจำวัน
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => navigate("/private/truck")}
              className="w-full p-5 rounded-[20px] bg-black text-white text-[18px] font-bold text-center"
            >
              ย้ายอุปกรณ์ VRขึ้นรถ
            </button>

            <button
              onClick={() => navigate("/private/store")}
              className="w-full p-5 rounded-[20px] bg-black text-white text-[18px] font-bold text-center"
            >
              ย้ายอุปกรณ์ VRลงร้าน
            </button>

            <button
              onClick={() => navigate("/private/warehouse/WAREHOUSE-001")}
              className="w-full p-5 rounded-[20px] bg-black text-white text-[18px] font-bold text-center"
            >
              คืนอุปกรณ์ VRให้บริษัท
            </button>
          </>
        )}
      </div>
    </main>
  );
}
