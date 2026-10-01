import type { Timestamp } from "firebase/firestore";

export interface ILocation {
  lat: number;
  lng: number;
}

export interface IVRPhoto {
  url: string;
  publicId: string;
  bytes: number;
  uploadedAt: string;
}

export interface IVR {
  photos?: IVRPhoto[];
  id: string;
  status: "good" | "minor_damage" | "major_damage" | "borrowed";
  locationType: "store" | "truck" | "warehouse";
  locationId: string;
  updatedAt: Timestamp | null;
  editedAt: Timestamp | null;
  createdAt: Timestamp | null;
}

export interface IWarehouse {
  id: string;
  name: string;
}

export interface IStore {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface ITruck {
  id: string;
  name: string;
  assignedUserId?: string;
}

export type LocationType = "store" | "truck" | "warehouse";

export interface IVRTransaction {
  id: string;
  // Legacy Firestore field retained for existing records and QR codes.
  gasId: string;

  fromLocationType: LocationType;
  fromLocationId: string;

  toLocationType: LocationType;
  toLocationId: string;

  performedBy: string;
  createdAt: Timestamp;
}
export type CsvMode = "devices" | "stores" | "trucks";
