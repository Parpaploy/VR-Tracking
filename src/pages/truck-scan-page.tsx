import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { moveVRToTruck } from "../lib/vr.services";
import { useAuth } from "../hooks/use-auth";
import type { ITruck } from "../interfaces/data.interface";
import { fetchTrucks } from "../lib/truck.services";

export default function TruckScanPage() {
  const { session } = useAuth();
  const { truckId } = useParams<{ truckId: string }>();
  const qrRef = useRef<Html5Qrcode | null>(null);
  const startedRef = useRef(false);
  const lockedRef = useRef(false);
  const mountedRef = useRef(true);
  const lastScannedRef = useRef<string | null>(null);
  const lastWarningRef = useRef<number>(0);
  const [message, setMessage] = useState<string | null>(null);
  const [truck, setTruck] = useState<ITruck>();

  useEffect(() => {
    if (!truckId) return;
    fetchTrucks().then((trucks) => {
      const found = trucks.find((t) => t.id === truckId);
      if (found) setTruck(found);
    });
  }, [truckId]);

  useEffect(() => {
    mountedRef.current = true;
    if (!truckId || !session?.id) return;
    if (startedRef.current) return;
    startedRef.current = true;

    const qr = new Html5Qrcode("qr-reader");
    qrRef.current = qr;

    qr.start(
      { facingMode: "environment" },
      { fps: 8, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
      async (decodedText) => {
        if (decodedText === lastScannedRef.current) {
          if (lockedRef.current) return;
          const now = Date.now();
          if (now - lastWarningRef.current > 2000) {
            lastWarningRef.current = now;
            setMessage("⚠️ QR นี้สแกนไปแล้ว กรุณาเปลี่ยน QR ใหม่");
          }
          return;
        }
        if (lockedRef.current) return;
        lockedRef.current = true;
        lastScannedRef.current = decodedText;

        try {
          setMessage("กำลังย้ายอุปกรณ์ VR...");
          await moveVRToTruck(decodedText, truckId, session.id);
          setMessage("✅ ย้ายเข้ารถสำเร็จ");
        } catch (err: unknown) {
          if (err instanceof Error) {
            setMessage("❌ " + err.message);
          } else {
            setMessage("❌ เกิดข้อผิดพลาด");
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
        lockedRef.current = false;
      },
      () => {},
    ).catch(console.error);

    return () => {
      mountedRef.current = false;
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
        // ignore
      }
      qrRef.current = null;
      startedRef.current = false;
    };
  }, [truckId, session?.id]);

  if (!session)
    return (
      <div className="w-full h-full flex justify-center items-center text-black/40">
        กำลังโหลดผู้ใช้...
      </div>
    );
  if (!truckId)
    return (
      <div className="w-full h-full flex justify-center items-center text-black/40">
        ไม่พบรถ
      </div>
    );

  return (
    <main className="w-full h-full p-4 bg-white flex flex-col gap-1 overflow-hidden">
      <h1 className="text-[18px] font-bold text-center text-black/70">
        สแกน QR เพื่อย้ายขึ้นรถ
      </h1>
      <p className="text-center text-[24px] font-bold mb-3"> {truck?.name}</p>

      <div
        id="qr-reader"
        className="w-full rounded-xl overflow-hidden bg-black mb-2"
        style={{ height: 360 }}
      />

      <p className="text-center text-sm text-gray-500 mb-2">
        วาง QR ให้อยู่ในกรอบ
      </p>

      {message && (
        <p
          className={`text-center font-semibold text-lg p-3 rounded-xl ${
            message.startsWith("✅")
              ? "bg-green-100 text-green-700"
              : message.startsWith("❌")
                ? "bg-red-100 text-red-700"
                : message.startsWith("⚠️")
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-blue-100 text-blue-700"
          }`}
        >
          {message}
        </p>
      )}
    </main>
  );
}
