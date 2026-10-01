import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { auth, authReady, db } from './firebase';

export type LoanStatus = 'pending_approval' | 'borrowed' | 'returned' | 'rejected';
export type DeviceStatus = 'good' | 'damaged' | 'pending_approval' | 'borrowed' | 'minor_damage' | 'major_damage';
export interface Loan {
  id: string;
  deviceId: string;
  borrowerId: string;
  borrowerName: string;
  status: LoanStatus;
  requestedAt: string | null;
  borrowedAt: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  returnedAt: string | null;
  returnedBy?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  approvalSource?: 'user_scan' | 'admin';
}
export interface Device {
  id: string;
  deviceNumber?: string;
  status: DeviceStatus;
  loanStatus?: string;
  activeLoanId: string | null;
  pendingLoanId?: string | null;
  available: boolean;
  statusSource?: 'admin' | 'user_loan' | null;
  statusSetBy?: string | null;
  statusSetAt?: string | null;
  adminBorrowerId?: string | null;
  adminBorrowerName?: string | null;
}
export interface ActiveUser { id: string; name: string; nickname: string; role: 'user' | 'admin'; }

function current() {
  if (!auth.currentUser) throw new Error('กรุณาเข้าสู่ระบบใหม่');
  return auth.currentUser;
}

function deviceNumberValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.trim().length > 64) throw new Error('เบอร์เครื่องต้องไม่เกิน 64 ตัวอักษร');
  return value.trim();
}

function toDate(value: unknown): string | null {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof value === 'string' ? value : null;
}

function toLoan(id: string, data: Record<string, unknown>): Loan {
  return {
    id,
    deviceId: String(data.deviceId ?? ''),
    borrowerId: String(data.borrowerId ?? ''),
    borrowerName: String(data.borrowerName ?? ''),
    status: (['pending_approval', 'borrowed', 'returned', 'rejected'].includes(String(data.status))
      ? data.status
      : 'borrowed') as LoanStatus,
    requestedAt: toDate(data.requestedAt ?? data.borrowedAt),
    borrowedAt: toDate(data.borrowedAt),
    approvedAt: toDate(data.approvedAt),
    approvedBy: typeof data.approvedBy === 'string' ? data.approvedBy : null,
    returnedAt: toDate(data.returnedAt),
    returnedBy: typeof data.returnedBy === 'string' ? data.returnedBy : null,
    rejectedAt: toDate(data.rejectedAt),
    rejectedBy: typeof data.rejectedBy === 'string' ? data.rejectedBy : null,
    approvalSource: data.approvalSource === 'admin' ? 'admin' : 'user_scan',
  };
}

function normalizedDevice(data: Record<string, unknown> & { id: string }): Device {
  const status = String(data.status ?? 'good') as DeviceStatus;
  const activeLoanId = typeof data.activeLoanId === 'string' ? data.activeLoanId : null;
  const pendingLoanId = typeof data.pendingLoanId === 'string' ? data.pendingLoanId : null;
  return {
    ...data,
    id: data.id,
    deviceNumber: typeof data.deviceNumber === 'string' ? data.deviceNumber : '',
    status,
    activeLoanId,
    pendingLoanId,
    available: status === 'good' && !activeLoanId && !pendingLoanId,
    statusSetAt: toDate(data.statusSetAt),
    statusSource: data.statusSource === 'admin' || data.statusSource === 'user_loan' ? data.statusSource : null,
    adminBorrowerId: typeof data.adminBorrowerId === 'string' ? data.adminBorrowerId : null,
    adminBorrowerName: typeof data.adminBorrowerName === 'string' ? data.adminBorrowerName : null,
  };
}

