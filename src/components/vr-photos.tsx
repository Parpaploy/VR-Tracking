import { useEffect, useRef, useState } from "react";
import type { IVRPhoto } from "../interfaces/data.interface";
import { compressPhoto, photosConfigured, uploadPhoto } from "../lib/cloudinary";
import { addVRPhoto } from "../lib/vr.services";

export function VRPhotos({ deviceId, photos = [], onAdded, onBusyChange }: {
  deviceId: string;
  photos?: IVRPhoto[];
  onAdded?: (photo: IVRPhoto) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [preview, setPreview] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [pending, setPending] = useState<IVRPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!preview) return;
    const url = URL.createObjectURL(preview);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [preview]);

  function markBusy(value: boolean) {
    lock.current = value;
    setBusy(value);
    onBusyChange?.(value);
  }

  async function select(file: File) {
    if (lock.current) return;
    markBusy(true);
    setError("");
    setPreview(null);
    setPreviewUrl("");
    try { setPreview(await compressPhoto(file)); }
    catch (err) { setError(err instanceof Error ? err.message : "อ่านรูปไม่สำเร็จ"); }
    finally { markBusy(false); }
  }

  async function save() {
    if (!preview || lock.current) return;
    markBusy(true);
    setError("");
    let uploaded = pending;
    try {
      uploaded ??= await uploadPhoto(preview);
      setPending(uploaded);
      await addVRPhoto(deviceId, uploaded);
      onAdded?.(uploaded);
      setPending(null);
      setPreview(null);
      setPreviewUrl("");
    } catch (err) {
      setError(uploaded ? "อัปโหลดแล้ว แต่บันทึกข้อมูลไม่สำเร็จ กดบันทึกอีกครั้งเพื่อเชื่อมรูปเดิม" : err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ กรุณาลองใหม่");
    } finally { markBusy(false); }
  }

  return <section className="my-4 space-y-3" aria-label="รูปอุปกรณ์ VR">
    <h3 className="font-bold">รูปอุปกรณ์ ({photos.length})</h3>
    {photos.length === 0 && <p className="text-sm text-gray-500">ยังไม่มีรูปอุปกรณ์</p>}
    <div className="grid grid-cols-2 gap-2">
      {photos.map(photo => <a key={photo.publicId} href={photo.url} target="_blank" rel="noreferrer">
        <img src={photo.url} alt={`อุปกรณ์ ${deviceId}`} loading="lazy" className="h-32 w-full rounded-lg object-cover" />
      </a>)}
    </div>
    {onAdded && <>
      {!photosConfigured ? <p className="text-sm text-gray-500">ยังไม่พร้อมอัปโหลดรูป กรุณาติดต่อผู้ดูแล</p> : <>
        <label className="block text-sm">เพิ่มรูปอุปกรณ์
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || Boolean(pending)} onChange={e => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void select(file);
          }} className="block w-full mt-2 text-sm" />
        </label>
        <p className="text-xs text-gray-500">JPG, PNG, WebP ไม่เกิน 20 MB · ย่ออัตโนมัติเหลือไม่เกิน 500 KB</p>
      </>}
      {preview && <div className="space-y-2">
        {previewUrl && <img src={previewUrl} alt="ตัวอย่างรูปก่อนอัปโหลด" className="max-h-48 mx-auto rounded-lg" />}
        <p className="text-sm">ขนาดหลังย่อ {Math.ceil(preview.size / 1024)} KB</p>
        <button type="button" disabled={busy} onClick={() => void save()} className="bg-black text-white rounded-lg p-2 w-full disabled:opacity-50">{busy ? "กำลังบันทึกรูป..." : pending ? "ลองบันทึกข้อมูลรูปอีกครั้ง" : "บันทึกรูป"}</button>
      </div>}
      {busy && !preview && <p role="status" className="text-sm">กำลังเตรียมรูป...</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </>}
  </section>;
}
