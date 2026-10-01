import type { IVR } from "../interfaces/data.interface";
import type { ICreateUserPayload } from "../interfaces/user.interface";

export const EMPTY_FORM: ICreateUserPayload = {
  name: "",
  nickname: "",
  studentId: "",
  studentEmail: "",
  identityImage: "",
  consent: false,
  phone: "",
  password: "",
  role: "user",
  status: "active",
};

export const USER_TABS = [
  { key: "list", label: "รายชื่อ" },
  { key: "create", label: "สร้างบัญชี" },
] as const;

export const STATUS_LABEL = {
  good: "พร้อมใช้",
  damaged: "ชำรุด",
  pending_approval: "รออนุมัติ",
  minor_damage: "ชำรุด",
  major_damage: "ชำรุด",
  borrowed: "ยืม",
};

export const STATUS_COLOR = {
  good: "bg-emerald-100 text-emerald-700",
  damaged: "bg-gray-200 text-gray-700",
  pending_approval: "bg-yellow-100 text-yellow-800",
  minor_damage: "bg-gray-200 text-gray-700",
  major_damage: "bg-gray-200 text-gray-700",
  borrowed: "bg-red-100 text-red-800",
};

export const LOCATION_LABEL: Record<IVR["locationType"], string> = {
  store: "ร้าน",
  truck: "รถ",
  warehouse: "โกดัง",
};

export const TABS = [
  { key: "location", label: "แยกสถานที่" },
  { key: "device", label: "รายอุปกรณ์" },
] as const;

export const FILTER_TABS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "warehouse", label: "โกดัง" },
  { key: "store", label: "ร้าน" },
  { key: "truck", label: "รถ" },
] as const;

export const LOCATION_TABS = [
  { key: "store", label: "ร้าน" },
  { key: "truck", label: "รถ" },
] as const;
