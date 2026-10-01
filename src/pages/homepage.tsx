import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/use-auth';
import { compressPhoto } from '../lib/cloudinary';
import { asDataUrl, loanRequest } from '../lib/loans.services';
import type { Loan } from '../lib/loans.services';

function QRScanner({ onScan, onError }: { onScan: (code: string) => void; onError: (message: string) => void }) {
  const id = useId().replaceAll(':', '');
  const callbacks = useRef({ onScan, onError });
  useEffect(() => { callbacks.current = { onScan, onError }; }, [onScan, onError]);
  useEffect(() => {
    let disposed = false;
    let detected = false;
    const reader = new Html5Qrcode(id);
    const started = reader.start({ facingMode: 'environment' }, { fps: 8, qrbox: 220 }, text => {
      if (!disposed && !detected) { detected = true; callbacks.current.onScan(text); }
    }, () => {}).catch(() => {
      if (!disposed) callbacks.current.onError('เปิดกล้องไม่สำเร็จ กรุณาอนุญาตกล้องและใช้ HTTPS หรือ localhost');
    });
    return () => {
      disposed = true;
      void started.then(async () => { if (reader.isScanning) await reader.stop(); reader.clear(); }).catch(() => undefined);
    };
  }, [id]);
  return <div id={id} className="w-full overflow-hidden rounded-xl" />;
}

export default function Homepage() {
  const { session } = useAuth();
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    loanRequest<{ loans: Loan[] }>('/loans').then(r => { if (active) setLoans(r.loans); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [refresh]);
  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  if (session?.role === 'admin') return <Navigate to="/admin" replace />;
  async function choose(file?: File) {
    setPhoto(null); setPreview(''); setError(''); setMessage('');
    if (!file) return;
    lock.current = true; setBusy(true);
    try { setPhoto(await compressPhoto(file)); } catch (e) { setError((e as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  function acceptScan(value: string) {
    const scanned = value.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(scanned)) {
      setError('QR นี้ไม่ใช่รหัส VR กรุณาสแกน QR บนอุปกรณ์');
      return;
    }
    setCode(scanned); setError(''); setMessage(`สแกนรหัส ${scanned} แล้ว ตรวจสอบรหัสและแนบ selfie เพื่อยืม`);
  }
  async function borrow(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    if (!code) return setError('กรุณาสแกน QR ของ VR ก่อน');
    if (!photo) return setError('กรุณาแนบรูป selfie คู่กับ VR');
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      await loanRequest('/loans/borrow', { deviceId: code, selfie: await asDataUrl(photo) });
      setMessage(`ยืม ${code} สำเร็จ เมื่อนำมาคืนให้แอดมินสแกนรับคืน`);
      setCode(''); setPhoto(null); setPreview(''); setScanning(false); if (input.current) input.current.value = ''; setRefresh(v => v + 1);
    } catch (err) { setError((err as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  return <main className="w-full h-full overflow-y-auto p-5 space-y-6">
    <h1 className="text-2xl font-bold">ยืม VR</h1>
    <form onSubmit={borrow} className="space-y-4">
      <fieldset disabled={busy} className="space-y-4">
        <section className="space-y-2">
          <p className="font-medium">สแกน QR บนอุปกรณ์ VR <span className="text-red-600">*</span></p>
          {scanning ? <>
            <QRScanner onScan={value => { setScanning(false); acceptScan(value); }} onError={msg => { setError(msg); setScanning(false); }} />
            <button type="button" onClick={() => setScanning(false)} className="w-full border rounded-xl p-3">ปิดกล้อง</button>
          </> : <button type="button" onClick={() => { setError(''); setMessage(''); setScanning(true); }} className="w-full bg-black text-white rounded-xl p-3">{code ? 'สแกน QR ใหม่' : 'เปิดกล้องสแกน QR'}</button>}
          {code && <p role="status" className="rounded-lg bg-green-50 p-3">รหัส VR ที่สแกนได้: <b>{code}</b></p>}
        </section>
        <label className="block">รูป selfie คู่กับ VR <span className="text-red-600">*</span><input ref={input} required type="file" accept="image/jpeg,image/png,image/webp" onChange={e => void choose(e.target.files?.[0])} className="block w-full mt-2" /></label>
        <p className="text-sm text-gray-500">ให้เห็นใบหน้าผู้ยืมและอุปกรณ์ VR ในภาพเดียวกัน เลือกรูปหรือถ่ายภาพจากโทรศัพท์ได้</p>
        {preview && <img src={preview} alt="ตัวอย่าง selfie คู่กับ VR" className="rounded-xl max-h-64 w-full object-contain" />}
        <button disabled={!photo || !code} className="w-full bg-black text-white p-3 rounded-xl disabled:opacity-40">{busy ? 'กำลังดำเนินการ...' : 'ยืนยันยืม VR'}</button>
      </fieldset>
    </form>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {message && <p role="status" className="text-green-700">{message}</p>}
    <section className="space-y-3"><h2 className="font-bold text-xl">รายการยืมของฉัน</h2>
      {!loans.length && <p className="text-gray-500">ยังไม่มีรายการยืม</p>}
      {loans.map(l => <article key={l.id} className="border rounded-xl p-3"><b>{l.deviceId}</b><p>{l.status === 'borrowed' ? 'กำลังยืม · รอแอดมินรับคืน' : 'คืนแล้ว'}</p><p className="text-xs text-gray-500">ยืม {l.borrowedAt ? new Date(l.borrowedAt).toLocaleString('th-TH') : '-'}</p>{l.returnedAt && <p className="text-xs text-gray-500">คืน {new Date(l.returnedAt).toLocaleString('th-TH')}</p>}</article>)}
    </section>
  </main>;
}
