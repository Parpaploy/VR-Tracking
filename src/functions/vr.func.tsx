import { RxCross2 } from "react-icons/rx";
import {
  IoIosArrowForward,
  IoIosArrowUp,
  IoIosArrowDown,
  IoIosArrowBack,
} from "react-icons/io";

export const DateFilterRow = ({
  calendarOpen,
  setCalendarOpen,
  selectedDate,
  setSelectedDate,
  loadingTxDates,
  calendarMonth,
  setCalendarMonth,
  calendarDays,
  activeDates,
}: {
  calendarOpen: boolean;
  setCalendarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  loadingTxDates: boolean;
  calendarMonth: Date;
  setCalendarMonth: React.Dispatch<React.SetStateAction<Date>>;
  calendarDays: (string | null)[];
  activeDates: Set<string>;
}) => (
  <div className="flex items-center gap-2 relative">
    <button
      onClick={() => setCalendarOpen((v) => !v)}
      className={`flex-1 flex items-center justify-between px-3 py-2.5 border rounded-[10px] text-[13px] font-bold bg-white transition-all ${selectedDate ? "border-black text-black" : "border-black/10 text-black/40"}`}
    >
      <span>
        {loadingTxDates
          ? "กำลังโหลด..."
          : selectedDate
            ? new Date(selectedDate + "T00:00:00").toLocaleDateString("th-TH", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
            : "เลือกวันที่"}
      </span>
      <span className="text-black/30 text-xs">
        {calendarOpen ? (
          <IoIosArrowUp size={24} />
        ) : (
          <IoIosArrowDown size={24} />
        )}
      </span>
    </button>
    {selectedDate && (
      <button
        onClick={() => {
          setSelectedDate("");
          setCalendarOpen(false);
        }}
        className="flex items-center justify-center p-2.5 border border-black/10 rounded-[10px] bg-white active:scale-95 transition-all"
      >
        <RxCross2 className="text-gray-400" size={24} />
      </button>
    )}

    {calendarOpen && (
      <div className="flex flex-col absolute top-full left-0 right-0 mt-1">
        <div className="bg-white border border-black/10 rounded-[14px] shadow-lg z-50 p-3">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() =>
                setCalendarMonth(
                  (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1),
                )
              }
              className="p-1.5 rounded-[7px] hover:bg-black/5 text-black/50 font-bold text-sm"
            >
              <IoIosArrowBack size={16} />
            </button>
            <span className="text-[13px] font-bold text-black">
              {calendarMonth.toLocaleDateString("th-TH", {
                year: "numeric",
                month: "long",
              })}
            </span>
            <button
              onClick={() =>
                setCalendarMonth(
                  (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1),
                )
              }
              className="p-1.5 rounded-[7px] hover:bg-black/5 text-black/50 font-bold text-sm"
            >
              <IoIosArrowForward size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => (
              <div
                key={d}
                className="text-center text-[11px] text-black/30 font-bold py-1"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {calendarDays.map((dateStr, i) => {
              if (!dateStr) return <div key={`empty-${i}`} />;
              const hasData = activeDates.has(dateStr);
              const isSelected = selectedDate === dateStr;
              const day = parseInt(dateStr.split("-")[2]);
              return (
                <button
                  key={dateStr}
                  disabled={!hasData}
                  onClick={() => {
                    setSelectedDate(dateStr);
                    setCalendarOpen(false);
                  }}
                  className={`relative flex flex-col items-center justify-center py-1.5 rounded-[7px] text-[13px] font-bold transition-all
                        ${isSelected ? "bg-black text-white" : hasData ? "text-black hover:bg-black/5 active:scale-95" : "text-black/15 cursor-default"}`}
                >
                  {day}
                  {hasData && !isSelected && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-black/30" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-3" />
      </div>
    )}
  </div>
);
