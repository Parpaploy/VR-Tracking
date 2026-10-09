import { useEffect, useRef, useState } from "react";
import { LuArrowLeft, LuArrowRight, LuDownload, LuLoaderCircle } from "react-icons/lu";
import type { IVRPhoto } from "../interfaces/data.interface";
import { compressPhoto, photosConfigured, uploadPhoto } from "../lib/cloudinary";
import { addVRPhotos } from "../lib/vr.services";

export function VRPhotos({ deviceId, photos = [], onAdded, onBusyChange }: {
  deviceId: string;
  photos?: IVRPhoto[];
  onAdded?: (photo: IVRPhoto) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [previews, setPreviews] = useState<Blob[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [pending, setPending] = useState<IVRPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [downloadingPublicId, setDownloadingPublicId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const lock = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const urls = previews.map(preview => URL.createObjectURL(preview));
    setPreviewUrls(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [previews]);

  useEffect(() => {
    setActivePhotoIndex(index => Math.min(index, Math.max(photos.length - 1, 0)));
  }, [photos.length]);

  function markBusy(value: boolean) {
    lock.current = value;
    setBusy(value);
    onBusyChange?.(value);
  }

  async function select(files: File[]) {
    if (lock.current) return;
    if (files.length > 10) {
      setError("เลือกได้ไม่เกิน 10 รูปต่อครั้ง");
      return;
    }
    markBusy(true);
    setError("");
    setPreviews([]);
    setPending([]);
    try {
      const compressed: Blob[] = [];
      for (const file of files) compressed.push(await compressPhoto(file));
      setPreviews(compressed);
    }
    catch (err) { setError(err instanceof Error ? err.message : "อ่านรูปไม่สำเร็จ"); }
    finally { markBusy(false); }
  }

  async function save() {
    if (previews.length === 0 || lock.current) return;
    markBusy(true);
    setError("");
    const uploaded = [...pending];
    try {
      for (let index = uploaded.length; index < previews.length; index++) {
        uploaded[index] = await uploadPhoto(previews[index]);
        setPending([...uploaded]);
      }
      await addVRPhotos(deviceId, uploaded);
      uploaded.forEach(photo => onAdded?.(photo));
      setPending([]);
      setPreviews([]);
    } catch (err) {
      setError(uploaded.length > 0 ? `อัปโหลดแล้ว ${uploaded.length} จาก ${previews.length} รูป กดบันทึกอีกครั้งเพื่อทำต่อโดยไม่อัปโหลดรูปเดิมซ้ำ` : err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ กรุณาลองใหม่");
    } finally { markBusy(false); }
  }

  async function download(photo: IVRPhoto, index: number) {
    if (downloadingPublicId) return;
    setDownloadingPublicId(photo.publicId);
    setDownloadError("");
    try {
      const response = await fetch(photo.url);
      if (!response.ok) throw new Error("ดาวน์โหลดรูปไม่สำเร็จ");
      const blob = await response.blob();
      const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
      const safeDeviceId = deviceId.replace(/[^a-z0-9_-]/gi, "-");
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${safeDeviceId}-photo-${index + 1}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setDownloadError("บันทึกรูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setDownloadingPublicId(null);
    }
  }

  function movePhoto(direction: -1 | 1) {
    setActivePhotoIndex(index => (index + direction + photos.length) % photos.length);
  }

  return <section className="my-4 space-y-3" aria-label="อัลบั้มรูปอุปกรณ์">
    <h3 className="font-bold">อัลบั้มรูปอุปกรณ์ ({photos.length})</h3>
    <p className="text-sm text-gray-500">รูปชุดนี้ใช้เก็บภาพประจำอุปกรณ์ แยกจากรูป selfie ตอนยืม เพิ่มได้หลายรูป</p>
    {photos.length === 0 ? <p className="text-sm text-gray-500">ยังไม่มีรูปในอัลบั้ม</p> : <div className="space-y-2">
      <div className="relative overflow-hidden border border-slate-200 bg-slate-100">
        <img src={photos[activePhotoIndex].url} alt={`รูปที่ ${activePhotoIndex + 1} ของอุปกรณ์ ${deviceId}`} loading="lazy" className="mx-auto aspect-[4/3] max-h-[420px] w-full object-contain" />
        {photos.length > 1 && <>
          <button type="button" aria-label="ดูรูปก่อนหน้า" onClick={() => movePhoto(-1)} className="absolute left-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-slate-300 bg-white/95 text-slate-800 shadow-sm hover:bg-white focus-visible:outline-2 focus-visible:outline-indigo-700"><LuArrowLeft aria-hidden="true" /></button>
          <button type="button" aria-label="ดูรูปถัดไป" onClick={() => movePhoto(1)} className="absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-slate-300 bg-white/95 text-slate-800 shadow-sm hover:bg-white focus-visible:outline-2 focus-visible:outline-indigo-700"><LuArrowRight aria-hidden="true" /></button>
        </>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600" aria-live="polite">รูปที่ {activePhotoIndex + 1} จาก {photos.length}</p>
        <button type="button" disabled={downloadingPublicId !== null} onClick={() => void download(photos[activePhotoIndex], activePhotoIndex)} className="inline-flex min-h-10 items-center justify-center gap-2 border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-indigo-700">
          {downloadingPublicId === photos[activePhotoIndex].publicId ? <LuLoaderCircle aria-hidden="true" className="animate-spin" /> : <LuDownload aria-hidden="true" />}
          {downloadingPublicId === photos[activePhotoIndex].publicId ? "กำลังบันทึก…" : "บันทึกรูปนี้ลงเครื่อง"}
        </button>
      </div>
      {photos.length > 1 && <div className="flex justify-center gap-1.5" aria-label="เลือกดูรูปในอัลบั้ม">
        {photos.map((photo, index) => <button key={photo.publicId} type="button" aria-label={`ดูรูปที่ ${index + 1}`} aria-current={activePhotoIndex === index ? "true" : undefined} onClick={() => setActivePhotoIndex(index)} className={`h-2.5 w-2.5 border border-slate-500 ${activePhotoIndex === index ? "bg-indigo-800" : "bg-white"}`} />)}
      </div>}
      {downloadError && <p role="alert" className="text-sm text-red-700">{downloadError}</p>}
    </div>}
    {onAdded && <>
      {!photosConfigured ? <p className="text-sm text-gray-500">ยังไม่พร้อมอัปโหลดรูป กรุณาติดต่อผู้ดูแล</p> : <>
        <label className="block text-sm">เพิ่มรูปเข้าอัลบั้ม
          <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy || pending.length > 0} onChange={e => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length > 0) void select(files);
          }} className="block w-full mt-2 text-sm" />
        </label>
        <p className="text-xs text-gray-500">เลือกได้สูงสุด 10 รูปต่อครั้ง · JPG, PNG, WebP ไม่เกิน 20 MB ต่อรูป · ย่ออัตโนมัติเหลือไม่เกิน 500 KB ต่อรูป</p>
      </>}
      {previews.length > 0 && <div className="space-y-2">
        <p className="text-sm">เลือกรูปแล้ว {previews.length} รูป · รวม {Math.ceil(previews.reduce((total, preview) => total + preview.size, 0) / 1024)} KB</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{previews.map((_, index) => previewUrls[index] && <img key={previewUrls[index]} src={previewUrls[index]} alt={`ตัวอย่างรูปที่ ${index + 1}`} className="h-28 w-full rounded-lg object-cover" />)}</div>
        <button type="button" disabled={busy} onClick={() => void save()} className="bg-black text-white rounded-lg p-2 w-full disabled:opacity-50">{busy ? "กำลังบันทึกรูป..." : pending.length > 0 ? `ทำต่อจากรูปที่ ${pending.length + 1}` : `บันทึกรูป ${previews.length} รูป`}</button>
      </div>}
      {busy && previews.length === 0 && <p role="status" className="text-sm">กำลังเตรียมรูป...</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </>}
  </section>;
}
