import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { loanImage, loanRequest } from '../lib/loans.services';
import type { ActiveUser, Device, DeviceStatus, Loan, LoanStatus } from '../lib/loans.services';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { normalizedDevice, toLoan } from '../lib/loans.services';
import { IoIosArrowDown, IoIosArrowUp } from 'react-icons/io';
import { LuEllipsisVertical } from 'react-icons/lu';
import { VRPhotos } from '../components/vr-photos';
import { compressPhoto, photosConfigured, uploadPhoto } from '../lib/cloudinary';
import type { IVRPhoto } from '../interfaces/data.interface';

type Filter = 'all' | 'pending_approval' | 'borrowed' | 'good' | 'damaged';
type EquipmentCategory = NonNullable<Device['category']>;
const categoryLabel: Record<EquipmentCategory, string> = { vr: 'VR', computer: 'เครื่องคอม', monitor: 'จอ', other: 'อื่นๆ' };
const date = (value: string | null) => value ? new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const deviceStatus = (device: Device): Exclude<DeviceStatus, 'minor_damage' | 'major_damage'> => {
  if (device.status === 'minor_damage' || device.status === 'major_damage') return 'damaged';
  return device.status;
};
const deviceLabel = (status: string) => ({ good: 'พร้อมใช้', damaged: 'ชำรุด', minor_damage: 'ชำรุด', major_damage: 'ชำรุด', pending_approval: 'รออนุมัติ', borrowed: 'ยืม' }[status] ?? status);
const deviceTone = (status: string) => ({
  good: 'border-emerald-200 bg-emerald-50',
  pending_approval: 'border-yellow-300 bg-yellow-50',
  borrowed: 'border-red-200 bg-red-50',
  damaged: 'border-gray-300 bg-gray-100',
  minor_damage: 'border-gray-300 bg-gray-100',
  major_damage: 'border-gray-300 bg-gray-100',
}[status] ?? 'border-slate-200 bg-white');
const loanLabel = (status: LoanStatus) => ({ pending_approval: 'รออนุมัติ', borrowed: 'ถูกยืม', returned: 'คืนแล้ว', rejected: 'ไม่อนุมัติ' })[status];
type StatusChange = { id: string; gasId: string; fromStatus: string; toStatus: string; borrowerName: string; performedBy: string; createdAt: string | null };
const timestampToIso = (value: unknown): string | null => {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') return (value.toDate as () => Date)().toISOString();
  return typeof value === 'string' ? value : null;
};

