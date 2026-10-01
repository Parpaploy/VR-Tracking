import { collection, getDocs } from "firebase/firestore";
import type { IWarehouse } from "../interfaces/data.interface";
import { db } from "./firebase";

export async function fetchWarehouses(): Promise<IWarehouse[]> {
  const snapshot = await getDocs(collection(db, "warehouses"));

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as IWarehouse[];
}
