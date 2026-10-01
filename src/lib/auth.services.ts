import { createUserWithEmailAndPassword, deleteUser as deleteAuthUser, getAuth, signInWithEmailAndPassword, signOut, type Auth, type User } from "firebase/auth";
import { deleteApp, initializeApp } from "firebase/app";
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { auth, authReady, db, firebaseConfig } from "./firebase";
import type { IAuthResult, ICreateUserPayload, ISession, IUpdateUserPayload, IUser, IUserListItem } from "../interfaces/user.interface";

function sessionFrom(id: string, d: Record<string, unknown>): ISession {
  return { id, name: String(d.name ?? ""), nickname: String(d.nickname ?? ""), phone: String(d.phone ?? ""), role: d.role === "admin" ? "admin" : "user", status: d.status === "suspend" ? "suspend" : "active" };
}
function imageString(value: string) {
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value) || value.length > 700_000) throw new Error("รูปไม่ถูกต้องหรือมีขนาดเกินกำหนด");
  return value;
}
async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function normalized(payload: ICreateUserPayload | IUpdateUserPayload) {
  return { name: payload.name.trim(), nickname: payload.nickname.trim(), studentId: payload.studentId.trim().toUpperCase(), studentEmail: payload.studentEmail.trim().toLowerCase(), phone: payload.phone.trim(), role: payload.role, status: payload.status };
}
async function claimRefs(p: ReturnType<typeof normalized>) {
  const [student, email] = await Promise.all([hash(p.studentId), hash(p.studentEmail)]);
  return { student: doc(db, "registrationStudentIds", student), email: doc(db, "registrationStudentEmails", email), phone: doc(db, "registrationPhones", p.phone) };
}
async function saveNewProfile(uid: string, payload: ICreateUserPayload, adminCreate: boolean) {
  const p = normalized(payload); const claims = await claimRefs(p);
  const identity = imageString(payload.identityImage);
  await runTransaction(db, async tx => {
    const [student, email, phone] = await Promise.all([tx.get(claims.student), tx.get(claims.email), tx.get(claims.phone)]);
    if (student.exists() || email.exists() || phone.exists()) throw new Error("เบอร์โทรศัพท์ รหัสนักศึกษา หรืออีเมลนี้มีบัญชีแล้ว");
    tx.set(doc(db, "users", uid), { ...p, role: adminCreate ? payload.role : "user", status: adminCreate ? payload.status : "active", createdAt: serverTimestamp() });
    tx.set(claims.student, { userId: uid }); tx.set(claims.email, { userId: uid }); tx.set(claims.phone, { userId: uid });
    tx.set(doc(db, "registrationDocuments", uid), { image: identity, ownerId: uid, createdAt: serverTimestamp() });
  });
}
export async function restoreSession(): Promise<ISession | null> {
  await authReady;
  if (!auth.currentUser || auth.currentUser.isAnonymous) return null;
  const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
  if (!snap.exists() || snap.data().status !== "active") { await signOut(auth); return null; }
  return sessionFrom(snap.id, snap.data());
}
export async function loginWithPassword(email: string, password: string): Promise<ISession> {
  await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  const snap = await getDoc(doc(db, "users", auth.currentUser!.uid));
  if (!snap.exists() || snap.data().status !== "active") { await signOut(auth); throw new Error("บัญชีไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล"); }
  return sessionFrom(snap.id, snap.data());
}
export async function logoutUser() { await signOut(auth); }
export async function registerUser(payload: ICreateUserPayload, password: string) {
  const credential = await createUserWithEmailAndPassword(auth, payload.studentEmail.trim().toLowerCase(), password);
  try { await saveNewProfile(credential.user.uid, payload, false); await signOut(auth); }
  catch (error) { await deleteAuthUser(credential.user).catch(() => undefined); throw error; }
}
export async function fetchUsers(): Promise<IUser[]> {
  await authReady; const snap = await getDocs(query(collection(db, "users"), where("status", "==", "active")));
  return snap.docs.map(d => ({ id: d.id, name: String(d.data().name ?? ""), nickname: String(d.data().nickname ?? ""), phone: String(d.data().phone ?? ""), studentId: String(d.data().studentId ?? ""), studentEmail: String(d.data().studentEmail ?? ""), role: d.data().role === "admin" ? "admin" : "user", status: "active" as const }));
}
export async function fetchUserList(): Promise<IUserListItem[]> {
  await authReady; const snap = await getDocs(collection(db, "users"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as IUserListItem));
}
export async function fetchIdentityImage(id: string): Promise<string> {
  const snap = await getDoc(doc(db, "registrationDocuments", id));
  if (!snap.exists()) throw new Error("ไม่พบสำเนาบัตรประชาชนของบัญชีนี้");
  return String(snap.data().image ?? "");
}
export async function fetchAndVerifyPin(email: string, password: string): Promise<IAuthResult> {
  try { return { success: true, session: await loginWithPassword(email, password) }; }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "เข้าสู่ระบบไม่สำเร็จ" }; }
}
export async function createUser(payload: ICreateUserPayload): Promise<IAuthResult> {
  let secondary: Auth | undefined; let created: User | undefined;
  try {
    await authReady;
    const app = initializeApp(firebaseConfig, `admin-create-${crypto.randomUUID()}`);
    secondary = getAuth(app);
    const credential = await createUserWithEmailAndPassword(secondary, payload.studentEmail.trim().toLowerCase(), payload.password);
    created = credential.user;
    await saveNewProfile(credential.user.uid, payload, true);
    await signOut(secondary); return { success: true };
  } catch (e) { if (created) await deleteAuthUser(created).catch(() => undefined); return { success: false, error: e instanceof Error ? e.message : "สร้างบัญชีไม่สำเร็จ" }; }
  finally { if (secondary) { await signOut(secondary).catch(() => undefined); await deleteApp(secondary.app).catch(() => undefined); } }
}
export async function updateUser(id: string, payload: IUpdateUserPayload): Promise<IAuthResult> {
  try {
    const p = normalized(payload); const ref = doc(db, "users", id); const oldSnap = await getDoc(ref);
    if (!oldSnap.exists()) throw new Error("ไม่พบบัญชีผู้ใช้");
    const old = oldSnap.data(); const oldClaims = await claimRefs({ ...p, studentId: String(old.studentId ?? p.studentId), studentEmail: String(old.studentEmail ?? p.studentEmail) });
    const nextClaims = await claimRefs(p); const newImage = payload.identityImage ? imageString(payload.identityImage) : null;
    await runTransaction(db, async tx => {
      const [user, student, email, phone, oldStudent, oldEmail, oldPhone] = await Promise.all([tx.get(ref), tx.get(nextClaims.student), tx.get(nextClaims.email), tx.get(nextClaims.phone), tx.get(oldClaims.student), tx.get(oldClaims.email), tx.get(oldClaims.phone)]);
      for (const s of [student, email, phone]) if (s.exists() && s.data().userId !== id) throw new Error("ข้อมูลนี้ถูกใช้กับบัญชีอื่นแล้ว");
      if (!user.exists()) throw new Error("ไม่พบบัญชีผู้ใช้");
      for (const [previous, next] of [[oldStudent, nextClaims.student], [oldEmail, nextClaims.email], [oldPhone, nextClaims.phone]] as const) if (previous.ref.path !== next.path && previous.exists() && previous.data().userId === id) tx.delete(previous.ref);
      for (const next of [nextClaims.student, nextClaims.email, nextClaims.phone]) { const existing = next.path === oldClaims.student.path ? oldStudent : next.path === oldClaims.email.path ? oldEmail : next.path === oldClaims.phone.path ? oldPhone : null; if (!existing?.exists()) tx.set(next, { userId: id }); }
      tx.update(ref, { ...p, updatedAt: serverTimestamp() });
      if (newImage) tx.set(doc(db, "registrationDocuments", id), { image: newImage, ownerId: id, updatedAt: serverTimestamp() });
    });
    return { success: true };
  } catch (e) { return { success: false, error: e instanceof Error ? e.message : "บันทึกไม่สำเร็จ" }; }
}
export async function deleteUser(id: string): Promise<IAuthResult> {
  try { await updateDoc(doc(db, "users", id), { status: "suspend", updatedAt: serverTimestamp() }); return { success: true }; }
  catch (e) { return { success: false, error: e instanceof Error ? e.message : "ปิดบัญชีไม่สำเร็จ" }; }
}
