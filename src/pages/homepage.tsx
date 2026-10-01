import { useNavigate } from "react-router-dom";

export default function Homepage() {
  const navigate = useNavigate();

  return (
    <main className="w-full h-full p-4 flex flex-col gap-6 bg-white">
      <h1 className="font-bold text-[24px]">เมนูสำหรับผู้ใช้</h1>

      <div className="w-ful h-fulll flex-1 flex flex-col items-center justify-start gap-4">
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
      </div>
    </main>
  );
}
