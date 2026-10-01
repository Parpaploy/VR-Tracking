import type { IVRPhoto } from "../interfaces/data.interface";

const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();
export const photosConfigured = Boolean(cloudName && uploadPreset);
const MAX_BYTES = 500 * 1024;

/** Resize locally so the full camera original never consumes cloud storage. */
export async function compressPhoto(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("กรุณาเลือกรูป JPG, PNG หรือ WebP");
  }
  if (file.size > 20 * 1024 * 1024) throw new Error("รูปต้นฉบับต้องไม่เกิน 20 MB");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("อ่านรูปไม่สำเร็จ กรุณาเลือกรูปใหม่");
  });
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("เบราว์เซอร์นี้ไม่รองรับการย่อรูป");
    let edge = 1600;
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("ย่อรูปไม่สำเร็จ")), "image/jpeg", Math.max(0.55, 0.85 - attempt * 0.06));
      });
      if (blob.size <= MAX_BYTES) return blob;
      edge = Math.round(edge * 0.8);
    }
    throw new Error("ย่อรูปให้ต่ำกว่า 500 KB ไม่สำเร็จ กรุณาเลือกรูปอื่น");
  } finally {
    bitmap.close();
  }
}

export async function uploadPhoto(blob: Blob): Promise<IVRPhoto> {
  if (!photosConfigured) throw new Error("ยังไม่ได้ตั้งค่าการอัปโหลดรูป");
  const body = new FormData();
  body.append("file", blob, "vr-photo.jpg");
  body.append("upload_preset", uploadPreset!);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName!)}/image/upload`, {
    method: "POST", body, signal: AbortSignal.timeout(60000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error("อัปโหลดรูปไม่สำเร็จ กรุณาตรวจการเชื่อมต่อหรือติดต่อผู้ดูแล");
  if (typeof data.secure_url !== "string" || !data.secure_url.startsWith("https://res.cloudinary.com/") || typeof data.public_id !== "string" || typeof data.bytes !== "number") {
    throw new Error("ข้อมูลรูปที่ได้รับไม่ถูกต้อง");
  }
  return { url: data.secure_url, publicId: data.public_id, bytes: data.bytes, uploadedAt: new Date().toISOString() };
}
