import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { IVR, IVRTransaction } from "../interfaces/data.interface";

export async function fetchVR(): Promise<IVR[]> {
  const snap = await getDocs(collection(db, "gas"));

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as IVR[];
}

export async function updateVRStatus(
  gasId: string,
  status: "good" | "minor_damage" | "major_damage" | "borrowed",
) {
  const vrRef = doc(db, "gas", gasId);

  await updateDoc(vrRef, {
    status,
    editedAt: serverTimestamp(),
  });
}

export async function moveVRToWarehouse(
  gasId: string,
  warehouseId: string,
  userId: string,
) {
  const vrRef = doc(db, "gas", gasId);

  await runTransaction(db, async (transaction) => {
    const vrSnap = await transaction.get(vrRef);

    if (!vrSnap.exists()) {
      throw new Error("VR not found");
    }

    const vr = vrSnap.data();

    if (vr.locationType === "warehouse" && vr.locationId === warehouseId) {
      throw new Error("VR already in this warehouse");
    }

    transaction.update(vrRef, {
      locationType: "warehouse",
      locationId: warehouseId,
      updatedAt: serverTimestamp(),
    });

    const transactionRef = doc(collection(db, "transactions"));

    transaction.set(transactionRef, {
      gasId,
      fromLocationType: vr.locationType,
      fromLocationId: vr.locationId,
      toLocationType: "warehouse",
      toLocationId: warehouseId,
      performedBy: userId,
      createdAt: serverTimestamp(),
    });
  });
}

export async function moveVRToStore(
  gasId: string,
  storeId: string,
  userId: string,
) {
  const vrRef = doc(db, "gas", gasId);

  await runTransaction(db, async (transaction) => {
    const vrSnap = await transaction.get(vrRef);

    if (!vrSnap.exists()) {
      throw new Error("VR not found");
    }

    const vr = vrSnap.data();

    if (vr.locationType === "store" && vr.locationId === storeId) {
      throw new Error("VR already in this store");
    }

    transaction.update(vrRef, {
      locationType: "store",
      locationId: storeId,
      updatedAt: serverTimestamp(),
    });

    const transactionRef = doc(collection(db, "transactions"));

    transaction.set(transactionRef, {
      gasId,
      fromLocationType: vr.locationType,
      fromLocationId: vr.locationId,
      toLocationType: "store",
      toLocationId: storeId,
      performedBy: userId,
      createdAt: serverTimestamp(),
    });
  });
}

export async function moveVRToTruck(
  gasId: string,
  truckId: string,
  userId: string,
) {
  const vrRef = doc(db, "gas", gasId);

  await runTransaction(db, async (transaction) => {
    const vrSnap = await transaction.get(vrRef);

    if (!vrSnap.exists()) {
      throw new Error("VR not found");
    }

    const vr = vrSnap.data();

    if (vr.locationType === "truck" && vr.locationId === truckId) {
      throw new Error("VR already in this truck");
    }

    transaction.update(vrRef, {
      locationType: "truck",
      locationId: truckId,
      updatedAt: serverTimestamp(),
    });

    const transactionRef = doc(collection(db, "transactions"));

    transaction.set(transactionRef, {
      gasId,
      fromLocationType: vr.locationType,
      fromLocationId: vr.locationId,
      toLocationType: "truck",
      toLocationId: truckId,
      performedBy: userId,
      createdAt: serverTimestamp(),
    });
  });
}

export async function deleteVR(gasId: string) {
  const vrRef = doc(db, "gas", gasId);
  await deleteDoc(vrRef);
}

export async function fetchLastEditorPerVR(): Promise<Record<string, string>> {
  const snap = await getDocs(collection(db, "transactions"));
  const latest: Record<string, { time: number; performedBy: string }> = {};
  snap.docs.forEach((doc) => {
    const d = doc.data() as IVRTransaction;
    if (!d.gasId) return;
    const t = d.createdAt?.toMillis?.() ?? 0;
    if (!latest[d.gasId] || t > latest[d.gasId].time) {
      latest[d.gasId] = { time: t, performedBy: d.performedBy };
    }
  });
  const result: Record<string, string> = {};
  Object.entries(latest).forEach(([gasId, v]) => {
    result[gasId] = v.performedBy;
  });
  return result;
}

export async function addVR(
  locationType: "warehouse" | "store" | "truck",
  locationId: string,
  status: "good" | "minor_damage" | "major_damage" | "borrowed",
): Promise<string> {
  const snap = await getDocs(collection(db, "gas"));

  let maxNum = 0;
  snap.docs.forEach((doc) => {
    const match = doc.id.match(/^VR-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });

  const newNum = maxNum + 1;
  const newId = `VR-${String(newNum).padStart(3, "0")}`;

  const vrRef = doc(db, "gas", newId);

  await setDoc(vrRef, {
    locationType,
    locationId,
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    editedAt: serverTimestamp(),
  });

  return newId;
}
