import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { loanRequest } from '../lib/loans.services';
import type { Loan } from '../lib/loans.services';
function Camera({ onScan, onError }: { onScan: (code: string) => void; onError: (message: string) => void }) {
  const id = useId().replaceAll(':', '');
  const callbacks = useRef({ onScan, onError });
  useEffect(() => { callbacks.current = { onScan, onError }; }, [onScan, onError]);
  useEffect(() => {
    let disposed = false; let detected = false;
    const reader = new Html5Qrcode(id);
    const started = reader.start({ facingMode: 'environment' }, { fps: 8, qrbox: 220 }, text => {
      if (!disposed && !detected) { detected = true; callbacks.current.onScan(text); }
    }, () => {}).catch(() => { if (!disposed) callbacks.current.onError('เปิดกล้องไม่สำเร็จ กรุณาอนุญาตกล้องและเปิดเว็บผ่าน HTTPS หรือ localhost'); });
    return () => {
      disposed = true;
      void started.then(async () => { if (reader.isScanning) await reader.stop(); reader.clear(); }).catch(() => undefined);
    };
  }, [id]);
  return <div id={id} className="w-full rounded-xl overflow-hidden" />;
}
export default function ReturnPage() {
  const [scanning, setScanning] = useState(false);
  const [loan, setLoan] = useState<Loan | null>(null);
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  async function scanned(code: string) {
    if (lock.current) return;
    setScanning(false); lock.current = true; setBusy(true); setError(''); setMessage(''); setLoan(null);
    try { const result = await loanRequest<{ loan: Loan }>(`/devices/${encodeURIComponent(code.trim().toUpperCase())}/return`); setLoan(result.loan); }
    catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  async function confirm() {
    if (!loan || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await loanRequest('/loans/return', { deviceId: loan.deviceId, loanId: loan.id }); setMessage(`รับคืน ${loan.deviceId} สำเร็จ`); setLoan(null); }
    catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main className="w-full h-full overflow-y-auto p-5 space-y-5 max-w-md mx-auto">
    <h1 className="text-2xl font-bold">สแกนรับคืน VR</h1><p className="text-gray-500">สแกน QR บนอุปกรณ์ แล้วตรวจรายการก่อนยืนยันรับคืน</p>
    {scanning ? <><Camera onScan={code => void scanned(code)} onError={msg => { setError(msg); setScanning(false); }} /><button onClick={() => setScanning(false)} className="border rounded-xl p-3 w-full">หยุดกล้อง</button></> : <button disabled={busy} onClick={() => { setLoan(null); setError(''); setMessage(''); setScanning(true); }} className="bg-black text-white p-4 rounded-xl w-full disabled:opacity-40">เปิดกล้องสแกน QR</button>}
    {busy && <p role="status">กำลังดำเนินการ...</p>}
    {error && <p role="alert" className="text-red-600">{error}</p>}{message && <p role="status" className="text-green-700">{message}</p>}
    {loan && <section className="border rounded-xl p-4 space-y-3"><h2 className="text-xl font-bold">{loan.deviceId}</h2><p>ผู้ยืม: {loan.borrowerName}</p><p>ยืมเมื่อ: {loan.borrowedAt ? new Date(loan.borrowedAt).toLocaleString('th-TH') : '-'}</p><button disabled={busy} onClick={() => void confirm()} className="bg-green-700 text-white p-3 rounded-xl w-full disabled:opacity-40">ยืนยันว่าได้รับ VR คืนแล้ว</button></section>}
  </main>;
}
