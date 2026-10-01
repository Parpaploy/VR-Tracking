import { STATUS_COLOR, STATUS_LABEL } from "../constants/label";
import type { IVR } from "../interfaces/data.interface";
import { RxCross2 } from "react-icons/rx";

export const LocationDetailPopup = ({
  title,
  subtitle,
  subtitleValue,
  loadingSubtitle,
  good,
  minor,
  major,
  borrowed,
  total,
  devices: modalDevices,
  onClose,
}: {
  title: string;
  subtitle: string;
  subtitleValue: string | null;
  loadingSubtitle: boolean;
  good: number;
  minor: number;
  major: number;
  borrowed: number;
  total: number;
  devices: IVR[];
  onClose: () => void;
}) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-99">
    <div className="relative bg-white lg:w-[35%] w-[85%] lg:h-[85%] h-[70%] rounded-[10px] p-6 shadow-xl flex flex-col gap-4">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 border border-black/10 rounded-full p-2"
      >
        <RxCross2 size={18} />
      </button>

      <div>
        <h2 className="text-[22px] font-bold max-w-[90%]">{title}</h2>
        <p className="text-sm text-black/40 mt-0.5">
          {subtitle}:{" "}
          {loadingSubtitle ? (
            <span className="text-black/30">กำลังโหลด...</span>
          ) : subtitleValue ? (
            <span className="text-black font-bold">{subtitleValue}</span>
          ) : (
            <span className="text-black/30">ไม่มีข้อมูล</span>
          )}
        </p>
      </div>

      <div className="overflow-y-auto">
        <div className="grid md:grid-cols-4 grid-cols-2 gap-3">
          <div className="rounded-xl bg-emerald-50 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{good}</p>
            <p className="text-sm text-emerald-700 mt-1">ปกติ</p>
          </div>
          <div className="rounded-xl bg-yellow-50 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{minor}</p>
            <p className="text-sm text-yellow-700 mt-1">มีตำหนิ</p>
          </div>
          <div className="rounded-xl bg-red-50 p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{major}</p>
            <p className="text-sm text-red-700 mt-1">ชำรุด</p>
          </div>

          <div className="rounded-xl bg-blue-50 p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{borrowed}</p>
            <p className="text-sm text-blue-700 mt-1">ยืม</p>
          </div>
        </div>

        <div className="flex justify-between items-center px-1 mt-3 mb-1">
          <p className="text-sm text-black/40">รวมทั้งหมด</p>
          <p className="text-[20px] font-bold">{total} เครื่อง</p>
        </div>

        <div className="flex flex-col gap-2">
          {modalDevices.length === 0 ? (
            <p className="text-center text-black/20 py-4">ไม่มีอุปกรณ์ VR</p>
          ) : (
            modalDevices.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between px-4 py-2 rounded-[10px] border border-black/[0.07]"
              >
                <p className="font-bold text-[16px]">{g.id}</p>
                <span
                  className={`text-[13px] font-bold px-3 py-1 rounded-full ${STATUS_COLOR[g.status]}`}
                >
                  {STATUS_LABEL[g.status]}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  </div>
);
