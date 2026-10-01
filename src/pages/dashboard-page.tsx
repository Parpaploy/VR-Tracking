import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loanImage, loanRequest } from '../lib/loans.services';
import type { Loan } from '../lib/loans.services';

type DeviceStatus = 'good' | 'minor_damage' | 'major_damage' | 'borrowed';
type Device = { id: string; status: DeviceStatus; available: boolean; activeLoanId: string | null };
type Filter = 'all' | 'borrowed' | 'available' | 'unavailable';
const date = (value: string | null) => value ? new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function DashboardPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [code, setCode] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selectedSelfie, setSelectedSelfie] = useState<{ url: string; loan: Loan } | null>(null);
  const [selfieLoadingId, setSelfieLoadingId] = useState<string | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      loanRequest<{ loans: Loan[] }>('/loans'),
      loanRequest<{ devices: Device[] }>('/devices'),
    ]).then(([loanData, deviceData]) => {
      if (!active) return;
      setLoans(loanData.loans);
      setDevices(deviceData.devices);
      setError('');
    }).catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      await loanRequest('/devices', { deviceId: code.trim().toUpperCase() });
      setCode(''); setRefresh(v => v + 1);
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

  async function changeDeviceStatus(device: Device, status: Exclude<DeviceStatus, 'borrowed'>) {
    if (device.activeLoanId || statusBusyId) return;
    setStatusBusyId(device.id); setError('');
    try {
      await loanRequest(`/devices/${encodeURIComponent(device.id)}/status`, { status });
      setRefresh(v => v + 1);
    } catch (e) { setError((e as Error).message); }
    finally { setStatusBusyId(null); }
  }

  const activeById = useMemo(() => new Map(loans.filter(l => l.status === 'borrowed').map(l => [l.id, l])), [loans]);
  const latestByDevice = useMemo(() => {
    const latest = new Map<string, Loan>();
    for (const loan of loans) {
      const current = latest.get(loan.deviceId);
      if (!current || (loan.borrowedAt ?? '') > (current.borrowedAt ?? '')) latest.set(loan.deviceId, loan);
    }
    return latest;
  }, [loans]);
  const counts = useMemo(() => ({
    total: devices.length,
    borrowed: devices.filter(d => Boolean(d.activeLoanId)).length,
    available: devices.filter(d => d.available && !d.activeLoanId).length,
    unavailable: devices.filter(d => !d.available && !d.activeLoanId).length,
  }), [devices]);
  const visibleDevices = useMemo(() => {
    const term = query.trim().toLowerCase();
    return devices.filter(d => {
      const latest = d.activeLoanId ? activeById.get(d.activeLoanId) : latestByDevice.get(d.id);
      const matchesText = !term || d.id.toLowerCase().includes(term) || latest?.borrowerName.toLowerCase().includes(term);
      const matchesFilter = filter === 'all'
        || (filter === 'borrowed' && Boolean(d.activeLoanId))
        || (filter === 'available' && d.available && !d.activeLoanId)
        || (filter === 'unavailable' && !d.available && !d.activeLoanId);
      return matchesText && matchesFilter;
    }).sort((a, b) => a.id.localeCompare(b.id));
  }, [devices, query, filter, activeById, latestByDevice]);
  const visibleLoans = useMemo(() => {
    const term = query.trim().toLowerCase();
    return loans.filter(l => !term || l.deviceId.toLowerCase().includes(term) || l.borrowerName.toLowerCase().includes(term));
  }, [loans, query]);

  const tiles: { label: string; value: number; filter: Filter; color: string }[] = [
    { label: 'อุปกรณ์ทั้งหมด', value: counts.total, filter: 'all', color: 'bg-slate-100' },
    { label: 'กำลังถูกยืม', value: counts.borrowed, filter: 'borrowed', color: 'bg-amber-100' },
    { label: 'พร้อมให้ยืม', value: counts.available, filter: 'available', color: 'bg-emerald-100' },
    { label: 'ไม่พร้อมให้ยืม', value: counts.unavailable, filter: 'unavailable', color: 'bg-rose-100' },
  ];
  return <main className="w-full h-full overflow-y-auto bg-slate-50 p-4 sm:p-6">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm text-slate-500">ผู้ดูแลระบบ</p><h1 className="text-2xl font-bold">แดชบอร์ดยืม–คืน VR</h1></div>
        <Link to="/admin/return" className="rounded-xl bg-blue-900 px-5 py-3 font-bold text-white">สแกนรับคืน VR</Link>
      </header>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}

      <section aria-label="สรุปสถานะอุปกรณ์" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(tile => <button key={tile.filter} onClick={() => setFilter(tile.filter)} className={`${tile.color} rounded-2xl p-4 text-left ring-offset-2 transition hover:ring-2 hover:ring-slate-400 ${filter === tile.filter ? 'ring-2 ring-slate-500' : ''}`}>
          <span className="block text-sm text-slate-600">{tile.label}</span><span className="mt-1 block text-3xl font-bold">{tile.value}</span>
        </button>)}
      </section>

      <section className="rounded-2xl border bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">รายการอุปกรณ์</h2><p className="text-sm text-slate-500">สถานะปัจจุบันและผู้ยืมล่าสุดของแต่ละเครื่อง</p></div>
          <button onClick={() => setRefresh(v => v + 1)} disabled={loading} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">รีเฟรชข้อมูล</button>
        </div>
        <form onSubmit={add} className="mb-4 flex gap-2"><input aria-label="รหัส VR ใหม่" required maxLength={64} placeholder="เพิ่มรหัส VR เช่น VR-001" value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="min-w-0 flex-1 rounded-xl border p-3" /><button disabled={busy} className="rounded-xl bg-black px-4 font-bold text-white disabled:opacity-40">{busy ? 'กำลังเพิ่ม…' : 'เพิ่ม VR'}</button></form>
        <label className="mb-4 block text-sm font-medium">ค้นหารหัสอุปกรณ์หรือชื่อผู้ยืม<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="พิมพ์เพื่อค้นหา" className="mt-1 block w-full rounded-xl border p-3" /></label>
        {loading ? <p className="py-8 text-center text-slate-500">กำลังโหลดข้อมูล…</p> : visibleDevices.length === 0 ? <p className="py-8 text-center text-slate-500">ไม่พบอุปกรณ์</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleDevices.map(device => {
            const current = device.activeLoanId ? activeById.get(device.activeLoanId) : undefined;
            const latest = current ?? latestByDevice.get(device.id);
            const status = current ? 'กำลังถูกยืม' : device.available ? 'พร้อมให้ยืม' : 'ไม่พร้อมให้ยืม';
            const style = current ? 'border-amber-200 bg-amber-50' : device.available ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50';
            return <article key={device.id} className={`rounded-xl border p-4 ${style}`}>
              <div className="flex items-start justify-between gap-2"><h3 className="text-lg font-bold">{device.id}</h3><span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold">{status}</span></div>
              {current ? <div className="mt-3 space-y-1 text-sm"><p><span className="text-slate-500">ผู้ยืม:</span> <b>{current.borrowerName}</b></p><p><span className="text-slate-500">ยืมเมื่อ:</span> {date(current.borrowedAt)}</p></div>
                : latest?.status === 'returned' ? <div className="mt-3 space-y-1 text-sm"><p><span className="text-slate-500">คืนล่าสุดโดย:</span> <b>{latest.borrowerName}</b></p><p><span className="text-slate-500">ยืมเมื่อ:</span> {date(latest.borrowedAt)}</p><p><span className="text-slate-500">รับคืนเมื่อ:</span> {date(latest.returnedAt)}</p></div>
                  : <p className="mt-3 text-sm text-slate-500">ยังไม่มีประวัติยืม</p>}
              <label className="mt-4 block text-xs font-semibold text-slate-600">สถานะ VR
                <select aria-label={`สถานะ VR ${device.id}`} value={device.status} disabled={Boolean(device.activeLoanId) || statusBusyId === device.id} onChange={e => void changeDeviceStatus(device, e.target.value as Exclude<DeviceStatus, 'borrowed'>)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm disabled:bg-slate-100 disabled:text-slate-500">
                  {device.status === 'borrowed' && <option value="borrowed" disabled>กำลังถูกยืม</option>}
                  <option value="good">ปกติ · พร้อมให้ยืม</option><option value="minor_damage">มีตำหนิ · งดให้ยืม</option><option value="major_damage">ชำรุด · งดให้ยืม</option>
                </select>
              </label>
            </article>;
          })}
        </div>}
        <p className="mt-3 text-right text-sm text-slate-500">แสดง {visibleDevices.length} จาก {devices.length} เครื่อง</p>
      </section>

      <section className="rounded-2xl border bg-white p-4 sm:p-5">
        <h2 className="text-lg font-bold">ประวัติการยืม–คืน</h2><p className="mb-4 text-sm text-slate-500">รายการล่าสุดก่อน แสดงทั้งรายการที่ยังยืมและคืนแล้ว</p>
        {visibleLoans.length === 0 ? <p className="py-5 text-center text-slate-500">ยังไม่มีประวัติ</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">รหัส VR</th><th className="p-3">ผู้ยืม</th><th className="p-3">รูปตอนยืม</th><th className="p-3">สถานะ</th><th className="p-3">วันเวลายืม</th><th className="p-3">วันเวลาคืน</th></tr></thead><tbody>{visibleLoans.map(loan => <tr key={loan.id} className="border-b last:border-0"><td className="p-3 font-bold">{loan.deviceId}</td><td className="p-3">{loan.borrowerName}</td><td className="p-3"><button type="button" onClick={() => void viewSelfie(loan)} disabled={selfieLoadingId === loan.id} className="rounded-lg border px-3 py-2 text-xs font-semibold text-blue-800 disabled:opacity-50">{selfieLoadingId === loan.id ? 'กำลังโหลด…' : 'ดูรูป'}</button></td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs ${loan.status === 'borrowed' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{loan.status === 'borrowed' ? 'กำลังยืม' : 'คืนแล้ว'}</span></td><td className="p-3">{date(loan.borrowedAt)}</td><td className="p-3">{date(loan.returnedAt)}</td></tr>)}</tbody></table></div>}
      </section>
      <div className="flex flex-wrap gap-3"><Link to="/admin/user-management" className="rounded-xl border bg-white px-4 py-3">จัดการผู้ใช้</Link></div>
    </div>
    {selectedSelfie && <div role="dialog" aria-modal="true" aria-label="รูป selfie ตอนยืม" onClick={() => { URL.revokeObjectURL(selectedSelfie.url); setSelectedSelfie(null); }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div onClick={e => e.stopPropagation()} className="max-h-[90vh] max-w-3xl rounded-2xl bg-white p-4 shadow-xl"><div className="mb-3 flex items-center justify-between gap-4"><div><h2 className="font-bold">รูปตอนยืม {selectedSelfie.loan.deviceId}</h2><p className="text-sm text-slate-500">{selectedSelfie.loan.borrowerName} · {date(selectedSelfie.loan.borrowedAt)}</p></div><button type="button" onClick={() => { URL.revokeObjectURL(selectedSelfie.url); setSelectedSelfie(null); }} aria-label="ปิดรูป" className="rounded-lg border px-3 py-2">ปิด</button></div><img src={selectedSelfie.url} alt={`รูป selfie ตอนยืม ${selectedSelfie.loan.deviceId}`} className="max-h-[75vh] max-w-full rounded-xl object-contain" /></div></div>}
  </main>;
}
