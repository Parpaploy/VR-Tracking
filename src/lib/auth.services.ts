import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  serverTimestamp,
  where,
  query,
} from "firebase/firestore";
import { db, auth, authReady } from "./firebase";
import type {
  IAuthResult,
  ICreateUserPayload,
  ISession,
  IUpdateUserPayload,
  IUser,
} from "../interfaces/user.interface";
import { onAuthStateChanged, signInAnonymously, signOut } from "firebase/auth";

async function ready() {
  await authReady;

  if (!auth.currentUser) {
    await signInAnonymously(auth);
  }

  await new Promise<void>((resolve) => {
    const unsub = onAuthStateChanged(auth, () => {
      unsub();
      resolve();
    });
  });
}

export async function fetchUsers(): Promise<IUser[]> {
  await ready();
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name ?? "",
      nickname: data.nickname ?? "",
      phone: data.phone ?? "",
      role: data.role ?? "user",
      status: data.status ?? "active",
      createdAt: data.createdAt,
    };
  });
}

export async function restoreSession(): Promise<ISession | null> {
  await ready();

  const uid = auth.currentUser?.uid;
  if (!uid) return null;

  const q = query(collection(db, "users"), where("anonymousUid", "==", uid));

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const userDoc = snap.docs[0];
  const data = userDoc.data();

  if (data.status === "suspend") return null;

  return {
    id: userDoc.id,
    name: data.name ?? "",
    nickname: data.nickname ?? data.name ?? "",
    phone: data.phone ?? "",
    role: data.role ?? "user",
    status: data.status ?? "active",
  };
}

export async function fetchAndVerifyPin(
  userId: string,
  inputPin: string,
): Promise<IAuthResult> {
  await ready();
  try {
    const userDoc = await getDoc(doc(db, "users", userId));

    if (!userDoc.exists()) return { success: false, error: "ไม่พบผู้ใช้งาน" };

    const data = userDoc.data();

    if (inputPin !== data.pin)
      return { success: false, error: "PIN ไม่ถูกต้อง" };

    if (data.status === "suspend") {
      return {
        success: false,
        error: "บัญชีถูกระงับการใช้งาน",
      };
    }
    const uid = auth.currentUser?.uid;
    if (uid) {
      await updateDoc(doc(db, "users", userId), { anonymousUid: uid });
    }

    const session: ISession = {
      id: userDoc.id,
      name: data.name ?? "",
      nickname: data.nickname ?? data.name ?? "",
      phone: data.phone ?? "",
      role: data.role ?? "user",
      status: data.status ?? "active",
    };

    return { success: true, session };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
    return { success: false, error: message };
  }
}

export async function logoutUser(userId: string): Promise<void> {
  await ready();

  try {
    await updateDoc(doc(db, "users", userId), { anonymousUid: null });
    await signOut(auth);
  } catch {
    //
  }
}

export async function createUser(
  payload: ICreateUserPayload,
): Promise<IAuthResult> {
  if (!payload.name.trim()) return { success: false, error: "กรุณาใส่ชื่อ" };
  if (!payload.nickname.trim())
    return { success: false, error: "กรุณาใส่ชื่อเล่น" };
  if (!/^0\d{9}$/.test(payload.phone))
    return { success: false, error: "เบอร์โทรต้องเป็น 10 หลัก เริ่มด้วย 0" };
  if (!/^\d{4}$/.test(payload.pin))
    return { success: false, error: "PIN ต้องเป็นตัวเลข 4 หลัก" };

  await ready();
  try {
    await addDoc(collection(db, "users"), {
      name: payload.name.trim(),
      nickname: payload.nickname.trim(),
      phone: payload.phone,
      pin: payload.pin,
      role: payload.role,
      status: payload.status ?? "active",
      anonymousUid: null,
      createdAt: serverTimestamp(),
    });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาด";
    return { success: false, error: message };
  }
}

export async function deleteUser(userId: string): Promise<IAuthResult> {
  await ready();
  try {
    await deleteDoc(doc(db, "users", userId));
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "ลบไม่สำเร็จ";
    return { success: false, error: message };
  }
}

export async function updateUser(
  userId: string,
  payload: IUpdateUserPayload,
): Promise<IAuthResult> {
  await ready();

  if (!payload.name.trim()) return { success: false, error: "กรุณาใส่ชื่อ" };

  if (!payload.nickname.trim())
    return { success: false, error: "กรุณาใส่ชื่อเล่น" };

  if (!/^0\d{9}$/.test(payload.phone))
    return {
      success: false,
      error: "เบอร์โทรต้องเป็น 10 หลัก เริ่มด้วย 0",
    };

  if (payload.pin && !/^\d{4}$/.test(payload.pin))
    return {
      success: false,
      error: "PIN ต้องเป็นตัวเลข 4 หลัก",
    };

  try {
    const updatePayload: Record<string, unknown> = {
      name: payload.name.trim(),
      nickname: payload.nickname.trim(),
      phone: payload.phone,
      role: payload.role,
      status: payload.status,
      updatedAt: serverTimestamp(),
    };

    if (payload.pin) {
      updatePayload.pin = payload.pin;
    }

    if (payload.status === "suspend") {
      updatePayload.anonymousUid = null;
    }

    await updateDoc(doc(db, "users", userId), updatePayload);

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "แก้ไขไม่สำเร็จ";
    return { success: false, error: message };
  }
}