export async function loanRequest<T>(path: string, body?: unknown): Promise<T> {
  await authReady;
  const user = current();
  const profileSnap = await getDoc(doc(db, 'users', user.uid));
  if (!profileSnap.exists() || profileSnap.data().status !== 'active') throw new Error('บัญชีไม่พร้อมใช้งาน');
  const profile = profileSnap.data();
  const role = profile.role === 'admin' ? 'admin' : 'user';

  if (path === '/loans' && body === undefined) {
    const loanQuery = role === 'admin'
      ? query(collection(db, 'loans'))
      : query(collection(db, 'loans'), where('borrowerId', '==', user.uid));
    const snap = await getDocs(loanQuery);
    const loans = snap.docs.map(item => toLoan(item.id, item.data()));
    loans.sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? ''));
    return { loans } as T;
  }

  if (path === '/devices' && body === undefined) {
    if (role !== 'admin') throw new Error('เฉพาะแอดมินเท่านั้น');
    const snap = await getDocs(collection(db, 'gas'));
    return { devices: snap.docs.map(item => normalizedDevice({ ...item.data(), id: item.id })) } as T;
  }

  if (path === '/users' && body === undefined) {
    if (role !== 'admin') throw new Error('เฉพาะแอดมินเท่านั้น');
    const snap = await getDocs(query(collection(db, 'users'), where('status', '==', 'active')));
    return {
      users: snap.docs.map(item => ({
        id: item.id,
        name: String(item.data().name ?? ''),
        nickname: String(item.data().nickname ?? ''),
        role: item.data().role === 'admin' ? 'admin' : 'user',
      })),
    } as T;
  }

  if (path === '/devices' && body && role === 'admin') {
    const id = String((body as { deviceId?: unknown }).deviceId ?? '').trim().toUpperCase();
    const deviceNumber = deviceNumberValue((body as { deviceNumber?: unknown }).deviceNumber);
    if (!/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(id)) throw new Error('รหัส VR ไม่ถูกต้อง');
    await runTransaction(db, async tx => {
      const ref = doc(db, 'gas', id);
      if ((await tx.get(ref)).exists()) throw new Error('รหัส VR นี้มีอยู่แล้ว');
      tx.set(ref, {
        deviceNumber,
        status: 'good', loanStatus: 'available', activeLoanId: null, pendingLoanId: null,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    });
    return { success: true } as T;
  }

  const numberMatch = path.match(/^\/devices\/([^/]+)\/number$/);
  if (numberMatch && body && role === 'admin') {
    const deviceNumber = deviceNumberValue((body as { deviceNumber?: unknown }).deviceNumber);
    const ref = doc(db, 'gas', decodeURIComponent(numberMatch[1]).toUpperCase());
    await runTransaction(db, async tx => {
      if (!(await tx.get(ref)).exists()) throw new Error('ไม่พบรหัส VR นี้');
      tx.update(ref, { deviceNumber, updatedAt: serverTimestamp() });
    });
    return { success: true } as T;
  }

  const deleteMatch = path.match(/^\/devices\/([^/]+)\/delete$/);
  if (deleteMatch && body && role === 'admin') {
    const ref = doc(db, 'gas', decodeURIComponent(deleteMatch[1]).toUpperCase());
    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('ไม่พบรหัส VR นี้');
      if (snap.data().activeLoanId || snap.data().pendingLoanId) throw new Error('กรุณารับคืนหรือปฏิเสธคำขอที่ค้างอยู่ก่อนลบ VR');
      tx.delete(ref);
    });
    return { success: true } as T;
  }

  const statusMatch = path.match(/^\/devices\/([^/]+)\/status$/);
  if (statusMatch && body && role === 'admin') {
    const id = decodeURIComponent(statusMatch[1]).toUpperCase();
    const request = body as { status?: string; borrowerId?: string };
    const nextStatus = request.status;
    if (!['good', 'damaged', 'borrowed'].includes(nextStatus ?? '')) throw new Error('สถานะ VR ไม่ถูกต้อง');
    const borrowerId = nextStatus === 'borrowed' ? request.borrowerId?.trim() || null : null;

    await runTransaction(db, async tx => {
      const deviceRef = doc(db, 'gas', id);
      const deviceSnap = await tx.get(deviceRef);
      if (!deviceSnap.exists()) throw new Error('ไม่พบรหัส VR นี้');
      const device = deviceSnap.data();
      if (device.activeLoanId) throw new Error('รายการนี้เป็นการยืมที่อนุมัติแล้ว ต้องสแกนรับคืนก่อนเปลี่ยนสถานะ');
      if (device.pendingLoanId) throw new Error('VR นี้มีคำขอรออนุมัติ กรุณาอนุมัติหรือปฏิเสธคำขอก่อน');
      let borrowerName: string | null = null;
      if (borrowerId) {
        const borrowerSnap = await tx.get(doc(db, 'users', borrowerId));
        if (!borrowerSnap.exists() || borrowerSnap.data().status !== 'active') throw new Error('ไม่พบผู้ใช้ที่เลือกหรือบัญชีถูกระงับ');
        borrowerName = String(borrowerSnap.data().nickname || borrowerSnap.data().name || '');
      }

      tx.update(deviceRef, {
        status: nextStatus,
        loanStatus: nextStatus === 'good' ? 'available' : nextStatus === 'damaged' ? 'unavailable' : 'borrowed',
        activeLoanId: null,
        pendingLoanId: null,
        statusSource: 'admin',
        statusSetBy: user.uid,
        statusSetAt: serverTimestamp(),
        adminBorrowerId: borrowerId,
        adminBorrowerName: borrowerName,
        updatedAt: serverTimestamp(),
      });
    });
    return { success: true } as T;
  }

  const approveMatch = path.match(/^\/loans\/([^/]+)\/approve$/);
  const rejectMatch = path.match(/^\/loans\/([^/]+)\/reject$/);
  if ((approveMatch || rejectMatch) && body === undefined && role === 'admin') {
    const loanId = decodeURIComponent((approveMatch ?? rejectMatch)![1]);
    const loanRef = doc(db, 'loans', loanId);
    await runTransaction(db, async tx => {
      const loanSnap = await tx.get(loanRef);
      if (!loanSnap.exists() || loanSnap.data().status !== 'pending_approval') throw new Error('คำขอนี้ถูกดำเนินการไปแล้ว');
      const loan = loanSnap.data();
      const deviceRef = doc(db, 'gas', String(loan.deviceId));
      const deviceSnap = await tx.get(deviceRef);
      if (!deviceSnap.exists() || deviceSnap.data().pendingLoanId !== loanId) throw new Error('VR นี้ไม่มีคำขอที่รออนุมัติแล้ว');

      if (approveMatch) {
        tx.update(loanRef, {
          status: 'borrowed', borrowedAt: serverTimestamp(), approvedAt: serverTimestamp(),
          approvedBy: user.uid, approvalSource: 'user_scan',
        });
        tx.update(deviceRef, {
          status: 'borrowed', loanStatus: 'borrowed', activeLoanId: loanId, pendingLoanId: null,
          statusSource: 'user_loan', statusSetBy: user.uid, statusSetAt: serverTimestamp(),
          adminBorrowerId: null, adminBorrowerName: null, updatedAt: serverTimestamp(),
        });
      } else {
        tx.update(loanRef, { status: 'rejected', rejectedAt: serverTimestamp(), rejectedBy: user.uid });
        tx.update(deviceRef, {
          status: 'good', loanStatus: 'available', pendingLoanId: null, activeLoanId: null,
          statusSource: 'admin', statusSetBy: user.uid, statusSetAt: serverTimestamp(),
          adminBorrowerId: null, adminBorrowerName: null, updatedAt: serverTimestamp(),
        });
      }
    });
    return { success: true } as T;
  }

  const returnMatch = path.match(/^\/devices\/([^/]+)\/return$/);
  if (returnMatch && body === undefined && role === 'admin') {
    const id = decodeURIComponent(returnMatch[1]).toUpperCase();
    const snap = await getDoc(doc(db, 'gas', id));
    if (!snap.exists()) throw new Error('ไม่พบรหัส VR นี้');
    if (!snap.data().activeLoanId) {
      if (snap.data().status === 'borrowed' && snap.data().statusSource === 'admin') {
        throw new Error('VR นี้ถูกตั้งสถานะยืมโดยแอดมิน กรุณาเปลี่ยนสถานะจากแดชบอร์ด');
      }
      throw new Error('VR เครื่องนี้ไม่มีรายการยืมที่รอคืน');
    }
    const loan = await getDoc(doc(db, 'loans', String(snap.data().activeLoanId)));
    if (!loan.exists() || loan.data().status !== 'borrowed') throw new Error('รายการยืมไม่ถูกต้อง');
    return { loan: toLoan(loan.id, loan.data()) } as T;
  }

  if (path === '/loans/return' && body && role === 'admin') {
    const request = body as { deviceId?: string; loanId?: string };
    const deviceId = String(request.deviceId ?? '').trim().toUpperCase();
    const loanId = String(request.loanId ?? '');
    const deviceRef = doc(db, 'gas', deviceId);
    const loanRef = doc(db, 'loans', loanId);
    await runTransaction(db, async tx => {
      const [deviceSnap, loanSnap] = await Promise.all([tx.get(deviceRef), tx.get(loanRef)]);
      if (!deviceSnap.exists() || deviceSnap.data().activeLoanId !== loanId) throw new Error('รายการยืมเปลี่ยนแล้ว กรุณาสแกนใหม่');
      if (!loanSnap.exists() || loanSnap.data().status !== 'borrowed') throw new Error('รายการนี้รับคืนไปแล้ว');
      tx.update(loanRef, { status: 'returned', returnedAt: serverTimestamp(), returnedBy: user.uid });
      tx.update(deviceRef, {
        status: 'good', loanStatus: 'available', activeLoanId: null, pendingLoanId: null,
        statusSource: 'admin', statusSetBy: user.uid, statusSetAt: serverTimestamp(),
        adminBorrowerId: null, adminBorrowerName: null, updatedAt: serverTimestamp(),
      });
    });
    return { success: true } as T;
  }

  if (path === '/loans/borrow' && body) {
    if (role !== 'user') throw new Error('การยืมสำหรับบัญชี user เท่านั้น');
    const request = body as { deviceId?: string; selfie?: string };
    const id = String(request.deviceId ?? '').trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(id)) throw new Error('รหัส VR ไม่ถูกต้อง');
    const image = request.selfie ?? '';
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image) || image.length > 700000) throw new Error('กรุณาแนบ selfie JPG ขนาดไม่เกิน 500 KB');
    const loanRef = doc(collection(db, 'loans'));
    const deviceRef = doc(db, 'gas', id);
    const photoRef = doc(db, 'loanPhotos', loanRef.id);
    await runTransaction(db, async tx => {
      const deviceSnap = await tx.get(deviceRef);
      if (!deviceSnap.exists()) throw new Error('ไม่พบรหัส VR นี้');
      const device = deviceSnap.data();
      if (device.status !== 'good' || device.activeLoanId || device.pendingLoanId) throw new Error('VR เครื่องนี้ไม่พร้อมให้ยืม หรือมีคำขอรออนุมัติอยู่แล้ว');
      tx.set(loanRef, {
        deviceId: id,
        borrowerId: user.uid,
        borrowerName: String(profile.nickname || profile.name || ''),
        status: 'pending_approval',
        requestedAt: serverTimestamp(),
        borrowedAt: null,
        approvedAt: null,
        approvedBy: null,
        returnedAt: null,
        returnedBy: null,
        approvalSource: 'user_scan',
      });
      tx.set(photoRef, { image, ownerId: user.uid, createdAt: serverTimestamp() });
      tx.update(deviceRef, {
        status: 'pending_approval', loanStatus: 'pending_approval',
        activeLoanId: null, pendingLoanId: loanRef.id,
        statusSource: 'user_loan', statusSetBy: user.uid, statusSetAt: serverTimestamp(),
        adminBorrowerId: null, adminBorrowerName: null, updatedAt: serverTimestamp(),
      });
    });
    return { success: true, status: 'pending_approval' } as T;
  }

  throw new Error('ไม่พบคำสั่งหรือไม่มีสิทธิ์ดำเนินการ');
}

export async function loanImage(path: string): Promise<Blob> {
  const match = path.match(/^\/loans\/([^/]+)\/selfie$/);
  if (!match) throw new Error('ไม่พบรูป');
  const snap = await getDoc(doc(db, 'loanPhotos', decodeURIComponent(match[1])));
  if (!snap.exists()) throw new Error('ไม่พบรูป selfie ของรายการนี้');
  const response = await fetch(String(snap.data().image ?? ''));
  return response.blob();
}

export function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('อ่านรูปไม่สำเร็จ'));
    reader.readAsDataURL(blob);
  });
}
