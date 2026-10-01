import { collection, getDocs } from "firebase/firestore";
import type { IStore } from "../interfaces/data.interface";
import { db } from "./firebase";

export async function fetchStores(): Promise<IStore[]> {
  const snap = await getDocs(collection(db, "stores"));

  return snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as IStore[];
}