export default function DashboardPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [statusChanges, setStatusChanges] = useState<StatusChange[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [openDeviceId, setOpenDeviceId] = useState<string | null>(null);
  const [devicesExpanded, setDevicesExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(true);
  const [code, setCode] = useState('');
  const [newDeviceNumber, setNewDeviceNumber] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newCategory, setNewCategory] = useState<EquipmentCategory>('vr');
  const [newFacultySerialNumber, setNewFacultySerialNumber] = useState('');
  const [newSerialNumber, setNewSerialNumber] = useState('');
  const [newPhotos, setNewPhotos] = useState<Blob[]>([]);
  const [newPhotoUrls, setNewPhotoUrls] = useState<string[]>([]);
  const [uploadedNewPhotos, setUploadedNewPhotos] = useState<IVRPhoto[]>([]);
  const [newPhotoBusy, setNewPhotoBusy] = useState(false);
  const [newPhotoError, setNewPhotoError] = useState('');
  const [numberChoice, setNumberChoice] = useState<Record<string, string>>({});
  const [categoryChoice, setCategoryChoice] = useState<Record<string, EquipmentCategory>>({});
  const [facultySerialChoice, setFacultySerialChoice] = useState<Record<string, string>>({});
  const [serialChoice, setSerialChoice] = useState<Record<string, string>>({});
  const [deviceCodeChoice, setDeviceCodeChoice] = useState<Record<string, string>>({});
  const [nameChoice, setNameChoice] = useState<Record<string, string>>({});
  const [notesChoice, setNotesChoice] = useState<Record<string, string>>({});
  const [categoryFilter, setCategoryFilter] = useState<'all' | EquipmentCategory>('vr');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [statusChoice, setStatusChoice] = useState<Record<string, string>>({});
  const [borrowerChoice, setBorrowerChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loansLoading, setLoansLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selectedSelfie, setSelectedSelfie] = useState<{ url: string; loan: Loan } | null>(null);
  const [selfieLoadingId, setSelfieLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const urls = newPhotos.map(photo => URL.createObjectURL(photo));
    setNewPhotoUrls(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [newPhotos]);

  useEffect(() => {
    let active = true;
    const previousDevices = new Map<string, Device>();
    setLoading(true);
    setLoansLoading(true);
    setUsersLoading(true);
    setLoadErrors({});
    const failed = (section: string, reason: unknown) => {
      if (active) setLoadErrors(previous => ({ ...previous, [section]: reason instanceof Error ? reason.message : 'กรุณาลองใหม่' }));
    };
    const onError = (section: string, loadingDone?: () => void) => (reason: Error) => {
      failed(section, reason);
      loadingDone?.();
    };
    const stopDevices = onSnapshot(collection(db, 'gas'), snap => {
      if (!active) return;
      const nextDevices = snap.docs.map(item => normalizedDevice({ ...item.data(), id: item.id }));
      setDevices(nextDevices);
      setNumberChoice(previous => Object.fromEntries(nextDevices.map(item => [item.id, previousDevices.has(item.id) && previous[item.id] !== previousDevices.get(item.id)?.deviceNumber ? previous[item.id] : item.deviceNumber ?? ''])));
      setStatusChoice(previous => Object.fromEntries(nextDevices.map(item => {
        const old = previousDevices.get(item.id);
        return [item.id, old && previous[item.id] !== deviceStatus(old) ? previous[item.id] : deviceStatus(item)];
      })));
      setBorrowerChoice(previous => Object.fromEntries(nextDevices.map(item => {
        const old = previousDevices.get(item.id);
        return [item.id, old && previous[item.id] !== (old.adminBorrowerId ?? '') ? previous[item.id] : item.adminBorrowerId ?? ''];
      })));
      previousDevices.clear();
      nextDevices.forEach(item => previousDevices.set(item.id, item));
      setLoading(false);
    }, onError('รายการอุปกรณ์', () => setLoading(false)));
    const stopLoans = onSnapshot(collection(db, 'loans'), snap => {
      if (!active) return;
      setLoans(snap.docs.map(item => toLoan(item.id, item.data()))
        .sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? '')));
      setLoansLoading(false);
    }, onError('ประวัติยืม', () => setLoansLoading(false)));
    const stopStatusChanges = onSnapshot(query(collection(db, 'transactions'), where('eventType', '==', 'status_change')), snap => {
      if (!active) return;
      const changes = snap.docs.flatMap(item => {
        const d = item.data();
        if (typeof d.gasId !== 'string') return [];
        return [{ id: item.id, gasId: d.gasId, fromStatus: String(d.fromStatus ?? ''), toStatus: String(d.toStatus ?? ''), borrowerName: String(d.borrowerName ?? ''), performedBy: String(d.performedBy ?? ''), createdAt: timestampToIso(d.createdAt) }];
      });
      setStatusChanges(changes.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')));
    }, onError('ประวัติเปลี่ยนสถานะ'));
    const stopUsers = onSnapshot(query(collection(db, 'users'), where('status', '==', 'active')), snap => {
      if (!active) return;
      setUsers(snap.docs.map(item => ({ id: item.id, name: String(item.data().name ?? ''), nickname: String(item.data().nickname ?? ''), role: item.data().role === 'admin' ? 'admin' : 'user' })));
      setUsersLoading(false);
    }, onError('รายชื่อผู้ใช้', () => setUsersLoading(false)));
    return () => {
      active = false;
      stopDevices();
      stopLoans();
      stopStatusChanges();
      stopUsers();
    };
  }, [refresh]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy || newPhotoBusy) return;
    setBusy(true); setError(''); setNewPhotoError('');
    try {
      if (newPhotos.length > 0 && !photosConfigured) throw new Error('ยังไม่ได้ตั้งค่าการอัปโหลดรูป กรุณาติดต่อผู้ดูแล');
      const photos = [...uploadedNewPhotos];
      for (let index = photos.length; index < newPhotos.length; index++) {
        photos[index] = await uploadPhoto(newPhotos[index]);
        setUploadedNewPhotos([...photos]);
      }
      await loanRequest('/devices', { deviceId: code.trim().toUpperCase(), deviceNumber: newDeviceNumber, name: newDeviceName, notes: newNotes, category: newCategory, facultySerialNumber: newFacultySerialNumber, serialNumber: newSerialNumber, photos });
      setCode(''); setNewDeviceNumber(''); setNewDeviceName(''); setNewNotes(''); setNewFacultySerialNumber(''); setNewSerialNumber(''); setNewCategory('vr'); setNewPhotos([]); setUploadedNewPhotos([]); setRefresh(value => value + 1);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function chooseNewPhotos(files: File[]) {
    if (files.length > 10) { setNewPhotoError('เลือกได้ไม่เกิน 10 รูป'); return; }
    setNewPhotoBusy(true); setNewPhotoError('');
    try {
      const compressed: Blob[] = [];
      for (const file of files) compressed.push(await compressPhoto(file));
      setNewPhotos(compressed);
      setUploadedNewPhotos([]);
    } catch (e) { setNewPhotoError((e as Error).message); }
    finally { setNewPhotoBusy(false); }
  }

  async function viewSelfie(loan: Loan) {
    setSelfieLoadingId(loan.id); setError('');
    try {
      const blob = await loanImage(`/loans/${encodeURIComponent(loan.id)}/selfie`);
      setSelectedSelfie({ url: URL.createObjectURL(blob), loan });
    } catch (e) { setError((e as Error).message); }
    finally { setSelfieLoadingId(null); }
  }

  async function reviewLoan(loan: Loan, action: 'approve' | 'reject') {
    setBusy(true); setError('');
    try {
      await loanRequest(`/loans/${encodeURIComponent(loan.id)}/${action}`);
      setRefresh(value => value + 1);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function saveDeviceStatus(device: Device) {
    const status = statusChoice[device.id] ?? deviceStatus(device);
    setBusy(true); setError('');
    try {
      await loanRequest(`/devices/${encodeURIComponent(device.id)}/status`, {
        status,
        borrowerId: status === 'borrowed' ? borrowerChoice[device.id] : undefined,
      });
      setRefresh(value => value + 1);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function saveDeviceNumber(device: Device) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await loanRequest(`/devices/${encodeURIComponent(device.id)}/number`, { deviceNumber: numberChoice[device.id] ?? '' });
      setRefresh(value => value + 1);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function saveDeviceDetails(device: Device) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await loanRequest(`/devices/${encodeURIComponent(device.id)}/details`, {
        deviceCode: deviceCodeChoice[device.id] ?? device.deviceCode ?? device.id,
        name: nameChoice[device.id] ?? device.name ?? '',
        notes: notesChoice[device.id] ?? device.notes ?? '',
        category: categoryChoice[device.id] ?? device.category ?? 'vr',
        facultySerialNumber: facultySerialChoice[device.id] ?? device.facultySerialNumber ?? '',
        serialNumber: serialChoice[device.id] ?? device.serialNumber ?? '',
      });
      setRefresh(value => value + 1);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  async function deleteDevice(device: Device) {
    if (busy) return;
    const result = await Swal.fire({
      icon: 'warning',
      title: 'ลบอุปกรณ์?',
      text: `ต้องการลบอุปกรณ์ "${device.deviceCode}"${device.deviceNumber ? ` เบอร์ ${device.deviceNumber}` : ''} ใช่หรือไม่? ประวัติการยืมเดิมจะยังคงอยู่`,
      showCancelButton: true,
      confirmButtonText: 'ลบอุปกรณ์',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      focusCancel: true,
    });
    if (!result.isConfirmed) return;
    setBusy(true); setError('');
    try {
      await loanRequest(`/devices/${encodeURIComponent(device.id)}/delete`, {});
      setRefresh(value => value + 1);
      await Swal.fire({ icon: 'success', title: 'ลบอุปกรณ์แล้ว', confirmButtonText: 'ตกลง' });
    } catch (e) {
      setError((e as Error).message);
      await Swal.fire({ icon: 'error', title: 'ลบอุปกรณ์ไม่สำเร็จ', text: (e as Error).message, confirmButtonText: 'ตกลง' });
    } finally { setBusy(false); }
  }

  const pendingCount = devices.filter(item => deviceStatus(item) === 'pending_approval').length;
  const summaryDevices = categoryFilter === 'all' ? devices : devices.filter(device => (device.category ?? 'vr') === categoryFilter);
  const summaryPendingCount = summaryDevices.filter(item => deviceStatus(item) === 'pending_approval').length;
  const summaryBorrowedCount = summaryDevices.filter(item => deviceStatus(item) === 'borrowed').length;
  const summaryGoodCount = summaryDevices.filter(item => deviceStatus(item) === 'good').length;
  const summaryDamagedCount = summaryDevices.filter(item => ['damaged', 'minor_damage', 'major_damage'].includes(item.status)).length;
  const categoryTiles = (Object.keys(categoryLabel) as EquipmentCategory[]).map(category => ({
    category,
    label: categoryLabel[category],
    count: devices.filter(device => (device.category ?? 'vr') === category).length,
  }));

  const visibleDevices = useMemo(() => {
    const term = search.trim().toLowerCase();
    return devices.filter(device => {
      const status = deviceStatus(device);
      const matchText = !term || device.id.toLowerCase().includes(term)
        || (device.deviceNumber ?? '').toLowerCase().includes(term)
        || device.deviceCode.toLowerCase().includes(term)
        || (device.name ?? '').toLowerCase().includes(term)
        || (device.notes ?? '').toLowerCase().includes(term)
        || (device.facultySerialNumber ?? '').toLowerCase().includes(term)
        || (device.serialNumber ?? '').toLowerCase().includes(term)
        || categoryLabel[device.category ?? 'vr'].toLowerCase().includes(term)
        || (device.adminBorrowerName ?? '').toLowerCase().includes(term)
        || loans.some(loan => loan.deviceId === device.id && loan.borrowerName.toLowerCase().includes(term));
      const matchFilter = filter === 'all' || status === filter;
      const matchCategory = categoryFilter === 'all' || (device.category ?? 'vr') === categoryFilter;
      return matchText && matchFilter && matchCategory;
    }).sort((a, b) => {
      const left = a.deviceNumber?.trim() ?? '';
      const right = b.deviceNumber?.trim() ?? '';
      if (!left || !right) return left ? -1 : right ? 1 : a.id.localeCompare(b.id, 'th', { numeric: true });
      return left.localeCompare(right, 'th', { numeric: true, sensitivity: 'base' })
        || a.id.localeCompare(b.id, 'th', { numeric: true });
    });
  }, [devices, loans, search, filter, categoryFilter]);

  const visibleLoans = useMemo(() => {
    const term = search.trim().toLowerCase();
    return loans.filter(loan => !term || loan.deviceId.toLowerCase().includes(term) || loan.borrowerName.toLowerCase().includes(term));
  }, [loans, search]);
  const visibleStatusChanges = useMemo(() => {
    const term = search.trim().toLowerCase();
    return statusChanges.filter(item => !term || item.gasId.toLowerCase().includes(term) || item.borrowerName.toLowerCase().includes(term));
  }, [statusChanges, search]);
  const historyRows = useMemo(() => [
    ...visibleStatusChanges.map(item => ({ kind: 'status' as const, item, time: item.createdAt ?? '' })),
    ...visibleLoans.map(item => ({ kind: 'loan' as const, item, time: item.returnedAt ?? item.rejectedAt ?? item.approvedAt ?? item.borrowedAt ?? item.requestedAt ?? '' })),
  ].sort((a, b) => b.time.localeCompare(a.time)), [visibleLoans, visibleStatusChanges]);

  const tiles: { label: string; value: number; filter: Filter; color: string }[] = [
    { label: 'รออนุมัติ', value: summaryPendingCount, filter: 'pending_approval', color: 'bg-yellow-100' },
    { label: 'ถูกยืม', value: summaryBorrowedCount, filter: 'borrowed', color: 'bg-red-100' },
    { label: 'พร้อมใช้', value: summaryGoodCount, filter: 'good', color: 'bg-emerald-100' },
    { label: 'ชำรุด', value: summaryDamagedCount, filter: 'damaged', color: 'bg-gray-200' },
    { label: 'อุปกรณ์ทั้งหมด', value: summaryDevices.length, filter: 'all', color: 'bg-slate-100' },
  ];

  return <main className="dashboard">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="page-heading !mb-0"><h1>ภาพรวมอุปกรณ์</h1><p>จัดการอุปกรณ์ทุกประเภท พร้อมติดตามสถานะและการยืม</p></div>
        <Link to="/admin/return" className="rounded-xl bg-blue-900 px-5 py-3 font-bold text-white">สแกนรับคืนอุปกรณ์</Link>
      </header>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
      {Object.entries(loadErrors).map(([section, message]) => <p key={section} role="alert" className="rounded-xl bg-amber-50 p-3 text-amber-900">โหลด{section}ไม่สำเร็จ: {message} — กดรีเฟรชข้อมูลเพื่อลองอีกครั้ง</p>)}

      <section aria-label="สรุปและตัวกรองอุปกรณ์" className="space-y-4">
        <div className="flex justify-end">
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
            ประเภท:
            <select aria-label="กรองตามประเภทอุปกรณ์" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as 'all' | EquipmentCategory)} className="min-h-10 min-w-36 border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-700">
              <option value="all">ทั้งหมด ({devices.length})</option>
              {categoryTiles.map(tile => <option key={tile.category} value={tile.category}>{tile.label} ({tile.count})</option>)}
            </select>
          </label>
        </div>
        <div aria-label="สรุปสถานะอุปกรณ์" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {tiles.map(tile => <button key={tile.filter} aria-pressed={filter === tile.filter} onClick={() => setFilter(tile.filter)} className={`${tile.color} rounded-2xl p-4 text-left ring-offset-2 transition hover:ring-2 hover:ring-slate-400 ${filter === tile.filter ? 'ring-2 ring-slate-500' : ''}`}>
            <span className="block text-sm text-slate-600">{tile.label}</span><span className="mt-1 block text-3xl font-bold">{tile.value}</span>
          </button>)}
        </div>
      </section>

      <section className="rounded-2xl border border-yellow-200 bg-yellow-50/70 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold">คำขอรออนุมัติ <span className="ml-1 rounded-full bg-yellow-200 px-2 py-0.5 text-sm text-yellow-900">{pendingCount}</span></h2></div>
          <Link to="#loan-history" className="text-sm font-semibold text-blue-700">ดูประวัติ ↓</Link>
        </div>
        {loansLoading && pendingCount === 0 ? <p role="status" className="text-sm text-slate-500">กำลังตรวจสอบคำขอ…</p> : pendingCount === 0 ? <p className="text-sm text-slate-600">ไม่มีคำขอรออนุมัติในขณะนี้</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {loans.filter(loan => loan.status === 'pending_approval').map(loan => {
            const device = devices.find(item => item.id === loan.deviceId);
            return <article key={loan.id} className="rounded-xl border border-yellow-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{device?.name || `${categoryLabel[device?.category ?? 'vr']} ${device?.deviceNumber || loan.deviceId}`}</h3><p className="text-xs text-slate-500">รหัสอุปกรณ์ {device?.deviceCode || loan.deviceCode || loan.deviceId}</p></div><span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-900">รออนุมัติ</span></div>
              <p className="mt-3 text-sm">ผู้ขอยืม <b>{loan.borrowerName}</b></p>
              <p className="text-xs text-slate-500">ส่งคำขอ {date(loan.requestedAt)}</p>
              <div className="mt-4 flex gap-2"><button type="button" disabled={busy} onClick={() => void viewSelfie(loan)} className="flex-1 rounded-lg border px-3 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50">{selfieLoadingId === loan.id ? 'กำลังโหลดรูป…' : 'ดูรูปแนบ'}</button><button type="button" disabled={busy} onClick={() => void reviewLoan(loan, 'reject')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">ปฏิเสธ</button><button type="button" disabled={busy} onClick={() => void reviewLoan(loan, 'approve')} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">อนุมัติ</button></div>
            </article>;
          })}
        </div>}
      </section>

      <section className="rounded-2xl border bg-white p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">รายการอุปกรณ์</h2><p className="text-sm text-slate-500">จัดการข้อมูลประจำตัว อัลบั้มรูป และสถานะการยืม</p></div>
          <div className="flex gap-2">
            <button type="button" aria-expanded={devicesExpanded} aria-controls="device-list-content" onClick={() => setDevicesExpanded(value => !value)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold">{devicesExpanded ? <><IoIosArrowUp aria-hidden="true" />ซ่อนรายการ</> : <><IoIosArrowDown aria-hidden="true" />แสดงรายการ</>}</button>
            <button onClick={() => setRefresh(value => value + 1)} disabled={busy} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{loading ? 'กำลังโหลด · ลองใหม่' : 'รีเฟรชข้อมูล'}</button>
          </div>
        </div>
        {devicesExpanded && <div id="device-list-content">
        <form onSubmit={add} className="mb-5 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-12">
          <label className="block min-w-0 text-xs font-semibold text-slate-600 lg:col-span-2">ประเภทอุปกรณ์
            <select aria-label="ประเภทอุปกรณ์ใหม่" value={newCategory} onChange={e => setNewCategory(e.target.value as EquipmentCategory)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900">{Object.entries(categoryLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
          <label className="block min-w-0 text-xs font-semibold text-slate-600 lg:col-span-2">รหัสอุปกรณ์
            <input aria-label="รหัสอุปกรณ์ใหม่" required maxLength={64} placeholder="กรอกรหัสที่ต้องการ" value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900" />
          </label>
          <label className="block min-w-0 text-xs font-semibold text-slate-600 lg:col-span-3">ชื่ออุปกรณ์
            <input aria-label="ชื่ออุปกรณ์" required maxLength={100} placeholder="เช่น คอมพิวเตอร์ห้อง 1" value={newDeviceName} onChange={e => setNewDeviceName(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900" />
          </label>
          <label className="block min-w-0 text-xs font-semibold text-slate-600 lg:col-span-2">เลขครุภัณฑ์คณะ
            <input aria-label="เลขครุภัณฑ์คณะ" maxLength={100} placeholder="ถ้ามี" value={newFacultySerialNumber} onChange={e => setNewFacultySerialNumber(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900" />
          </label>
          <label className="block min-w-0 text-xs font-semibold text-slate-600 lg:col-span-3">Serial number
            <input aria-label="Serial number" maxLength={100} placeholder="Serial number ของอุปกรณ์" value={newSerialNumber} onChange={e => setNewSerialNumber(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900" />
          </label>
          <div className="space-y-2 lg:col-span-12">
            <label className="block min-w-0 text-xs font-semibold text-slate-600">อัลบั้มรูปอุปกรณ์ <span className="font-normal">(เลือกได้หลายรูป)</span>
              <input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy || newPhotoBusy || !photosConfigured} onChange={e => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = '';
                if (files.length > 0) void chooseNewPhotos(files);
              }} className="mt-1.5 block w-full text-sm font-normal text-slate-700 disabled:opacity-50" />
            </label>
            <p className="text-xs text-slate-500">เลือกได้ไม่เกิน 10 รูป · JPG, PNG หรือ WebP · ไม่เกิน 20 MB ต่อรูป</p>
            {!photosConfigured && <p className="text-xs text-amber-800">ยังไม่ได้ตั้งค่าการอัปโหลดรูป กรุณาติดต่อผู้ดูแล</p>}
            {newPhotoBusy && <p role="status" className="text-sm text-slate-600">กำลังเตรียมรูป…</p>}
            {newPhotoUrls.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{newPhotoUrls.map((url, index) => <img key={url} src={url} alt={`ตัวอย่างรูปอัลบั้ม ${index + 1}`} className="h-24 w-full border border-slate-200 bg-white object-cover" />)}</div>}
            {uploadedNewPhotos.length > 0 && <p className="text-xs text-slate-600">อัปโหลดแล้ว {uploadedNewPhotos.length} จาก {newPhotos.length} รูป · กดเพิ่มอุปกรณ์อีกครั้งเพื่อทำต่อ</p>}
            {newPhotoError && <p role="alert" className="text-sm text-red-700">{newPhotoError}</p>}
          </div>
          <label className="block min-w-0 text-xs font-semibold text-slate-600 lg:col-span-6">หมายเหตุ
            <textarea aria-label="หมายเหตุ" maxLength={1000} placeholder="บันทึกเพิ่มเติม เช่น จุดสังเกตหรือการดูแล (ถ้ามี)" value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={2} className="mt-1.5 min-h-20 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900" />
          </label>
          <label className="block min-w-0 text-xs font-semibold text-slate-600 lg:col-span-9">เบอร์เครื่อง <span className="font-normal text-slate-500">(ไม่จำเป็น)</span>
            <input aria-label="เบอร์เครื่อง (ไม่จำเป็น)" maxLength={64} placeholder="เบอร์เครื่อง" value={newDeviceNumber} onChange={e => setNewDeviceNumber(e.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900" />
          </label>
          <button disabled={busy} className="min-h-11 self-end rounded-lg bg-indigo-950 px-5 py-3 font-bold text-white transition hover:bg-indigo-900 disabled:opacity-40 lg:col-span-3">{busy ? 'กำลังบันทึก…' : 'เพิ่มอุปกรณ์'}</button>
        </form>
        <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block text-sm font-medium">ค้นหารหัส อุปกรณ์ หรือเลขประจำเครื่อง<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="พิมพ์เพื่อค้นหา" className="mt-1 block w-full rounded-xl border p-3" /></label>
          <label className="block text-sm font-medium">ประเภท<select aria-label="กรองตามประเภทอุปกรณ์" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as 'all' | EquipmentCategory)} className="mt-1 block w-full rounded-xl border bg-white p-3"><option value="all">ทุกประเภท</option>{Object.entries(categoryLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        {loading && devices.length > 0 && <p role="status" className="mb-3 text-sm text-slate-500">กำลังอัปเดตรายการ…</p>}
        {loading && devices.length === 0 ? <p role="status" className="py-8 text-center text-slate-500">กำลังโหลดรายการอุปกรณ์…</p> : visibleDevices.length === 0 ? <p className="py-8 text-center text-slate-500">{loadErrors['รายการอุปกรณ์'] ? 'ยังโหลดรายการอุปกรณ์ไม่สำเร็จ กรุณาลองใหม่' : 'ไม่พบอุปกรณ์'}</p> : <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleDevices.map(device => {
            const status = deviceStatus(device);
            const activeLoan = device.activeLoanId ? loans.find(loan => loan.id === device.activeLoanId) : undefined;
            const pendingLoan = device.pendingLoanId ? loans.find(loan => loan.id === device.pendingLoanId) : undefined;
            const latestReturn = loans.filter(loan => loan.deviceId === device.id && loan.status === 'returned' && loan.returnedAt)
              .sort((a, b) => (b.returnedAt ?? '').localeCompare(a.returnedAt ?? ''))[0];
            const returnedBy = users.find(item => item.id === latestReturn?.returnedBy);
            const settingsOpen = openDeviceId === device.id;
            const disabled = Boolean(device.activeLoanId || device.pendingLoanId) || busy;
            const selectedStatus = statusChoice[device.id] ?? status;
            const hasStatusChanges = selectedStatus !== status
              || (selectedStatus === 'borrowed' && (borrowerChoice[device.id] ?? '') !== (device.adminBorrowerId ?? ''));
            return <article key={device.id} className={`rounded-xl border p-4 ${deviceTone(status)}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="break-words text-2xl font-bold">{device.name || device.deviceNumber || categoryLabel[device.category ?? 'vr']}</h3>
                  <p className="mt-1 break-all font-mono text-xs text-slate-500">{device.deviceCode} · {categoryLabel[device.category ?? 'vr']}</p>
                  {(device.facultySerialNumber || device.serialNumber) && <p className="mt-1 break-words text-xs text-slate-600">{device.facultySerialNumber && <span className="block"><span className="font-normal">เลขครุภัณฑ์ </span><span className="font-semibold">{device.facultySerialNumber}</span></span>}{device.serialNumber && <span className="block"><span className="font-normal">Serial </span><span className="font-semibold">{device.serialNumber}</span></span>}</p>}
                  {device.notes && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600"><span className="font-semibold">หมายเหตุ:</span> {device.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="inline-flex h-8 items-center rounded-full bg-white/80 px-2.5 text-xs font-semibold">{deviceLabel(status)}</span>
                  <button type="button" aria-label={`แก้ไขข้อมูลอุปกรณ์ ${device.deviceNumber || device.deviceCode}`} aria-expanded={settingsOpen} aria-controls={`device-settings-${device.id}`} onClick={() => setOpenDeviceId(settingsOpen ? null : device.id)} className="inline-flex h-8 w-9 items-center justify-center border border-slate-300 bg-white p-0 text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-700"><LuEllipsisVertical aria-hidden="true" size={18} /></button>
                </div>
              </div>
              {status === 'borrowed' && activeLoan && <p className="mt-3 text-sm">ผู้ยืม <b>{activeLoan.borrowerName}</b><br /><span className="text-slate-600">ยืมเมื่อ {date(activeLoan.borrowedAt)}</span></p>}
              {status === 'borrowed' && device.statusSource === 'admin' && !activeLoan && <p className="mt-3 text-sm">ผู้ยืม <b>{device.adminBorrowerName || 'ไม่ระบุผู้ยืม'}</b><br /><span className="text-slate-600">ตั้งสถานะยืมเมื่อ {date(device.statusSetAt ?? null)}</span><br /><span className="text-xs text-slate-500">ตั้งโดยแอดมิน</span></p>}
              {status === 'borrowed' && device.activeLoanId && !activeLoan && <p className="mt-3 text-sm text-slate-600">{loansLoading ? 'กำลังโหลดข้อมูลผู้ยืม…' : 'ยังโหลดข้อมูลผู้ยืมไม่สำเร็จ กรุณารีเฟรช'}</p>}
              {latestReturn && <div className="mt-3 border-t border-black/10 pt-3 text-sm">
                <p>คืนล่าสุดจาก <b>{latestReturn.borrowerName || 'ไม่ระบุชื่อ'}</b></p>
                <p className="text-slate-600">{date(latestReturn.returnedAt)}</p>
                {latestReturn.returnedBy && <p className="text-xs text-slate-500">รับคืนโดย {returnedBy?.nickname || returnedBy?.name || 'แอดมิน (ไม่พบชื่อ)'}</p>}
              </div>}
              {settingsOpen && <div id={`device-settings-${device.id}`} className="mt-4 border-t border-black/10 pt-1">
              <label className="mt-3 block text-xs font-semibold text-slate-700">รหัสอุปกรณ์ <span className="font-normal text-slate-500">(ใช้สแกน QR)</span>
                <input required maxLength={64} value={deviceCodeChoice[device.id] ?? device.deviceCode ?? device.id} disabled={busy} onChange={e => setDeviceCodeChoice(current => ({ ...current, [device.id]: e.target.value.toUpperCase() }))} placeholder="รหัสอุปกรณ์" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm disabled:opacity-50" />
                <span className="mt-1 block font-normal text-slate-500">กำหนดรหัสได้ตามต้องการ ไม่เกิน 64 ตัวอักษร · ประวัติเดิมยังเชื่อมกับอุปกรณ์นี้</span>
              </label>
              <label className="mt-3 block text-xs font-semibold text-slate-700">ชื่ออุปกรณ์ <span className="font-normal text-slate-500">(ถ้ามี)</span>
                <input maxLength={100} value={nameChoice[device.id] ?? device.name ?? ''} disabled={busy} onChange={e => setNameChoice(current => ({ ...current, [device.id]: e.target.value }))} placeholder="ชื่อเรียกอุปกรณ์" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm disabled:opacity-50" />
              </label>
              <label className="mt-3 block text-xs font-semibold text-slate-700">หมายเหตุ
                <textarea maxLength={1000} rows={3} value={notesChoice[device.id] ?? device.notes ?? ''} disabled={busy} onChange={e => setNotesChoice(current => ({ ...current, [device.id]: e.target.value }))} placeholder="บันทึกหมายเหตุ" className="mt-1 w-full resize-y rounded-lg border border-slate-300 bg-white p-2.5 text-sm disabled:opacity-50" />
              </label>
              <label className="mt-3 block text-xs font-semibold text-slate-700">ประเภทอุปกรณ์
                <select value={categoryChoice[device.id] ?? device.category ?? 'vr'} disabled={busy} onChange={e => setCategoryChoice(current => ({ ...current, [device.id]: e.target.value as EquipmentCategory }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm disabled:opacity-50">{Object.entries(categoryLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              </label>
              <label className="mt-3 block text-xs font-semibold text-slate-700">เลขครุภัณฑ์คณะ
                <input maxLength={100} value={facultySerialChoice[device.id] ?? device.facultySerialNumber ?? ''} disabled={busy} onChange={e => setFacultySerialChoice(current => ({ ...current, [device.id]: e.target.value }))} placeholder="ยังไม่ระบุ" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm disabled:opacity-50" />
              </label>
              <label className="mt-3 block text-xs font-semibold text-slate-700">Serial number
                <input maxLength={100} value={serialChoice[device.id] ?? device.serialNumber ?? ''} disabled={busy} onChange={e => setSerialChoice(current => ({ ...current, [device.id]: e.target.value }))} placeholder="ยังไม่ระบุ" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm disabled:opacity-50" />
              </label>
              {(deviceCodeChoice[device.id] ?? device.deviceCode ?? device.id) !== (device.deviceCode ?? device.id) || (nameChoice[device.id] ?? device.name ?? '') !== (device.name ?? '') || (notesChoice[device.id] ?? device.notes ?? '') !== (device.notes ?? '') || (categoryChoice[device.id] ?? device.category ?? 'vr') !== (device.category ?? 'vr') || (facultySerialChoice[device.id] ?? device.facultySerialNumber ?? '') !== (device.facultySerialNumber ?? '') || (serialChoice[device.id] ?? device.serialNumber ?? '') !== (device.serialNumber ?? '') ? <button type="button" disabled={busy} onClick={() => void saveDeviceDetails(device)} className="mt-2 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">บันทึกข้อมูลอุปกรณ์</button> : null}
              <VRPhotos key={device.id} deviceId={device.id} photos={device.photos} onAdded={photo => setDevices(current => current.map(item => item.id === device.id ? { ...item, photos: [...(item.photos ?? []).filter(existing => existing.publicId !== photo.publicId), photo] } : item))} />
              <label className="mt-3 block text-xs font-semibold text-slate-700">เบอร์เครื่อง <span className="font-normal text-slate-500">(เช่น 1)</span>
                <input maxLength={64} value={numberChoice[device.id] ?? ''} disabled={busy} onChange={e => setNumberChoice(current => ({ ...current, [device.id]: e.target.value }))} placeholder="ยังไม่ระบุเบอร์เครื่อง" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm disabled:opacity-50" />
              </label>
              {(numberChoice[device.id] ?? '').trim() !== (device.deviceNumber ?? '') && <button type="button" disabled={busy} onClick={() => void saveDeviceNumber(device)} className="mt-2 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">บันทึกเบอร์เครื่อง</button>}
              {pendingLoan && <p className="mt-3 text-sm">คำขอจาก <b>{pendingLoan.borrowerName}</b><br /><span className="text-slate-600">ส่งเมื่อ {date(pendingLoan.requestedAt)}</span></p>}
              {pendingLoan && <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => void viewSelfie(pendingLoan)} className="flex-1 rounded-lg border bg-white px-3 py-2 text-sm">{selfieLoadingId === pendingLoan.id ? 'กำลังโหลดรูป…' : 'ดูรูปแนบ'}</button><button type="button" disabled={busy} onClick={() => void reviewLoan(pendingLoan, 'approve')} className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">อนุมัติ</button><button type="button" disabled={busy} onClick={() => void reviewLoan(pendingLoan, 'reject')} className="rounded-lg bg-gray-700 px-3 py-2 text-sm font-semibold text-white">ไม่อนุมัติ</button></div>}
              <div className="mt-4 border-t border-black/10 pt-3">
                <label className="block text-xs font-semibold text-slate-700">กำหนดสถานะโดยแอดมิน
                  <select aria-label={`สถานะอุปกรณ์ ${device.id}`} value={statusChoice[device.id] ?? status} disabled={disabled} onChange={e => setStatusChoice(current => ({ ...current, [device.id]: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm disabled:bg-slate-100">
                    <option value="good">พร้อมใช้</option><option value="damaged">ชำรุด</option><option value="borrowed">ยืม (กำหนดโดยแอดมิน)</option>
                  </select>
                </label>
                {(statusChoice[device.id] ?? status) === 'borrowed' && <label className="mt-2 block text-xs font-semibold text-slate-700">ผู้ถืออุปกรณ์ (ไม่จำเป็น)
                  <select value={borrowerChoice[device.id] ?? ''} disabled={disabled || usersLoading || Boolean(loadErrors['รายชื่อผู้ใช้'])} onChange={e => setBorrowerChoice(current => ({ ...current, [device.id]: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"><option value="">{usersLoading ? 'กำลังโหลดรายชื่อ…' : 'ไม่ระบุผู้ยืม'}</option>{device.adminBorrowerId && !users.some(item => item.id === device.adminBorrowerId) && <option value={device.adminBorrowerId}>{device.adminBorrowerName || device.adminBorrowerId}</option>}{users.filter(item => item.role === 'user').map(item => <option key={item.id} value={item.id}>{item.nickname || item.name || item.id}</option>)}</select>
                </label>}
                {hasStatusChanges && <button type="button" disabled={disabled} onClick={() => void saveDeviceStatus(device)} className="mt-2 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">บันทึกสถานะ</button>}
              </div>
              <button type="button" disabled={disabled} onClick={() => void deleteDevice(device)} className="mt-3 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-40">ลบอุปกรณ์</button>
              {(device.activeLoanId || device.pendingLoanId) && <p className="mt-1 text-xs text-slate-500">ต้องรับคืนหรือปฏิเสธคำขอที่ค้างอยู่ก่อนลบ</p>}
              </div>}
            </article>;
          })}
        </div>}
        <p className="mt-3 text-right text-sm text-slate-500">แสดง {visibleDevices.length} จาก {devices.length} ชิ้น</p>
        </div>}
      </section>

      <section id="loan-history" className="rounded-2xl border bg-white p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold">คำขอยืมและประวัติ</h2><p className="text-sm text-slate-500">ตรวจรูปและอนุมัติคำขอยืมอุปกรณ์</p></div>
          <button type="button" aria-expanded={historyExpanded} aria-controls="loan-history-content" onClick={() => setHistoryExpanded(value => !value)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold">{historyExpanded ? <><IoIosArrowUp aria-hidden="true" />ซ่อนประวัติ</> : <><IoIosArrowDown aria-hidden="true" />แสดงประวัติ</>}</button>
        </div>
        {historyExpanded && <div id="loan-history-content">
        {historyRows.length === 0 ? <p className="py-5 text-center text-slate-500">{loansLoading ? 'กำลังโหลดประวัติยืม…' : loadErrors['ประวัติยืม'] || loadErrors['ประวัติเปลี่ยนสถานะ'] ? 'ยังโหลดประวัติไม่สำเร็จ' : 'ยังไม่มีรายการ'}</p> : <div className="overflow-x-auto"><table className="loan-history-table w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">รหัสอุปกรณ์</th><th className="p-3">เบอร์เครื่อง</th><th className="p-3">ผู้ใช้</th><th className="p-3">รูป selfie</th><th className="p-3">สถานะ</th><th className="p-3">ส่งคำขอ</th><th className="p-3">ยืมสำเร็จ</th><th className="p-3">คืน</th><th className="p-3">การดำเนินการ</th></tr></thead><tbody>{historyRows.map(row => {
          if (row.kind === 'status') {
          const { item } = row;
          const device = devices.find(entry => entry.id === item.gasId);
          const statusLabel = (status: string) => ({ good: 'พร้อมใช้', damaged: 'ชำรุด', minor_damage: 'ชำรุด', major_damage: 'ชำรุด', borrowed: 'ยืม' }[status] ?? status);
          const actor = users.find(user => user.id === item.performedBy);
          return <tr key={`status-${item.id}`} className="border-b last:border-0 bg-indigo-50/40">
            <td data-label="รหัสอุปกรณ์" className="p-3 font-mono font-bold">{devices.find(device => device.id === item.gasId)?.deviceCode ?? item.gasId}</td>
            <td data-label="เบอร์เครื่อง" className="p-3">{device?.deviceNumber?.trim() || 'ไม่ระบุ'}</td>
            <td data-label="ผู้ใช้" className="p-3">{item.borrowerName || '—'}</td>
            <td data-label="รูป selfie" className="p-3">—</td>
            <td data-label="สถานะ" className="p-3"><span className="font-semibold">{statusLabel(item.fromStatus)} → {statusLabel(item.toStatus)}</span></td>
            <td data-label="ส่งคำขอ" className="p-3">{date(item.createdAt)}</td>
            <td data-label="ยืมสำเร็จ" className="p-3">—</td>
            <td data-label="คืน" className="p-3">—</td>
            <td data-label="การดำเนินการ" className="p-3">ตั้งสถานะโดย {actor?.nickname || actor?.name || 'แอดมิน'}</td>
          </tr>;
          }
          const loan = row.item;
          const deviceNumber = devices.find(device => device.id === loan.deviceId)?.deviceNumber?.trim();
          const operatorId = loan.returnedBy ?? loan.rejectedBy ?? loan.approvedBy;
          const operator = users.find(user => user.id === operatorId);
          const operation = loan.returnedAt
            ? `รับคืนโดย ${operator?.nickname || operator?.name || 'แอดมิน'}`
            : loan.status === 'rejected'
              ? `ปฏิเสธโดย ${operator?.nickname || operator?.name || 'แอดมิน'}`
              : loan.approvedBy
                ? `อนุมัติโดย ${operator?.nickname || operator?.name || 'แอดมิน'}`
                : loan.approvalSource === 'admin' ? 'บันทึกโดยแอดมิน' : '—';
          return <tr key={loan.id} className="border-b last:border-0">
            <td data-label="รหัสอุปกรณ์" className="p-3 font-mono font-bold">{devices.find(device => device.id === loan.deviceId)?.deviceCode ?? loan.deviceCode ?? loan.deviceId}</td>
            <td data-label="เบอร์เครื่อง" className="p-3">{deviceNumber || 'ไม่ระบุ'}</td>
            <td data-label="ผู้ใช้" className="p-3">{loan.borrowerName}</td>
            <td data-label="รูป selfie" className="p-3"><button type="button" onClick={() => void viewSelfie(loan)} disabled={selfieLoadingId === loan.id} className="rounded-lg border px-3 py-2 text-xs font-semibold text-blue-800 disabled:opacity-50">{selfieLoadingId === loan.id ? 'กำลังโหลด…' : 'ดูรูป'}</button></td>
            <td data-label="สถานะ" className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${loan.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-900' : loan.status === 'borrowed' ? 'bg-red-100 text-red-800' : loan.status === 'rejected' ? 'bg-gray-200 text-gray-700' : 'bg-emerald-100 text-emerald-800'}`}>{loanLabel(loan.status)}</span></td>
            <td data-label="ส่งคำขอ" className="p-3">{date(loan.requestedAt)}</td>
            <td data-label="ยืมสำเร็จ" className="p-3">{date(loan.borrowedAt)}</td>
            <td data-label="คืน" className="p-3">{date(loan.returnedAt)}</td>
            <td data-label="การดำเนินการ" className="p-3">{loan.status === 'pending_approval' ? <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void reviewLoan(loan, 'approve')} className="rounded bg-emerald-700 px-2 py-1 text-white">อนุมัติ</button><button type="button" disabled={busy} onClick={() => void reviewLoan(loan, 'reject')} className="rounded bg-gray-700 px-2 py-1 text-white">ปฏิเสธ</button></div> : <span>{operation}</span>}</td>
          </tr>;
        })}</tbody></table></div>}
        </div>}
      </section>
    </div>
    {selectedSelfie && <div role="dialog" aria-modal="true" aria-label="รูป selfie ตอนยืม" onClick={() => { URL.revokeObjectURL(selectedSelfie.url); setSelectedSelfie(null); }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div onClick={e => e.stopPropagation()} className="max-h-[90vh] max-w-3xl rounded-2xl bg-white p-4 shadow-xl"><div className="mb-3 flex items-center justify-between gap-4"><div><h2 className="font-bold">รูปตอนยืม {selectedSelfie.loan.deviceId}</h2><p className="text-sm text-slate-500">{selectedSelfie.loan.borrowerName} · {date(selectedSelfie.loan.requestedAt)}</p></div><button type="button" onClick={() => { URL.revokeObjectURL(selectedSelfie.url); setSelectedSelfie(null); }} aria-label="ปิดรูป" className="rounded-lg border px-3 py-2">ปิด</button></div><img src={selectedSelfie.url} alt={`รูป selfie ตอนยืม ${selectedSelfie.loan.deviceId}`} className="max-h-[75vh] max-w-full rounded-xl object-contain" /></div></div>}
  </main>;
}
