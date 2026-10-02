import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { loanImage, loanRequest } from '../lib/loans.services';
import type { ActiveUser, Device, DeviceStatus, Loan, LoanStatus } from '../lib/loans.services';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { normalizedDevice, toLoan } from '../lib/loans.services';
import { IoIosArrowDown, IoIosArrowUp } from 'react-icons/io';

type Filter = 'all' | 'pending_approval' | 'borrowed' | 'good' | 'damaged';
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
  const [numberChoice, setNumberChoice] = useState<Record<string, string>>({});
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
    }, onError('รายการ VR', () => setLoading(false)));
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
    if (busy) return;
    setBusy(true); setError('');
    try {
      await loanRequest('/devices', { deviceId: code.trim().toUpperCase(), deviceNumber: newDeviceNumber });
      setCode(''); setNewDeviceNumber(''); setRefresh(value => value + 1);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
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

  async function deleteDevice(device: Device) {
    if (busy) return;
    const result = await Swal.fire({
      icon: 'warning',
      title: 'ลบ VR?',
      text: `ต้องการลบ VR "${device.id}"${device.deviceNumber ? ` เบอร์ ${device.deviceNumber}` : ''} ใช่หรือไม่? ประวัติการยืมเดิมจะยังคงอยู่`,
      showCancelButton: true,
      confirmButtonText: 'ลบ VR',
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
      await Swal.fire({ icon: 'success', title: 'ลบ VR แล้ว', confirmButtonText: 'ตกลง' });
    } catch (e) {
      setError((e as Error).message);
      await Swal.fire({ icon: 'error', title: 'ลบ VR ไม่สำเร็จ', text: (e as Error).message, confirmButtonText: 'ตกลง' });
    } finally { setBusy(false); }
  }

  const pendingCount = devices.filter(item => deviceStatus(item) === 'pending_approval').length;
  const borrowedCount = devices.filter(item => deviceStatus(item) === 'borrowed').length;
  const goodCount = devices.filter(item => deviceStatus(item) === 'good').length;
  const damagedCount = devices.filter(item => ['damaged', 'minor_damage', 'major_damage'].includes(item.status)).length;

  const visibleDevices = useMemo(() => {
    const term = search.trim().toLowerCase();
    return devices.filter(device => {
      const status = deviceStatus(device);
      const matchText = !term || device.id.toLowerCase().includes(term)
        || (device.deviceNumber ?? '').toLowerCase().includes(term)
        || (device.adminBorrowerName ?? '').toLowerCase().includes(term)
        || loans.some(loan => loan.deviceId === device.id && loan.borrowerName.toLowerCase().includes(term));
      const matchFilter = filter === 'all' || status === filter;
      return matchText && matchFilter;
    }).sort((a, b) => {
      const left = a.deviceNumber?.trim() ?? '';
      const right = b.deviceNumber?.trim() ?? '';
      if (!left || !right) return left ? -1 : right ? 1 : a.id.localeCompare(b.id, 'th', { numeric: true });
      return left.localeCompare(right, 'th', { numeric: true, sensitivity: 'base' })
        || a.id.localeCompare(b.id, 'th', { numeric: true });
    });
  }, [devices, loans, search, filter]);

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
    { label: 'รออนุมัติ', value: pendingCount, filter: 'pending_approval', color: 'bg-yellow-100' },
    { label: 'ถูกยืม', value: borrowedCount, filter: 'borrowed', color: 'bg-red-100' },
    { label: 'พร้อมใช้', value: goodCount, filter: 'good', color: 'bg-emerald-100' },
    { label: 'ชำรุด', value: damagedCount, filter: 'damaged', color: 'bg-gray-200' },
    { label: 'อุปกรณ์ทั้งหมด', value: devices.length, filter: 'all', color: 'bg-slate-100' },
  ];

  return <main className="dashboard">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="page-heading !mb-0"><h1>ภาพรวมอุปกรณ์ VR</h1><p>ติดตามสถานะ ดูแลอุปกรณ์ และอนุมัติคำขอยืม</p></div>
        <Link to="/admin/return" className="rounded-xl bg-blue-900 px-5 py-3 font-bold text-white">สแกนรับคืน VR</Link>
      </header>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
      {Object.entries(loadErrors).map(([section, message]) => <p key={section} role="alert" className="rounded-xl bg-amber-50 p-3 text-amber-900">โหลด{section}ไม่สำเร็จ: {message} — กดรีเฟรชข้อมูลเพื่อลองอีกครั้ง</p>)}

      <section aria-label="สรุปสถานะอุปกรณ์" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map(tile => <button key={tile.filter} onClick={() => setFilter(tile.filter)} className={`${tile.color} rounded-2xl p-4 text-left ring-offset-2 transition hover:ring-2 hover:ring-slate-400 ${filter === tile.filter ? 'ring-2 ring-slate-500' : ''}`}>
          <span className="block text-sm text-slate-600">{tile.label}</span><span className="mt-1 block text-3xl font-bold">{tile.value}</span>
        </button>)}
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
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">VR {device?.deviceNumber || loan.deviceId}</h3><p className="text-xs text-slate-500">รหัสเครื่อง {loan.deviceId}</p></div><span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-900">รออนุมัติ</span></div>
              <p className="mt-3 text-sm">ผู้ขอยืม <b>{loan.borrowerName}</b></p>
              <p className="text-xs text-slate-500">ส่งคำขอ {date(loan.requestedAt)}</p>
              <div className="mt-4 flex gap-2"><button type="button" disabled={busy} onClick={() => void viewSelfie(loan)} className="flex-1 rounded-lg border px-3 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50">{selfieLoadingId === loan.id ? 'กำลังโหลดรูป…' : 'ดูรูปแนบ'}</button><button type="button" disabled={busy} onClick={() => void reviewLoan(loan, 'reject')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">ปฏิเสธ</button><button type="button" disabled={busy} onClick={() => void reviewLoan(loan, 'approve')} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">อนุมัติ</button></div>
            </article>;
          })}
        </div>}
      </section>

      <section className="rounded-2xl border bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">รายการอุปกรณ์</h2><p className="text-sm text-slate-500">คำขอยืมจะยังไม่ถือว่ายืมจนกว่าแอดมินอนุมัติ</p></div>
          <div className="flex gap-2">
            <button type="button" aria-expanded={devicesExpanded} aria-controls="device-list-content" onClick={() => setDevicesExpanded(value => !value)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold">{devicesExpanded ? <><IoIosArrowUp aria-hidden="true" />ซ่อนรายการ</> : <><IoIosArrowDown aria-hidden="true" />แสดงรายการ</>}</button>
            <button onClick={() => setRefresh(value => value + 1)} disabled={busy} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{loading ? 'กำลังโหลด · ลองใหม่' : 'รีเฟรชข้อมูล'}</button>
          </div>
        </div>
        {devicesExpanded && <div id="device-list-content">
        <form onSubmit={add} className="mb-5 flex flex-wrap gap-2 rounded-xl bg-slate-50 p-3">
          <input aria-label="รหัส VR ใหม่" required maxLength={64} placeholder="เพิ่มรหัส VR เช่น VR-001" value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="min-w-0 flex-1 basis-48 rounded-xl border p-3" />
          <input aria-label="เบอร์เครื่อง VR ใหม่ (ไม่จำเป็น)" maxLength={64} placeholder="เบอร์เครื่อง (ไม่จำเป็น)" value={newDeviceNumber} onChange={e => setNewDeviceNumber(e.target.value)} className="min-w-0 flex-1 basis-48 rounded-xl border p-3" />
          <button disabled={busy} className="rounded-xl bg-black px-4 py-3 font-bold text-white disabled:opacity-40">{busy ? 'กำลังบันทึก…' : 'เพิ่ม VR'}</button>
        </form>
        <label className="mb-4 block text-sm font-medium">ค้นหารหัสอุปกรณ์ เบอร์เครื่อง หรือชื่อผู้ยืม<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="พิมพ์เพื่อค้นหา" className="mt-1 block w-full rounded-xl border p-3" /></label>
        {loading && devices.length > 0 && <p role="status" className="mb-3 text-sm text-slate-500">กำลังอัปเดตรายการ…</p>}
        {loading && devices.length === 0 ? <p role="status" className="py-8 text-center text-slate-500">กำลังโหลดรายการ VR…</p> : visibleDevices.length === 0 ? <p className="py-8 text-center text-slate-500">{loadErrors['รายการ VR'] ? 'ยังโหลดรายการ VR ไม่สำเร็จ กรุณาลองใหม่' : 'ไม่พบอุปกรณ์'}</p> : <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                  <h3 className="break-words text-2xl font-bold">{device.deviceNumber || 'ยังไม่ระบุเบอร์'}</h3>
                  <p className="mt-1 break-all font-mono text-xs text-slate-500">{device.id}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold">{deviceLabel(status)}</span>
                  <button type="button" aria-label={`ตั้งค่า VR ${device.deviceNumber || device.id}`} aria-expanded={settingsOpen} aria-controls={`device-settings-${device.id}`} onClick={() => setOpenDeviceId(settingsOpen ? null : device.id)} className="flex h-9 w-9 items-center justify-center rounded-lg text-xl font-bold hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-slate-700">⋮</button>
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
              <label className="mt-3 block text-xs font-semibold text-slate-700">เบอร์เครื่อง (ไม่จำเป็น)
                <input maxLength={64} value={numberChoice[device.id] ?? ''} disabled={busy} onChange={e => setNumberChoice(current => ({ ...current, [device.id]: e.target.value }))} placeholder="ยังไม่ระบุเบอร์เครื่อง" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm disabled:opacity-50" />
              </label>
              {(numberChoice[device.id] ?? '').trim() !== (device.deviceNumber ?? '') && <button type="button" disabled={busy} onClick={() => void saveDeviceNumber(device)} className="mt-2 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">บันทึกเบอร์เครื่อง</button>}
              {pendingLoan && <p className="mt-3 text-sm">คำขอจาก <b>{pendingLoan.borrowerName}</b><br /><span className="text-slate-600">ส่งเมื่อ {date(pendingLoan.requestedAt)}</span></p>}
              {pendingLoan && <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => void viewSelfie(pendingLoan)} className="flex-1 rounded-lg border bg-white px-3 py-2 text-sm">{selfieLoadingId === pendingLoan.id ? 'กำลังโหลดรูป…' : 'ดูรูปแนบ'}</button><button type="button" disabled={busy} onClick={() => void reviewLoan(pendingLoan, 'approve')} className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">อนุมัติ</button><button type="button" disabled={busy} onClick={() => void reviewLoan(pendingLoan, 'reject')} className="rounded-lg bg-gray-700 px-3 py-2 text-sm font-semibold text-white">ไม่อนุมัติ</button></div>}
              <div className="mt-4 border-t border-black/10 pt-3">
                <label className="block text-xs font-semibold text-slate-700">กำหนดสถานะโดยแอดมิน
                  <select aria-label={`สถานะ VR ${device.id}`} value={statusChoice[device.id] ?? status} disabled={disabled} onChange={e => setStatusChoice(current => ({ ...current, [device.id]: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm disabled:bg-slate-100">
                    <option value="good">พร้อมใช้</option><option value="damaged">ชำรุด</option><option value="borrowed">ยืม (กำหนดโดยแอดมิน)</option>
                  </select>
                </label>
                {(statusChoice[device.id] ?? status) === 'borrowed' && <label className="mt-2 block text-xs font-semibold text-slate-700">ผู้ถือ VR (ไม่จำเป็น)
                  <select value={borrowerChoice[device.id] ?? ''} disabled={disabled || usersLoading || Boolean(loadErrors['รายชื่อผู้ใช้'])} onChange={e => setBorrowerChoice(current => ({ ...current, [device.id]: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm"><option value="">{usersLoading ? 'กำลังโหลดรายชื่อ…' : 'ไม่ระบุผู้ยืม'}</option>{device.adminBorrowerId && !users.some(item => item.id === device.adminBorrowerId) && <option value={device.adminBorrowerId}>{device.adminBorrowerName || device.adminBorrowerId}</option>}{users.filter(item => item.role === 'user').map(item => <option key={item.id} value={item.id}>{item.nickname || item.name || item.id}</option>)}</select>
                </label>}
                {hasStatusChanges && <button type="button" disabled={disabled} onClick={() => void saveDeviceStatus(device)} className="mt-2 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">บันทึกสถานะ</button>}
              </div>
              <button type="button" disabled={disabled} onClick={() => void deleteDevice(device)} className="mt-3 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-40">ลบ VR</button>
              {(device.activeLoanId || device.pendingLoanId) && <p className="mt-1 text-xs text-slate-500">ต้องรับคืนหรือปฏิเสธคำขอที่ค้างอยู่ก่อนลบ</p>}
              </div>}
            </article>;
          })}
        </div>}
        <p className="mt-3 text-right text-sm text-slate-500">แสดง {visibleDevices.length} จาก {devices.length} เครื่อง</p>
        </div>}
      </section>

      <section id="loan-history" className="rounded-2xl border bg-white p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold">คำขอยืมและประวัติ</h2><p className="text-sm text-slate-500">ตรวจรูปและอนุมัติคำขอก่อนให้ผู้ใช้ยืม VR</p></div>
          <button type="button" aria-expanded={historyExpanded} aria-controls="loan-history-content" onClick={() => setHistoryExpanded(value => !value)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold">{historyExpanded ? <><IoIosArrowUp aria-hidden="true" />ซ่อนประวัติ</> : <><IoIosArrowDown aria-hidden="true" />แสดงประวัติ</>}</button>
        </div>
        {historyExpanded && <div id="loan-history-content">
        {historyRows.length === 0 ? <p className="py-5 text-center text-slate-500">{loansLoading ? 'กำลังโหลดประวัติยืม…' : loadErrors['ประวัติยืม'] || loadErrors['ประวัติเปลี่ยนสถานะ'] ? 'ยังโหลดประวัติไม่สำเร็จ' : 'ยังไม่มีรายการ'}</p> : <div className="overflow-x-auto"><table className="loan-history-table w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">รหัส VR</th><th className="p-3">เบอร์เครื่อง</th><th className="p-3">ผู้ใช้</th><th className="p-3">รูป selfie</th><th className="p-3">สถานะ</th><th className="p-3">ส่งคำขอ</th><th className="p-3">ยืมสำเร็จ</th><th className="p-3">คืน</th><th className="p-3">การดำเนินการ</th></tr></thead><tbody>{historyRows.map(row => {
          if (row.kind === 'status') {
          const { item } = row;
          const device = devices.find(entry => entry.id === item.gasId);
          const statusLabel = (status: string) => ({ good: 'พร้อมใช้', damaged: 'ชำรุด', minor_damage: 'ชำรุด', major_damage: 'ชำรุด', borrowed: 'ยืม' }[status] ?? status);
          const actor = users.find(user => user.id === item.performedBy);
          return <tr key={`status-${item.id}`} className="border-b last:border-0 bg-indigo-50/40">
            <td data-label="รหัส VR" className="p-3 font-mono font-bold">{item.gasId}</td>
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
            <td data-label="รหัส VR" className="p-3 font-mono font-bold">{loan.deviceId}</td>
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
