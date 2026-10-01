import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import type { ITruck } from "../interfaces/data.interface";
import { db } from "./firebase";

export async function fetchTrucks(): Promise<ITruck[]> {
  const snap = await getDocs(collection(db, "trucks"));

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ITruck[];
}

export async function assignUserToTruck(
  truckId: string,
  userId: string,
): Promise<void> {
  await updateDoc(doc(db, "trucks", truckId), {
    assignedUserId: userId,
  });
}

export async function unassignUserFromTruck(truckId: string): Promise<void> {
  await updateDoc(doc(db, "trucks", truckId), {
    assignedUserId: "",
  });
}
