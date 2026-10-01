import { collection, doc, getDoc, getDocs, orderBy, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { auth, db } from "./firebase";

export interface Loan { id: string; deviceId: string; borrowerId: string; borrowerName: string; status: 'borrowed' | 'returned'; borrowedAt: string | null; returnedAt: string | null; returnedBy?: string | null; }
export interface Device { id: string; status: 'good' | 'minor_damage' | 'major_damage' | 'borrowed'; loanStatus?: string; activeLoanId?: string | null; available: boolean; }
function current() { if (!auth.currentUser) throw new Error('กรุณาเข้าสู่ระบบใหม่'); return auth.currentUser; }
function toLoan(id: string, d: Record<string, unknown>): Loan {
  const date = (v: unknown) => v && typeof v === 'object' && 'toDate' in v ? (v as { toDate: () => Date }).toDate().toISOString() : typeof v === 'string' ? v : null;
  return { id, deviceId: String(d.deviceId ?? ''), borrowerId: String(d.borrowerId ?? ''), borrowerName: String(d.borrowerName ?? ''), status: d.status === 'returned' ? 'returned' : 'borrowed', borrowedAt: date(d.borrowedAt), returnedAt: date(d.returnedAt), returnedBy: typeof d.returnedBy === 'string' ? d.returnedBy : null };
}
export async function loanRequest<T>(path: string, body?: unknown): Promise<T> {
  const user = current(); const profile = await getDoc(doc(db, 'users', user.uid));
  if (!profile.exists() || profile.data().status !== 'active') throw new Error('บัญชีไม่พร้อมใช้งาน');
  const role = profile.data().role === 'admin' ? 'admin' : 'user';
  if (path === '/loans' && body === undefined) {
    const q = role === 'admin' ? query(collection(db, 'loans'), orderBy('borrowedAt', 'desc')) : query(collection(db, 'loans'), where('borrowerId', '==', user.uid));
    const snap = await getDocs(q); return { loans: snap.docs.map(d => toLoan(d.id, d.data())).sort((a,b) => (b.borrowedAt ?? '').localeCompare(a.borrowedAt ?? '')) } as T;
  }
  if (path === '/devices' && body === undefined) {
    if (role !== 'admin') throw new Error('เฉพาะแอดมินเท่านั้น');
    const snap = await getDocs(collection(db, 'gas')); return { devices: snap.docs.map(d => ({ id:d.id, status:d.data().status ?? 'good', loanStatus:d.data().loanStatus, activeLoanId:d.data().activeLoanId ?? null, available:d.data().status === 'good' && !d.data().activeLoanId })) } as T;
  }
  if (path === '/devices' && body && role === 'admin') {
    const id = String((body as {deviceId?:unknown}).deviceId ?? '').trim().toUpperCase(); if (!/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(id)) throw new Error('รหัส VR ไม่ถูกต้อง');
    await runTransaction(db, async tx => { const ref=doc(db,'gas',id); if ((await tx.get(ref)).exists()) throw new Error('รหัส VR นี้มีอยู่แล้ว'); tx.set(ref,{status:'good',loanStatus:'available',activeLoanId:null,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); });
    return {success:true} as T;
  }
  const statusMatch = path.match(/^\/devices\/([^/]+)\/status$/);
  if (statusMatch && body && role === 'admin') {
    const id=decodeURIComponent(statusMatch[1]).toUpperCase(); const status=(body as {status?:string}).status;
    if (!['good','minor_damage','major_damage'].includes(status ?? '')) throw new Error('สถานะ VR ไม่ถูกต้อง');
    await runTransaction(db,async tx=>{const ref=doc(db,'gas',id);const s=await tx.get(ref);if(!s.exists())throw new Error('ไม่พบรหัส VR นี้');if(s.data().activeLoanId)throw new Error('ไม่สามารถเปลี่ยนสถานะขณะที่ VR กำลังถูกยืม');tx.update(ref,{status,loanStatus:status==='good'?'available':'unavailable',updatedAt:serverTimestamp()});});return {success:true} as T;
  }
  const returnMatch=path.match(/^\/devices\/([^/]+)\/return$/);
  if(returnMatch && body===undefined && role==='admin'){
    const id=decodeURIComponent(returnMatch[1]).toUpperCase();const snap=await getDoc(doc(db,'gas',id));if(!snap.exists()||!snap.data().activeLoanId)throw new Error('VR เครื่องนี้ไม่มีรายการยืมที่รอคืน');const loan=await getDoc(doc(db,'loans',String(snap.data().activeLoanId)));if(!loan.exists()||loan.data().status!=='borrowed')throw new Error('รายการยืมไม่ถูกต้อง');return {loan:toLoan(loan.id,loan.data())} as T;
  }
  if(path==='/loans/borrow' && body){
    if(role!=='user')throw new Error('การยืมสำหรับบัญชี user เท่านั้น');const p=body as {deviceId?:string;selfie?:string};const id=String(p.deviceId??'').trim().toUpperCase();if(!/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(id))throw new Error('รหัส VR ไม่ถูกต้อง');const image=p.selfie??'';if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image)||image.length>700000)throw new Error('กรุณาแนบ selfie JPG ขนาดไม่เกิน 500 KB');
    const loanRef=doc(collection(db,'loans'));const deviceRef=doc(db,'gas',id);const photoRef=doc(db,'loanPhotos',loanRef.id);const who=(await getDoc(doc(db,'users',user.uid))).data()!;
    await runTransaction(db,async tx=>{const d=await tx.get(deviceRef);if(!d.exists())throw new Error('ไม่พบรหัส VR นี้');if(d.data().activeLoanId||d.data().status!=='good'||(d.data().loanStatus&&d.data().loanStatus!=='available'))throw new Error('VR เครื่องนี้ไม่พร้อมให้ยืม หรือมีผู้ยืมอยู่แล้ว');tx.set(loanRef,{deviceId:id,borrowerId:user.uid,borrowerName:String(who.name??''),status:'borrowed',borrowedAt:serverTimestamp(),returnedAt:null,returnedBy:null});tx.set(photoRef,{image,ownerId:user.uid,createdAt:serverTimestamp()});tx.update(deviceRef,{loanStatus:'borrowed',status:'borrowed',activeLoanId:loanRef.id,updatedAt:serverTimestamp()});});return {success:true} as T;
  }
  if(path==='/loans/return' && body && role==='admin'){
    const p=body as {deviceId?:string;loanId?:string};const id=String(p.deviceId??'').trim().toUpperCase();const loanId=String(p.loanId??'');const deviceRef=doc(db,'gas',id);const loanRef=doc(db,'loans',loanId);
    await runTransaction(db,async tx=>{const [d,l]=await Promise.all([tx.get(deviceRef),tx.get(loanRef)]);if(!d.exists()||d.data().activeLoanId!==loanId)throw new Error('รายการยืมเปลี่ยนแล้ว กรุณาสแกนใหม่');if(!l.exists()||l.data().status!=='borrowed')throw new Error('รายการนี้รับคืนไปแล้ว');tx.update(loanRef,{status:'returned',returnedAt:serverTimestamp(),returnedBy:user.uid});tx.update(deviceRef,{status:'good',loanStatus:'available',activeLoanId:null,updatedAt:serverTimestamp()});});return {success:true} as T;
  }
  throw new Error('ไม่พบคำสั่งหรือไม่มีสิทธิ์ดำเนินการ');
}
export async function loanImage(path: string): Promise<Blob> {
  const m=path.match(/^\/loans\/([^/]+)\/selfie$/);if(!m)throw new Error('ไม่พบรูป');const snap=await getDoc(doc(db,'loanPhotos',decodeURIComponent(m[1])));if(!snap.exists())throw new Error('ไม่พบรูป selfie ของรายการนี้');const value=String(snap.data().image??'');const response=await fetch(value);return response.blob();
}
export function asDataUrl(blob: Blob): Promise<string> { return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('อ่านรูปไม่สำเร็จ'));r.readAsDataURL(blob);}); }
