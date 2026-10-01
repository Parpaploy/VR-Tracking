import { VRPhotos } from "../components/vr-photos";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";
import {
  doc,
  getDocFromCache,
  getDocFromServer,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { fetchStores } from "../lib/store.services";
import { fetchTrucks } from "../lib/truck.services";
import { fetchWarehouses } from "../lib/warehouses.services";
import { fetchUsers } from "../lib/auth.services";
import { updateVRStatus } from "../lib/vr.services";
import type {
  IVR,
  IVRTransaction,
  LocationType,
} from "../interfaces/data.interface";
import { STATUS_COLOR } from "../constants/label";
import { RxCross2 } from "react-icons/rx";

export default function VRScanPage() {
  const qrRef = useRef<Html5Qrcode | null>(null);
  const startedRef = useRef(false);
  const lockedRef = useRef(false);
  const lastScannedRef = useRef<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);

  const [vr, setVR] = useState<IVR | null>(null);
  const [lastTx, setLastTx] = useState<IVRTransaction | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  const [newStatus, setNewStatus] = useState<
    "good" | "damaged" | "pending_approval" | "borrowed"
  >("good");
  const [isSaving, setIsSaving] = useState(false);

  const [storeMap, setStoreMap] = useState<Record<string, string>>({});
  const [truckMap, setTruckMap] = useState<Record<string, string>>({});
  const [warehouseMap, setWarehouseMap] = useState<Record<string, string>>({});
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadMaps() {
      const [stores, trucks, warehouses, users] = await Promise.all([
        fetchStores(),
        fetchTrucks(),
        fetchWarehouses(),
        fetchUsers(),
      ]);
      setStoreMap(Object.fromEntries(stores.map((s) => [s.id, s.name])));
      setTruckMap(Object.fromEntries(trucks.map((t) => [t.id, t.name])));
      setWarehouseMap(
        Object.fromEntries(warehouses.map((w) => [w.id, w.name])),
      );
      const u: Record<string, string> = {};
      users.forEach((user) => {
        u[user.id] = user.nickname || user.name || user.id;
      });
      setUserMap(u);
    }
    loadMaps();
  }, []);

  const getLocationName = (type: LocationType, id: string) => {
    if (type === "store") return storeMap[id] ?? id;
    if (type === "truck") return truckMap[id] ?? id;
    if (type === "warehouse") return warehouseMap[id] ?? id;
    return id;
  };

  const loadVRDetail = async (gasId: string) => {
    setLoadingDetail(true);
    setVR(null);
    setLastTx(null);
    setShowPopup(true);

    try {
      const ref = doc(db, "gas", gasId);
      let vrData: IVR | null = null;

      try {
        const cacheSnap = await getDocFromCache(ref);
        if (cacheSnap.exists()) {
          vrData = { id: cacheSnap.id, ...cacheSnap.data() } as IVR;
        }
      } catch {
        //
      }

      if (!vrData) {
        const snap = await getDocFromServer(ref);
        if (snap.exists()) {
          vrData = { id: snap.id, ...snap.data() } as IVR;
        }
      }

      setVR(vrData);
      if (vrData) setNewStatus(vrData.status === "good" || vrData.status === "borrowed" || vrData.status === "pending_approval" ? vrData.status : "damaged");

      if (vrData) {
        try {
          const q = query(
            collection(db, "transactions"),
            where("gasId", "==", gasId),
            orderBy("createdAt", "desc"),
            limit(1),
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const d = snap.docs[0];
            setLastTx({ ...d.data(), id: d.id } as IVRTransaction);
          }
        } catch (err) {
          console.error("Load transaction failed:", err);
        }
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSaveStatus = async () => {
    if (!vr) return;
    if (newStatus !== "good" && newStatus !== "damaged") return;
    try {
      setIsSaving(true);
      await updateVRStatus(vr.id, newStatus);
      setVR((prev) => (prev ? { ...prev, status: newStatus } : prev));
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const qr = new Html5Qrcode("qr-reader");
    qrRef.current = qr;

    qr.start(
      { facingMode: "environment" },
      { fps: 8, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
      async (decodedText) => {
        if (decodedText === lastScannedRef.current) return;
        if (lockedRef.current) return;
        lockedRef.current = true;
        lastScannedRef.current = decodedText;

        setMessage("กำลังโหลดข้อมูลอุปกรณ์ VR...");
        await loadVRDetail(decodedText);
        setMessage(null);

        await new Promise((r) => setTimeout(r, 1500));
        lockedRef.current = false;
      },
      () => {},
    ).catch(console.error);

    return () => {
      if (!qrRef.current) return;
      try {
        const state = qrRef.current.getState();
        if (
          state === Html5QrcodeScannerState.SCANNING ||
          state === Html5QrcodeScannerState.PAUSED
        ) {
          qrRef.current.stop().catch(() => {});
        }
      } catch {
        /* */
      }
      qrRef.current = null;
      startedRef.current = false;
    };
  }, []);

  const handleClosePopup = () => {
    setShowPopup(false);
    setVR(null);
    setLastTx(null);
    lastScannedRef.current = null;
  };

  return (
    <main className="max-w-107.5 mx-auto w-full h-full p-4 bg-white flex flex-col gap-1 overflow-hidden">
      <h1 className="text-[18px] font-bold text-center text-black/70">
        สแกน QR เพื่อดูข้อมูลอุปกรณ์ VR
      </h1>
      <div
        id="qr-reader"
        className="w-full rounded-xl overflow-hidden bg-black mb-2"
        style={{ height: 360 }}
      />
      <p className="text-center text-sm text-gray-500 mb-2">
        วาง QR ให้อยู่ในกรอบ
      </p>
      {message && (
        <p className="text-center font-semibold text-lg p-3 rounded-[10px] bg-blue-100 text-blue-700">
          {message}
        </p>
      )}

      {showPopup && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-t-[20px] p-6 shadow-xl flex flex-col gap-4 max-h-[90svh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-[20px] font-bold">ข้อมูลอุปกรณ์ VR</h2>
              <button
                onClick={handleClosePopup}
                className="border border-black/10 rounded-full p-2"
              >
                <RxCross2 size={18} />
              </button>
            </div>

            {loadingDetail ? (
              <div className="py-10 text-center text-black/40 animate-pulse">
                กำลังโหลด...
              </div>
            ) : !vr ? (
              <div className="py-10 text-center text-red-400">
                ไม่พบข้อมูลอุปกรณ์ VRนี้
              </div>
            ) : (
              <>
                <VRPhotos deviceId={vr.id} photos={vr.photos} />
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-500">รหัสอุปกรณ์ VR</span>
                    <span className="font-bold">{vr.id}</span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-500">สถานะ</span>
                    <select
                      value={newStatus}
                      onChange={(e) =>
                        setNewStatus(
                          e.target.value as
                            | "good"
                            | "damaged"
                            | "pending_approval"
                            | "borrowed",
                        )
                      }
                      className={`px-3 py-1 rounded-full text-sm font-medium border-0 outline-none cursor-pointer ${STATUS_COLOR[newStatus]}`}
                    >
                      <option value="good">พร้อมใช้</option>
                      <option value="damaged">ชำรุด</option>
                      <option value="pending_approval" disabled>รออนุมัติ</option>
                      <option value="borrowed" disabled>ยืม</option>
                    </select>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-gray-500">สถานที่ปัจจุบัน</span>
                    <span className="font-medium">
                      {getLocationName(vr.locationType, vr.locationId)}
                    </span>
                  </div>
                </div>

                {lastTx ? (
                  <div className="space-y-3">
                    <p className="font-bold text-[16px]">การย้ายล่าสุด</p>
                    <div className="flex justify-between">
                      <span className="text-gray-500">จาก</span>
                      <span>
                        {getLocationName(
                          lastTx.fromLocationType,
                          lastTx.fromLocationId,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">ไปยัง</span>
                      <span>
                        {getLocationName(
                          lastTx.toLocationType,
                          lastTx.toLocationId,
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">โดย</span>
                      <span>{userMap[lastTx.performedBy] ?? "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">เวลา</span>
                      <span>
                        {lastTx.createdAt instanceof Timestamp
                          ? lastTx.createdAt.toDate().toLocaleString("th-TH")
                          : "-"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-black/30 text-sm">
                    ไม่มีประวัติการเคลื่อนย้าย
                  </p>
                )}

                {(newStatus === "good" || newStatus === "damaged") && newStatus !== (vr.status === "minor_damage" || vr.status === "major_damage" ? "damaged" : vr.status) && <button
                  onClick={handleSaveStatus}
                  disabled={isSaving}
                  className="w-full py-2.5 rounded-xl bg-black text-white font-bold text-[15px] disabled:opacity-50 active:scale-[0.98] transition-all"
                >
                  {isSaving ? "กำลังบันทึก..." : "บันทึก"}
                </button>}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
