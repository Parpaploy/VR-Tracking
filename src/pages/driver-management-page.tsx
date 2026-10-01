import { useEffect, useState } from "react";
import type { ITruck } from "../interfaces/data.interface";
import {
  assignUserToTruck,
  fetchTrucks,
  unassignUserFromTruck,
} from "../lib/truck.services";
import type { IUser } from "../interfaces/user.interface";
import { fetchUsers } from "../lib/auth.services";
import { IoIosArrowDown } from "react-icons/io";
import { RxCross2 } from "react-icons/rx";
import Swal from "sweetalert2";

export default function DriverManagementPage() {
  const [trucks, setTrucks] = useState<ITruck[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<IUser[]>([]);
  const [assignMap, setAssignMap] = useState<Record<string, string>>({});
  const [initialMap, setInitialMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const [truckData, userData] = await Promise.all([
          fetchTrucks(),
          fetchUsers(),
        ]);
        setTrucks(truckData);
        setUsers(userData);

        const map: Record<string, string> = {};
        for (const truck of truckData) {
          if (truck.assignedUserId && truck.assignedUserId !== "") {
            map[truck.id] = truck.assignedUserId;
          }
        }
        setAssignMap(map);
        setInitialMap(map);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const hasChanged = trucks.some(
    (truck) => (assignMap[truck.id] ?? "") !== (initialMap[truck.id] ?? ""),
  );

  return (
    <main className="w-full h-full p-4 flex flex-col justify-between items-center bg-white">
      <div className="w-full h-full flex flex-col gap-3">
        <h2 className="text-[24px] font-bold">เลือกคนขับรถประจำวัน</h2>

        {loading ? (
          <div className="flex justify-center items-center w-full h-full text-gray-500">
            <div className="w-18 h-18 border-6 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {trucks.map((truck) => {
              const selectedUsers = Object.entries(assignMap)
                .filter(([tId]) => tId !== truck.id)
                .map(([, userId]) => userId);

              const availableUsers = users.filter(
                (u) => !selectedUsers.includes(u.id),
              );

              return (
                <div key={truck.id} className="mb-2">
                  <div className="w-full px-4 py-3 rounded-[10px] bg-gray-100 flex items-center justify-between">
                    <p>{truck.name}</p>

                    <div className="flex justify-center items-center w-fit gap-x-2">
                      <div className="relative w-fit flex items-center gap-2">
                        <select
                          value={assignMap[truck.id] || ""}
                          onChange={(e) => {
                            setAssignMap((prev) => ({
                              ...prev,
                              [truck.id]: e.target.value,
                            }));
                          }}
                          className="appearance-none text-[14px] bg-black text-white px-3 py-1.5 pr-8 rounded-[7px] focus:outline-none focus:ring-0 focus:ring-offset-0"
                        >
                          <option value="" disabled hidden>
                            เลือกคนขับ
                          </option>
                          {availableUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {window.innerWidth >= 768
                                ? `${user.name} (${user.nickname})`
                                : user.nickname}
                            </option>
                          ))}
                        </select>

                        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white">
                          <IoIosArrowDown size={20} />
                        </div>
                      </div>

                      {assignMap[truck.id] && (
                        <button
                          onClick={() =>
                            setAssignMap((prev) => {
                              const next = { ...prev };
                              delete next[truck.id];
                              return next;
                            })
                          }
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-black/8 hover:bg-black/15 text-black/40 hover:text-black transition-all"
                        >
                          <RxCross2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <button
        disabled={!hasChanged}
        onClick={async () => {
          try {
            Swal.fire({
              title: "กำลังบันทึก...",
              allowOutsideClick: false,
              allowEscapeKey: false,
              didOpen: () => Swal.showLoading(),
            });

            for (const truck of trucks) {
              const userId = assignMap[truck.id];
              if (userId) {
                await assignUserToTruck(truck.id, userId);
              } else {
                await unassignUserFromTruck(truck.id);
              }
            }

            setInitialMap({ ...assignMap });

            Swal.close();
            await new Promise((r) => requestAnimationFrame(r));

            await Swal.fire({
              icon: "success",
              title: "สำเร็จ",
              text: "บันทึกข้อมูลเรียบร้อยแล้ว",
              confirmButtonColor: "#000",
            });
          } catch {
            Swal.close();
            await new Promise((r) => requestAnimationFrame(r));

            await Swal.fire({
              icon: "error",
              title: "ระบบขัดข้อง",
              text: "กรุณาลองใหม่อีกครั้ง",
              confirmButtonColor: "#dc2626",
            });
          }
        }}
        className={`w-full py-3 rounded-xl bg-black text-white transition-opacity ${
          !hasChanged ? "opacity-50" : "opacity-100"
        }`}
      >
        บันทึก
      </button>
    </main>
  );
}
