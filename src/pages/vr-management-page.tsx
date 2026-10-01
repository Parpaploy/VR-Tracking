import { VRPhotos } from "../components/vr-photos";
import { useEffect, useState, useMemo } from "react";
import Swal from "sweetalert2";
import type {
  CsvMode,
  IVR,
  IVRTransaction,
  IStore,
} from "../interfaces/data.interface";
import { IoIosSearch } from "react-icons/io";
import {
  addVR,
  deleteVR,
  fetchVR,
  fetchLastEditorPerVR,
  updateVRStatus,
} from "../lib/vr.services";
import { fetchStores } from "../lib/store.services";
import { fetchTrucks } from "../lib/truck.services";
import { FiDownload } from "react-icons/fi";
import { IoMdAdd } from "react-icons/io";
import {
  FILTER_TABS,
  LOCATION_LABEL,
  LOCATION_TABS,
  STATUS_COLOR,
  STATUS_LABEL,
  TABS,
} from "../constants/label";
import { fetchWarehouses } from "../lib/warehouses.services";
import { RxCross2 } from "react-icons/rx";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { fetchUsers } from "../lib/auth.services";
import { LocationDetailPopup } from "../components/location-detail-popup";
import {
  IoIosArrowForward,
  IoIosArrowUp,
  IoIosArrowDown,
  IoIosArrowBack,
} from "react-icons/io";
import { DateFilterRow } from "../functions/vr.func";
import { getDistance } from "../functions/location.func";

const toDateKey = (d: Date) => d.toLocaleDateString("en-CA");

export default function VRManagementPage() {
  const [devices, setDevices] = useState<IVR[]>([]);
  const [storeMap, setStoreMap] = useState<Record<string, string>>({});
  const [storeList, setStoreList] = useState<IStore[]>([]);
  const [truckMap, setTruckMap] = useState<Record<string, string>>({});
  const [warehouseMap, setWarehouseMap] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"device" | "location">("location");
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "store" | "truck" | "warehouse">(
    "all",
  );
  const [storeSearch, setStoreSearch] = useState("");
  const [showStoreSuggest, setShowStoreSuggest] = useState(false);
  const [locationTab, setLocationTab] = useState<
    "store" | "truck" | "warehouse"
  >("store");
  const [selectedVR, setSelectedVR] = useState<IVR | null>(null);
  const [newStatus, setNewStatus] = useState<
    "good" | "damaged" | "borrowed"
  >("good");
  const [manualBorrowerId, setManualBorrowerId] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [lastEditorMap, setLastEditorMap] = useState<Record<string, string>>(
    {},
  );
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [truckDriver, setTruckDriver] = useState<string | null>(null);
  const [loadingDriver, setLoadingDriver] = useState<boolean>(false);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [storeLastSender, setStoreLastSender] = useState<string | null>(null);
  const [loadingStoreSender, setLoadingStoreSender] = useState<boolean>(false);
  const [storeVRIds, setStoreVRIds] = useState<Set<string> | null>(null);
  const [loadingStoreVRIds, setLoadingStoreVRIds] = useState(false);
  const [truckVRIds, setTruckVRIds] = useState<Set<string> | null>(null);
  const [loadingTruckVRIds, setLoadingTruckVRIds] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState<boolean>(false);
  const [selectedCsvModes, setSelectedCsvModes] = useState<CsvMode[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [csvExportDate, setCsvExportDate] = useState<string>("");
  const [csvCalendarOpen, setCsvCalendarOpen] = useState<boolean>(false);
  const [csvCalendarMonth, setCsvCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [addLocationType, setAddLocationType] = useState<
    "warehouse" | "store" | "truck"
  >("warehouse");
  const [addLocationId, setAddLocationId] = useState<string>("");
  const [addStatus, setAddStatus] = useState<
    "good" | "damaged"
  >("good");
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());
  const [txVRIdsOnDate, setTxVRIdsOnDate] = useState<Set<string> | null>(
    null,
  );
  const [loadingTxDates, setLoadingTxDates] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) =>
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => {},
      { enableHighAccuracy: true },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const nearestAddStoreId = useMemo(() => {
    if (!userLocation || storeList.length === 0) return "";
    let nearest = storeList[0];
    let minDist = Infinity;
    for (const store of storeList) {
      const d = getDistance(
        userLocation.lat,
        userLocation.lng,
        store.latitude,
        store.longitude,
      );
      if (d < minDist) {
        minDist = d;
        nearest = store;
      }
    }
    return nearest.id;
  }, [userLocation, storeList]);

  const displayAddStores = useMemo(() => {
    let sorted = [...storeList];
    if (userLocation) {
      sorted = sorted.sort((a, b) => {
        const dA = getDistance(
          userLocation.lat,
          userLocation.lng,
          a.latitude,
          a.longitude,
        );
        const dB = getDistance(
          userLocation.lat,
          userLocation.lng,
          b.latitude,
          b.longitude,
        );
        return dA - dB;
      });
    }
    if (addLocationId) {
      sorted = [...sorted].sort((a) => (a.id === addLocationId ? -1 : 1));
    }
    return sorted;
  }, [storeList, userLocation, addLocationId]);

  const filteredAddStores = useMemo(() => {
    const keyword = storeSearch.trim().toLowerCase();
    if (!keyword) return storeList;
    return storeList.filter((s) => s.name.toLowerCase().includes(keyword));
  }, [storeSearch, storeList]);

  const handleChangeLocationType = (type: "warehouse" | "store" | "truck") => {
    setAddLocationType(type);
    setStoreSearch("");
    setShowStoreSuggest(false);
    if (type === "warehouse") {
      setAddLocationId(Object.keys(warehouseMap)[0] ?? "");
    } else {
      setAddLocationId("");
    }
  };

  const handleAddVR = async () => {
    if (!addLocationId) return;
    try {
      setIsAdding(true);
      const newId = await addVR(addLocationType, addLocationId, addStatus);
      const newVR: IVR = {
        id: newId,
        locationType: addLocationType,
        locationId: addLocationId,
        status: addStatus,
        createdAt: null,
        updatedAt: null,
        editedAt: null,
      };
      setDevices((prev) => [...prev, newVR]);
      await Swal.fire({
        icon: "success",
        title: "เพิ่มอุปกรณ์ VRสำเร็จ",
        text: `เพิ่มอุปกรณ์ VR "${newId}" แล้ว สามารถแนบรูปได้จากหน้ารายละเอียด`,
        confirmButtonColor: "#000",
      });
      setShowAddModal(false);
      setAddLocationId("");
      setStoreSearch("");
    } catch (err) {
      console.error(err);
      await Swal.fire({ icon: "error", title: "เพิ่มอุปกรณ์ VRไม่สำเร็จ" });
    } finally {
      setIsAdding(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoadingTxDates(true);
      try {
        const snap = await getDocs(collection(db, "transactions"));
        const dates = new Set<string>();
        snap.docs.forEach((doc) => {
          const d = doc.data().createdAt;
          if (d?.toDate) dates.add(toDateKey(d.toDate()));
        });
        if (!cancelled) {
          setActiveDates((prev) => new Set([...prev, ...dates]));
        }
      } finally {
        if (!cancelled) setLoadingTxDates(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedDate) {
      setTxVRIdsOnDate(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const start = new Date(selectedDate + "T00:00:00");
      const end = new Date(selectedDate + "T23:59:59.999");
      const snap = await getDocs(
        query(
          collection(db, "transactions"),
          where("createdAt", ">=", Timestamp.fromDate(start)),
          where("createdAt", "<=", Timestamp.fromDate(end)),
        ),
      );
      const ids = new Set<string>();
      snap.docs.forEach((doc) => {
        const data = doc.data() as IVRTransaction;
        if (data.gasId) ids.add(data.gasId);
      });
      if (!cancelled) setTxVRIdsOnDate(ids);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const activityVRIds = useMemo<Set<string> | null>(() => {
    if (!selectedDate) return null;
    return txVRIdsOnDate ?? new Set<string>();
  }, [selectedDate, txVRIdsOnDate]);

  const [txLocationMap, setTxLocationMap] = useState<
    Record<string, Set<string>>
  >({});

  const handleDeleteVR = async () => {
    if (!selectedVR) return;
    const gasId = selectedVR.id;
    const confirmResult = await Swal.fire({
      icon: "warning",
      title: "ยืนยันการลบ?",
      text: `ต้องการลบอุปกรณ์ VR "${gasId}" ใช่หรือไม่`,
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
    });
    if (!confirmResult.isConfirmed) return;
    try {
      setIsDeleting(true);
      await deleteVR(gasId);
      setDevices((prev) => prev.filter((g) => g.id !== gasId));
      await Swal.fire({
        icon: "success",
        title: "ลบสำเร็จ",
        text: `ลบอุปกรณ์ VR "${gasId}" แล้ว`,
        confirmButtonColor: "#000",
      });
      setSelectedVR(null);
    } catch (err) {
      console.error(err);
      await Swal.fire({
        icon: "error",
        title: "ลบไม่สำเร็จ",
        text: "เกิดข้อผิดพลาด กรุณาลองใหม่",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (!selectedDate || !txVRIdsOnDate) {
      setTxLocationMap({});
      return;
    }
    const run = async () => {
      const start = new Date(selectedDate + "T00:00:00");
      const end = new Date(selectedDate + "T23:59:59.999");
      const snap = await getDocs(
        query(
          collection(db, "transactions"),
          where("createdAt", ">=", Timestamp.fromDate(start)),
          where("createdAt", "<=", Timestamp.fromDate(end)),
        ),
      );
      const map: Record<string, Set<string>> = {};
      snap.docs.forEach((doc) => {
        const data = doc.data() as IVRTransaction;
        if (!data.gasId) return;
        const addTo = (type: string, id: string) => {
          const key = `${type}__${id}`;
          if (!map[key]) map[key] = new Set();
          map[key].add(data.gasId);
        };
        if (data.toLocationType && data.toLocationId) addTo(data.toLocationType, data.toLocationId);
        if (data.fromLocationType && data.fromLocationId) addTo(data.fromLocationType, data.fromLocationId);
      });
      setTxLocationMap(map);
    };
    run();
  }, [selectedDate, txVRIdsOnDate]);

  const filtered = useMemo(() => {
    return devices.filter((g) => {
      const matchType = filter === "all" || g.locationType === filter;
      if (!activityVRIds) return matchType;
      return matchType && activityVRIds.has(g.id);
    });
  }, [devices, filter, activityVRIds]);

  const grouped = useMemo(() => {
    if (!selectedDate) {
      return devices.reduce<Record<string, IVR[]>>((acc, g) => {
        const key = `${g.locationType}__${g.locationId}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(g);
        return acc;
      }, {});
    }
    const result: Record<string, IVR[]> = {};
    Object.entries(txLocationMap).forEach(([locationKey, gasIdSet]) => {
      const matched = devices.filter((g) => gasIdSet.has(g.id));
      if (matched.length > 0) result[locationKey] = matched;
    });
    return result;
  }, [devices, selectedDate, txLocationMap]);

  const warehouseSource = activityVRIds
    ? devices.filter((g) => activityVRIds.has(g.id))
    : devices;
  const warehouseItems = warehouseSource.filter(
    (g) => g.locationType === "warehouse",
  );

  useEffect(() => {
    const isModalOpen =
      showCsvModal ||
      selectedStoreId ||
      selectedTruckId ||
      selectedVR ||
      showAddModal;
    document.body.style.overflow = isModalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [
    showCsvModal,
    selectedStoreId,
    selectedTruckId,
    selectedVR,
    showAddModal,
  ]);

  const handleSaveStatus = async () => {
    if (!selectedVR) return;
    const gasId = selectedVR.id;
    const confirmResult = await Swal.fire({
      icon: "question",
      title: "ยืนยันการบันทึก?",
      text: `เปลี่ยนสถานะอุปกรณ์ VR "${gasId}" เป็น "${STATUS_LABEL[newStatus]}" ใช่หรือไม่`,
      showCancelButton: true,
      confirmButtonText: "บันทึก",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#000",
      cancelButtonColor: "#6b7280",
    });
    if (!confirmResult.isConfirmed) return;
    try {
      setIsSaving(true);
      await updateVRStatus(gasId, newStatus, manualBorrowerId || undefined);
      setDevices((prev) =>
        prev.map((g) => (g.id === gasId ? {
          ...g,
          status: newStatus,
          statusSource: "admin",
          adminBorrowerId: newStatus === "borrowed" ? manualBorrowerId || null : null,
          adminBorrowerName: newStatus === "borrowed" ? userMap[manualBorrowerId] ?? null : null,
        } : g)),
      );
      await Swal.fire({
        icon: "success",
        title: "บันทึกสำเร็จ",
        text: `อัปเดตสถานะอุปกรณ์ VR "${gasId}" แล้ว`,
        confirmButtonColor: "#000",
      });
      setSelectedVR(null);
    } catch (err) {
      console.error(err);
      await Swal.fire({ icon: "error", title: "บันทึกไม่สำเร็จ" });
    } finally {
      setIsSaving(false);
    }
  };

  const getLocationName = (
    locationType: IVR["locationType"],
    locationId: string,
  ) => {
    if (locationType === "store") return storeMap[locationId] ?? locationId;
    if (locationType === "truck") return truckMap[locationId] ?? locationId;
    if (locationType === "warehouse")
      return warehouseMap[locationId] ?? locationId;
    return locationId;
  };

  const fetchLastPerson = async (
    locationType: "device" | "truck" | "store",
    locationId: string,
    userMap: Record<string, string>,
    dateFilter?: string,
  ) => {
    if (dateFilter) {
      const start = new Date(dateFilter + "T00:00:00");
      const end = new Date(dateFilter + "T23:59:59.999");
      const snap = await getDocs(
        query(
          collection(db, "transactions"),
          where("createdAt", ">=", Timestamp.fromDate(start)),
          where("createdAt", "<=", Timestamp.fromDate(end)),
        ),
      );
      const relevant = snap.docs
        .filter((doc) => {
          const d = doc.data();
          return (
            d.toLocationType === locationType && d.toLocationId === locationId
          );
        })
        .sort(
          (a, b) =>
            b.data().createdAt?.toMillis() - a.data().createdAt?.toMillis(),
        );
      if (relevant.length === 0) return { name: "-", time: "-" };
      const data = relevant[0].data();
      return {
        name: userMap[data.performedBy] || "-",
        time: data.createdAt?.toDate
          ? data.createdAt.toDate().toLocaleString("th-TH", {
              dateStyle: "short",
              timeStyle: "short",
            })
          : "-",
      };
    }
    const q = query(
      collection(db, "transactions"),
      where("toLocationType", "==", locationType),
      where("toLocationId", "==", locationId),
      orderBy("createdAt", "desc"),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return { name: "-", time: "-" };
    const data = snap.docs[0].data();
    return {
      name: userMap[data.performedBy] || "-",
      time: data.createdAt?.toDate
        ? data.createdAt.toDate().toLocaleString("th-TH", {
            dateStyle: "short",
            timeStyle: "short",
          })
        : "-",
    };
  };

  const toggleCsvMode = (mode: CsvMode) => {
    setSelectedCsvModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode],
    );
  };

  const buildUserMap = async (): Promise<Record<string, string>> => {
    const users = await fetchUsers();
    const map: Record<string, string> = {};
    users.forEach((u) => {
      map[u.id] = u.nickname || u.name || u.id;
    });
    return map;
  };

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      fetchVR(),
      fetchStores(),
      fetchTrucks(),
      fetchWarehouses(),
      fetchUsers(),
      fetchLastEditorPerVR(),
    ])
      .then(([devices, stores, trucks, warehouses, users, lastEditors]) => {
        setDevices(devices);
        setStoreList(stores as IStore[]);
        setStoreMap(Object.fromEntries(stores.map((s) => [s.id, s.name])));
        setTruckMap(Object.fromEntries(trucks.map((t) => [t.id, t.name])));
        setWarehouseMap(
          Object.fromEntries(warehouses.map((w) => [w.id, w.name])),
        );
        const u: Record<string, string> = {};
        users.forEach((user) => {
          u[user.id] = user.nickname || user.name || user.id;
        });
        setUserMap(u);
        setLastEditorMap(lastEditors);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleOpenTruck = async (truckId: string) => {
    setSelectedTruckId(truckId);
    setTruckDriver(null);
    setLoadingDriver(true);
    setTruckVRIds(null);
    setLoadingTruckVRIds(!!selectedDate);
    if (selectedDate) {
      try {
        const start = new Date(selectedDate + "T00:00:00");
        const end = new Date(selectedDate + "T23:59:59.999");
        const snap = await getDocs(
          query(
            collection(db, "transactions"),
            where("createdAt", ">=", Timestamp.fromDate(start)),
            where("createdAt", "<=", Timestamp.fromDate(end)),
          ),
        );
        const ids = new Set<string>();
        snap.docs.forEach((doc) => {
          const data = doc.data() as IVRTransaction;
          const involved =
            (data.toLocationType === "truck" &&
              data.toLocationId === truckId) ||
            (data.fromLocationType === "truck" &&
              data.fromLocationId === truckId);
          if (involved && data.gasId) ids.add(data.gasId);
        });
        setTruckVRIds(ids);
      } catch {
        setTruckVRIds(new Set());
      } finally {
        setLoadingTruckVRIds(false);
      }
    }
    try {
      const userMap = await buildUserMap();
      const driver = await fetchLastPerson(
        "truck",
        truckId,
        userMap,
        selectedDate || undefined,
      );
      setTruckDriver(
        driver.name === "-" ? null : `${driver.name} (${driver.time})`,
      );
    } catch {
      setTruckDriver(null);
    } finally {
      setLoadingDriver(false);
    }
  };

  const handleOpenStore = async (storeId: string) => {
    setSelectedStoreId(storeId);
    setStoreLastSender(null);
    setLoadingStoreSender(true);
    setStoreVRIds(null);
    setLoadingStoreVRIds(!!selectedDate);
    if (selectedDate) {
      try {
        const start = new Date(selectedDate + "T00:00:00");
        const end = new Date(selectedDate + "T23:59:59.999");
        const snap = await getDocs(
          query(
            collection(db, "transactions"),
            where("createdAt", ">=", Timestamp.fromDate(start)),
            where("createdAt", "<=", Timestamp.fromDate(end)),
          ),
        );
        const ids = new Set<string>();
        snap.docs.forEach((doc) => {
          const data = doc.data() as IVRTransaction;
          const involved =
            (data.toLocationType === "store" &&
              data.toLocationId === storeId) ||
            (data.fromLocationType === "store" &&
              data.fromLocationId === storeId);
          if (involved && data.gasId) ids.add(data.gasId);
        });
        setStoreVRIds(ids);
      } catch {
        setStoreVRIds(new Set());
      } finally {
        setLoadingStoreVRIds(false);
      }
    }
    try {
      const userMap = await buildUserMap();
      const sender = await fetchLastPerson(
        "store",
        storeId,
        userMap,
        selectedDate || undefined,
      );
      setStoreLastSender(
        sender.name === "-" ? null : `${sender.name} (${sender.time})`,
      );
    } catch {
      setStoreLastSender(null);
    } finally {
      setLoadingStoreSender(false);
    }
  };

  const downloadCsv = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const toCsvRow = (row: string[]) =>
    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",");

  const exportDevices = async (date: string, exportDate?: string) => {
    const headers = [
      "รหัสอุปกรณ์ VR",
      "ประเภทสถานที่",
      "สถานที่",
      "สถานะ",
      "อัปเดตล่าสุด",
    ];
    let sourceDevices = devices;
    if (exportDate) {
      const start = new Date(exportDate + "T00:00:00");
      const end = new Date(exportDate + "T23:59:59.999");
      const snap = await getDocs(
        query(
          collection(db, "transactions"),
          where("createdAt", ">=", Timestamp.fromDate(start)),
          where("createdAt", "<=", Timestamp.fromDate(end)),
        ),
      );
      const ids = new Set<string>();
      snap.docs.forEach((doc) => {
        const d = doc.data() as IVRTransaction;
        if (d.gasId) ids.add(d.gasId);
      });
      sourceDevices = devices.filter((g) => ids.has(g.id));
    }
    const rows = sourceDevices.map((g) => [
      g.id,
      LOCATION_LABEL[g.locationType],
      getLocationName(g.locationType, g.locationId),
      STATUS_LABEL[g.status],
      g.updatedAt
        ? g.updatedAt
            .toDate()
            .toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })
        : "-",
    ]);
    downloadCsv(
      "\uFEFF" + [headers, ...rows].map(toCsvRow).join("\n"),
      `vr-devices-${date}.csv`,
    );
  };

  const exportStores = async (date: string, exportDate?: string) => {
    const headers = [
      "ชื่อร้าน",
      "จำนวนอุปกรณ์ VR",
      "ปกติ",
      "รออนุมัติ",
      "ชำรุด",
      "ยืม",
      "ผู้ส่งล่าสุด",
      "อัปเดตล่าสุด",
    ];
    const userMap = await buildUserMap();
    let storeVRMap: Record<string, Set<string>> | null = null;
    if (exportDate) {
      const start = new Date(exportDate + "T00:00:00");
      const end = new Date(exportDate + "T23:59:59.999");
      const snap = await getDocs(
        query(
          collection(db, "transactions"),
          where("createdAt", ">=", Timestamp.fromDate(start)),
          where("createdAt", "<=", Timestamp.fromDate(end)),
        ),
      );
      storeVRMap = {};
      snap.docs.forEach((doc) => {
        const d = doc.data() as IVRTransaction;
        if (!d.gasId) return;
        const addTo = (locationType: string, locationId: string) => {
          if (locationType !== "store") return;
          if (!storeVRMap![locationId]) storeVRMap![locationId] = new Set();
          storeVRMap![locationId].add(d.gasId);
        };
        if (d.toLocationType && d.toLocationId) addTo(d.toLocationType, d.toLocationId);
        if (d.fromLocationType && d.fromLocationId) addTo(d.fromLocationType, d.fromLocationId);
      });
    }
    const rows = await Promise.all(
      Object.entries(storeMap).map(async ([storeId, storeName]) => {
        let storeDevices: IVR[];
        if (storeVRMap) {
          const ids = storeVRMap[storeId] ?? new Set();
          storeDevices = devices.filter((g) => ids.has(g.id));
        } else {
          storeDevices = devices.filter(
            (g) => g.locationType === "store" && g.locationId === storeId,
          );
        }
        const last = await fetchLastPerson(
          "store",
          storeId,
          userMap,
          exportDate,
        );
        return [
          storeName,
          String(storeDevices.length),
          String(storeDevices.filter((g) => g.status === "good").length),
          String(storeDevices.filter((g) => g.status === "pending_approval").length),
          String(storeDevices.filter((g) => g.status === "damaged" || g.status === "minor_damage" || g.status === "major_damage").length),
          String(storeDevices.filter((g) => g.status === "borrowed").length),
          last.name,
          last.time,
        ];
      }),
    );
    downloadCsv(
      "\uFEFF" + [headers, ...rows].map(toCsvRow).join("\n"),
      `vr-stores-${date}.csv`,
    );
  };

  const exportTrucks = async (date: string, exportDate?: string) => {
    const headers = [
      "ชื่อรถ",
      "จำนวนอุปกรณ์ VR",
      "ปกติ",
      "รออนุมัติ",
      "ชำรุด",
      "ยืม",
      "คนขับล่าสุด",
      "อัปเดตล่าสุด",
    ];
    const userMap = await buildUserMap();
    let truckVRMap: Record<string, Set<string>> | null = null;
    if (exportDate) {
      const start = new Date(exportDate + "T00:00:00");
      const end = new Date(exportDate + "T23:59:59.999");
      const snap = await getDocs(
        query(
          collection(db, "transactions"),
          where("createdAt", ">=", Timestamp.fromDate(start)),
          where("createdAt", "<=", Timestamp.fromDate(end)),
        ),
      );
      truckVRMap = {};
      snap.docs.forEach((doc) => {
        const d = doc.data() as IVRTransaction;
        if (!d.gasId) return;
        const addTo = (locationType: string, locationId: string) => {
          if (locationType !== "truck") return;
          if (!truckVRMap![locationId]) truckVRMap![locationId] = new Set();
          truckVRMap![locationId].add(d.gasId);
        };
        if (d.toLocationType && d.toLocationId) addTo(d.toLocationType, d.toLocationId);
        if (d.fromLocationType && d.fromLocationId) addTo(d.fromLocationType, d.fromLocationId);
      });
    }
    const rows = await Promise.all(
      Object.entries(truckMap).map(async ([truckId, truckName]) => {
        let truckDevices: IVR[];
        if (truckVRMap) {
          const ids = truckVRMap[truckId] ?? new Set();
          truckDevices = devices.filter((g) => ids.has(g.id));
        } else {
          truckDevices = devices.filter(
            (g) => g.locationType === "truck" && g.locationId === truckId,
          );
        }
        const last = await fetchLastPerson(
          "truck",
          truckId,
          userMap,
          exportDate,
        );
        return [
          truckName,
          String(truckDevices.length),
          String(truckDevices.filter((g) => g.status === "good").length),
          String(truckDevices.filter((g) => g.status === "pending_approval").length),
          String(truckDevices.filter((g) => g.status === "damaged" || g.status === "minor_damage" || g.status === "major_damage").length),
          String(truckDevices.filter((g) => g.status === "borrowed").length),
          last.name,
          last.time,
        ];
      }),
    );
    downloadCsv(
      "\uFEFF" + [headers, ...rows].map(toCsvRow).join("\n"),
      `vr-trucks-${date}.csv`,
    );
  };

  const handleExport = async () => {
    if (selectedCsvModes.length === 0) return;
    setIsExporting(true);
    const date = new Date().toISOString().slice(0, 10);
    try {
      for (const mode of selectedCsvModes) {
        if (mode === "devices")
          await exportDevices(date, csvExportDate || undefined);
        if (mode === "stores")
          await exportStores(date, csvExportDate || undefined);
        if (mode === "trucks")
          await exportTrucks(date, csvExportDate || undefined);
      }
      setShowCsvModal(false);
      setSelectedCsvModes([]);
      setCsvExportDate("");
      setCsvCalendarOpen(false);
    } finally {
      setIsExporting(false);
    }
  };

  const warehouses = Object.entries(warehouseMap);
  const warehouseGood = warehouseItems.filter(
    (g) => g.status === "good",
  ).length;
  const warehouseMinor = warehouseItems.filter(
    (g) => g.status === "pending_approval",
  ).length;
  const warehouseMajor = warehouseItems.filter(
    (g) => g.status === "damaged" || g.status === "minor_damage" || g.status === "major_damage",
  ).length;
  const warehouseBorrowed = warehouseItems.filter(
    (g) => g.status === "borrowed",
  ).length;

  const warehouseTotal = warehouseItems.length;

  const selectedTruckDevices = selectedTruckId
    ? devices.filter((g) => {
        if (!selectedDate)
          return g.locationType === "truck" && g.locationId === selectedTruckId;
        return truckVRIds ? truckVRIds.has(g.id) : false;
      })
    : [];
  const truckGood = selectedTruckDevices.filter(
    (g) => g.status === "good",
  ).length;
  const truckMinor = selectedTruckDevices.filter(
    (g) => g.status === "pending_approval",
  ).length;
  const truckMajor = selectedTruckDevices.filter(
    (g) => g.status === "damaged" || g.status === "minor_damage" || g.status === "major_damage",
  ).length;
  const truckBorrowed = selectedTruckDevices.filter(
    (g) => g.status === "borrowed",
  ).length;

  const selectedStoreDevices = selectedStoreId
    ? devices.filter((g) => {
        if (!selectedDate)
          return g.locationType === "store" && g.locationId === selectedStoreId;
        return storeVRIds ? storeVRIds.has(g.id) : false;
      })
    : [];
  const storeGood = selectedStoreDevices.filter(
    (g) => g.status === "good",
  ).length;
  const storeMinor = selectedStoreDevices.filter(
    (g) => g.status === "pending_approval",
  ).length;
  const storeMajor = selectedStoreDevices.filter(
    (g) => g.status === "damaged" || g.status === "minor_damage" || g.status === "major_damage",
  ).length;
  const storeBorrowed = selectedStoreDevices.filter(
    (g) => g.status === "borrowed",
  ).length;

  const CSV_OPTIONS: { key: CsvMode; label: string; desc: string }[] = [
    {
      key: "devices",
      label: "รายการอุปกรณ์ VR",
      desc: "อุปกรณ์ VR แต่ละเครื่องอยู่ที่ไหน สถานะ อัปเดตล่าสุดเมื่อไหร่",
    },
    {
      key: "stores",
      label: "รายงานร้านค้า",
      desc: "แต่ละร้านมีอุปกรณ์ VR กี่เครื่อง รหัสอุปกรณ์ VR ใครส่งล่าสุด",
    },
    {
      key: "trucks",
      label: "รายงานรถ",
      desc: "แต่ละคันมีอุปกรณ์ VR กี่เครื่อง คนขับล่าสุด อัปเดตล่าสุด",
    },
  ];

  const index = FILTER_TABS.findIndex((t) => t.key === filter);
  const isLast = index === FILTER_TABS.length - 1;
  const mainIndex = TABS.findIndex((t) => t.key === tab);
  const mainIsLast = mainIndex === TABS.length - 1;
  const locationIndex = LOCATION_TABS.findIndex((t) => t.key === locationTab);
  const locationIsLast = locationIndex === LOCATION_TABS.length - 1;

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push(dateStr);
    }
    return days;
  }, [calendarMonth]);

  const csvCalendarDays = useMemo(() => {
    const year = csvCalendarMonth.getFullYear();
    const month = csvCalendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (string | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push(dateStr);
    }
    return days;
  }, [csvCalendarMonth]);

  return (
    <main className="w-full h-[90svh] flex flex-col gap-y-5 min-h-0 p-3 pb-5 bg-white text-black">
      <div className="relative flex gap-1 border border-black/[0.07] rounded-[10px] p-1 bg-white overflow-hidden min-h-15">
        <div
          className="absolute top-1 bottom-1 rounded-[10px] bg-black transition-all duration-300 ease-in-out"
          style={{
            width: `calc(${100 / TABS.length}% - 6px)`,
            left: `calc(${mainIndex} * ${100 / TABS.length}% + 4px ${mainIsLast ? "- 2px" : ""})`,
          }}
        />
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setCalendarOpen(false);
              setCsvCalendarOpen(false);
              setShowCsvModal(false);
              setSelectedVR(null);
              setTab(t.key);
            }}
            className="relative flex-1 px-2 py-2 text-[16px] font-bold text-black z-10"
          >
            {t.label}
            <span
              className={`absolute inset-0 flex items-center justify-center text-white overflow-hidden transition-opacity duration-300 rounded-[10px] pointer-events-none ${tab === t.key ? "opacity-100" : "opacity-0"}`}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>

      {tab === "device" && (
        <>
          <div className="flex gap-2 items-center">
            <div className="relative flex flex-1 gap-1 border border-black/[0.07] rounded-[10px] p-1 bg-white overflow-hidden">
              <div
                className="absolute top-1 bottom-1 rounded-[10px] bg-black/10 transition-all duration-300 ease-in-out"
                style={{
                  width: `calc(${100 / FILTER_TABS.length}% - 6px)`,
                  left: `calc(${index} * ${100 / FILTER_TABS.length}% + 4px ${isLast ? "- 2px" : ""})`,
                }}
              />
              {FILTER_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setFilter(t.key)}
                  className={`relative flex-1 px-1 py-1.5 text-[13px] font-bold z-10 rounded-[10px] transition-colors duration-200 ${filter === t.key ? "text-black" : "text-black/30"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setAddLocationType("warehouse");
                setAddLocationId(Object.keys(warehouseMap)[0] ?? "");
                setAddStatus("good");
                setStoreSearch("");
                setShowAddModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-[10px] border border-black/10 font-bold bg-white text-black/60 transition-all"
            >
              <IoMdAdd size={20} />
            </button>
            <button
              onClick={() => setShowCsvModal(true)}
              disabled={devices.length === 0}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-[10px] border border-black/10 text-[13px] font-bold ${showCsvModal ? "bg-black text-white/60" : "bg-white text-black/60"} disabled:opacity-30 active:scale-95 transition-all`}
            >
              <FiDownload size={14} />
              CSV
            </button>
          </div>

          <DateFilterRow
            calendarOpen={calendarOpen}
            setCalendarOpen={setCalendarOpen}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            loadingTxDates={loadingTxDates}
            calendarMonth={calendarMonth}
            setCalendarMonth={setCalendarMonth}
            calendarDays={calendarDays}
            activeDates={activeDates}
          />

          <div className="flex flex-col gap-y-3 w-full flex-1 min-h-0 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-1 justify-center items-center w-full text-gray-500">
                <div className="w-18 h-18 border-6 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="w-full h-full flex justify-center items-center text-center text-black/20 px-3">
                {selectedDate
                  ? "ไม่มีการเคลื่อนไหวในวันนี้"
                  : "ยังไม่มีอุปกรณ์ VR"}
              </div>
            ) : (
              filtered.map((g) => (
                <div
                  key={g.id}
                  onClick={() => {
                    setSelectedVR(g);
                    setNewStatus(g.status === "good" ? "good" : g.status === "borrowed" ? "borrowed" : "damaged");
                    setManualBorrowerId(g.adminBorrowerId ?? "");
                  }}
                  className="w-full flex items-center gap-3 bg-white border border-black/[0.07] px-5 py-3 rounded-[10px]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{g.id}</p>
                    <p className="text-sm text-black/40">
                      <span className="font-bold">
                        {LOCATION_LABEL[g.locationType]}
                      </span>{" "}
                      — {getLocationName(g.locationType, g.locationId)}
                    </p>
                    <p className="text-sm text-black/40">
                      <span className="font-bold">อัปเดต:</span>{" "}
                      {g.updatedAt?.toDate().toLocaleString("th-TH", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                    <p className="text-sm text-black/40">
                      <span className="font-bold">ส่งล่าสุดโดย:</span>{" "}
                      {userMap[lastEditorMap[g.id] ?? ""] ?? "-"}
                    </p>
                  </div>
                  <span
                    className={`text-[14px] font-bold px-3 py-1 rounded-full ${STATUS_COLOR[g.status]}`}
                  >
                    {STATUS_LABEL[g.status]}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === "location" && (
        <div
          className={`flex flex-col flex-1 min-h-0 ${isLoading ? "" : "overflow-y-auto"}`}
        >
          <div className="shrink-0 mb-3">
            <div className="w-full bg-white border border-black/10 rounded-2xl p-6">
              <div>
                <p className="text-xl font-bold">
                  {warehouses.length === 1
                    ? warehouses[0][1]
                    : "คลังสินค้าทั้งหมด"}
                </p>
                <p className="text-sm text-black/40 mb-6">
                  จำนวนทั้งหมด {warehouseTotal} เครื่อง
                  {selectedDate && (
                    <span className="ml-1 text-black/30">
                      (เฉพาะวันที่มีการเคลื่อนไหว)
                    </span>
                  )}
                </p>
              </div>
              <div className="grid md:grid-cols-4 grid-cols-2 gap-4">
                <div className="rounded-xl bg-emerald-50 p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-600">
                    {warehouseGood}
                  </p>
                  <p className="text-sm text-emerald-700 mt-1">ปกติ</p>
                </div>
                <div className="rounded-xl bg-yellow-50 p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-600">
                    {warehouseMinor}
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">รออนุมัติ</p>
                </div>
                <div className="rounded-xl bg-gray-100 p-4 text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {warehouseMajor}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">ชำรุด</p>
                </div>
                <div className="rounded-xl bg-red-50 p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {warehouseBorrowed}
                  </p>
                  <p className="text-sm text-red-700 mt-1">ยืม</p>
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 w-full flex gap-2 items-center mb-2">
            <div className="w-full relative flex gap-1 border border-black/[0.07] rounded-[10px] p-1 bg-white overflow-hidden">
              <div
                className="absolute top-1 bottom-1 rounded-[10px] bg-black/10 transition-all duration-300 ease-in-out"
                style={{
                  width: `calc(${100 / LOCATION_TABS.length}% - 6px)`,
                  left: `calc(${locationIndex} * ${100 / LOCATION_TABS.length}% + 4px ${locationIsLast ? "- 2px" : ""})`,
                }}
              />
              {LOCATION_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setLocationTab(t.key)}
                  className={`relative flex-1 px-1 py-1.5 text-[13px] font-bold z-10 rounded-[10px] transition-colors duration-200 ${locationTab === t.key ? "text-black" : "text-black/30"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                setAddLocationType("warehouse");
                setAddLocationId(Object.keys(warehouseMap)[0] ?? "");
                setAddStatus("good");
                setStoreSearch("");
                setShowAddModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-[10px] border border-black/10 font-bold bg-white text-black/60 transition-all"
            >
              <IoMdAdd size={20} />
            </button>
            <button
              onClick={() => setShowCsvModal(true)}
              disabled={devices.length === 0}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-[10px] border border-black/10 text-[13px] font-bold ${showCsvModal ? "bg-black text-white/60" : "bg-white text-black/60"} disabled:opacity-30 active:scale-95 transition-all`}
            >
              <FiDownload size={14} />
              CSV
            </button>
          </div>

          <div className="shrink-0 mb-3">
            <DateFilterRow
              calendarOpen={calendarOpen}
              setCalendarOpen={setCalendarOpen}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              loadingTxDates={loadingTxDates}
              calendarMonth={calendarMonth}
              setCalendarMonth={setCalendarMonth}
              calendarDays={calendarDays}
              activeDates={activeDates}
            />
          </div>

          {isLoading ? (
            <div className="flex flex-1 justify-center items-center w-full text-gray-500">
              <div className="w-18 h-18 border-6 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto shrink-0">
              <table className="w-full min-w-107.5 text-[18px] border-collapse">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="text-left py-2 px-3 font-bold text-black/40 text-[14px]">
                      ชื่อ
                    </th>
                    <th className="text-center py-2 px-0 font-bold text-black/40 text-[14px]">
                      <span className="py-1 px-2 rounded-full bg-emerald-100 text-emerald-700">
                        ปกติ
                      </span>
                    </th>
                    <th className="text-center py-2 px-0 font-bold text-black/40 text-[14px]">
                      <span className="py-1 px-2 whitespace-nowrap rounded-full bg-yellow-100 text-yellow-800">
                        รออนุมัติ
                      </span>
                    </th>
                    <th className="text-center py-2 px-0 font-bold text-black/40 text-[14px]">
                      <span className="py-1 px-2 rounded-full bg-gray-200 text-gray-700">
                        ชำรุด
                      </span>
                    </th>
                    <th className="text-center py-2 px-0 font-bold text-black/40 text-[14px]">
                      <span className="py-1 px-2 rounded-full bg-red-100 text-red-700">
                        ยืม
                      </span>
                    </th>
                    <th className="text-center py-2 px-3 font-bold text-black/40 text-[14px]">
                      รวม
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped)
                    .filter(([key]) => key.startsWith(locationTab))
                    .map(([key, items]) => {
                      const [locationType, locationId] = key.split("__") as [
                        IVR["locationType"],
                        string,
                      ];
                      const name = getLocationName(locationType, locationId);
                      const good = items.filter(
                        (g) => g.status === "good",
                      ).length;
                      const minor_damage = items.filter(
                        (g) => g.status === "pending_approval",
                      ).length;
                      const major_damage = items.filter(
                        (g) => g.status === "damaged" || g.status === "minor_damage" || g.status === "major_damage",
                      ).length;
                      const borrowed = items.filter(
                        (g) => g.status === "borrowed",
                      ).length;
                      const isClickable =
                        locationType === "truck" || locationType === "store";
                      return (
                        <tr
                          key={key}
                          onClick={() => {
                            if (locationType === "truck")
                              handleOpenTruck(locationId);
                            if (locationType === "store")
                              handleOpenStore(locationId);
                          }}
                          className={`border-b border-black/6 last:border-b-0 ${isClickable ? "active:bg-black/5" : ""}`}
                        >
                          <td className="py-3 px-3 w-full max-w-0">
                            <div className="flex items-center gap-1 w-fit max-w-full">
                              <p className="truncate min-w-0">{name}</p>
                              {isClickable && (
                                <IoIosArrowForward
                                  size={18}
                                  className="text-black/30 shrink-0"
                                />
                              )}
                            </div>
                          </td>
                          <td className="text-center py-3 px-3">
                            <span>{good}</span>
                          </td>
                          <td className="text-center py-3 px-3">
                            <span>{minor_damage}</span>
                          </td>
                          <td className="text-center py-3 px-3">
                            <span>{major_damage}</span>
                          </td>
                          <td className="text-center py-3 px-3">
                            <span>{borrowed}</span>
                          </td>
                          <td className="text-center py-3 px-3">
                            <span>{items.length}</span>
                          </td>
                        </tr>
                      );
                    })}
                  {Object.entries(grouped).filter(([key]) =>
                    key.startsWith(locationTab),
                  ).length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="text-center py-10 text-black/20 text-[14px]"
                      >
                        {selectedDate
                          ? "ไม่มีการเคลื่อนไหวในวันนี้"
                          : "ยังไม่มีข้อมูล"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showCsvModal && (
        <div
          key="csv-modal-backdrop"
          className="mx-auto fixed inset-0 bg-black/40 flex items-end justify-center z-99"
        >
          <div className="bg-white w-full rounded-t-[20px] p-6 flex flex-col gap-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-[20px] font-bold">เลือกรูปแบบ CSV</h2>
              <button
                onClick={() => {
                  setShowCsvModal(false);
                  setCsvCalendarOpen(false);
                  setCsvExportDate("");
                  setSelectedCsvModes([]);
                }}
                className="border border-black/10 rounded-full p-2"
              >
                <RxCross2 size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {CSV_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => toggleCsvMode(opt.key)}
                  className={`w-full text-left px-4 py-3 rounded-[10px] border transition-all ${selectedCsvModes.includes(opt.key) ? "border-black bg-black text-white" : "border-black/10 bg-white text-black"}`}
                >
                  <p className="font-bold text-[16px]">{opt.label}</p>
                  <p
                    className={`text-[13px] mt-0.5 ${selectedCsvModes.includes(opt.key) ? "text-white/70" : "text-black/40"}`}
                  >
                    {opt.desc}
                  </p>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[13px] font-bold text-black/40">ช่วงข้อมูล</p>
              <div className="flex items-center gap-2 relative">
                <button
                  onClick={() => setCsvCalendarOpen((v) => !v)}
                  className={`flex-1 flex items-center justify-between px-3 py-2.5 border rounded-[10px] text-[13px] font-bold bg-white transition-all ${csvExportDate ? "border-black text-black" : "border-black/10 text-black/40"}`}
                >
                  <span>
                    {csvExportDate
                      ? new Date(
                          csvExportDate + "T00:00:00",
                        ).toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "ทั้งหมด (ไม่กรองวัน)"}
                  </span>
                  <span className="text-black/30 text-xs">
                    {csvCalendarOpen ? (
                      <IoIosArrowUp size={24} />
                    ) : (
                      <IoIosArrowDown size={24} />
                    )}
                  </span>
                </button>
                {csvExportDate && (
                  <button
                    onClick={() => {
                      setCsvExportDate("");
                      setCsvCalendarOpen(false);
                    }}
                    className="flex items-center justify-center p-2.5 border border-black/10 rounded-[10px] bg-white transition-all"
                  >
                    <RxCross2 className="text-gray-400" size={24} />
                  </button>
                )}
                {csvCalendarOpen && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-black/10 rounded-[14px] shadow-lg z-50 p-3">
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() =>
                          setCsvCalendarMonth(
                            (m) =>
                              new Date(m.getFullYear(), m.getMonth() - 1, 1),
                          )
                        }
                        className="p-1.5 rounded-[7px] hover:bg-black/5 text-black/50 font-bold text-sm"
                      >
                        <IoIosArrowBack size={16} />
                      </button>
                      <span className="text-[13px] font-bold text-black">
                        {csvCalendarMonth.toLocaleDateString("th-TH", {
                          year: "numeric",
                          month: "long",
                        })}
                      </span>
                      <button
                        onClick={() =>
                          setCsvCalendarMonth(
                            (m) =>
                              new Date(m.getFullYear(), m.getMonth() + 1, 1),
                          )
                        }
                        className="p-1.5 rounded-[7px] hover:bg-black/5 text-black/50 font-bold text-sm"
                      >
                        <IoIosArrowForward size={16} />
                      </button>
                    </div>
                    <div className="grid grid-cols-7 mb-1">
                      {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => (
                        <div
                          key={d}
                          className="text-center text-[11px] text-black/30 font-bold py-1"
                        >
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-y-0.5">
                      {csvCalendarDays.map((dateStr, i) => {
                        if (!dateStr) return <div key={`empty-${i}`} />;
                        const hasData = activeDates.has(dateStr);
                        const isSelected = csvExportDate === dateStr;
                        const day = parseInt(dateStr.split("-")[2]);
                        return (
                          <button
                            key={dateStr}
                            disabled={!hasData}
                            onClick={() => {
                              setCsvExportDate(dateStr);
                              setCsvCalendarOpen(false);
                            }}
                            className={`relative flex flex-col items-center justify-center py-1.5 rounded-[7px] text-[13px] font-bold transition-all ${isSelected ? "bg-black text-white" : hasData ? "text-black hover:bg-black/5 active:scale-95" : "text-black/15 cursor-default"}`}
                          >
                            {day}
                            {hasData && !isSelected && (
                              <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-black/30" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleExport}
              disabled={isExporting || selectedCsvModes.length === 0}
              className="w-full py-3 rounded-[10px] bg-black text-white font-bold text-[16px] flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {isExporting ? (
                <>
                  <FiDownload size={18} />
                  กำลังสร้างไฟล์...
                </>
              ) : (
                <>
                  <FiDownload size={16} />
                  ดาวน์โหลด CSV
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {selectedStoreId && (
        <LocationDetailPopup
          title={storeMap[selectedStoreId] ?? selectedStoreId}
          subtitle="ส่งล่าสุดโดย"
          subtitleValue={storeLastSender}
          loadingSubtitle={loadingStoreSender || loadingStoreVRIds}
          good={storeGood}
          minor={storeMinor}
          major={storeMajor}
          borrowed={storeBorrowed}
          total={selectedStoreDevices.length}
          devices={loadingStoreVRIds ? [] : selectedStoreDevices}
          onClose={() => setSelectedStoreId(null)}
        />
      )}

      {selectedTruckId && (
        <LocationDetailPopup
          title={truckMap[selectedTruckId] ?? selectedTruckId}
          subtitle="คนขับล่าสุด"
          subtitleValue={truckDriver}
          loadingSubtitle={loadingDriver || loadingTruckVRIds}
          good={truckGood}
          minor={truckMinor}
          major={truckMajor}
          borrowed={truckBorrowed}
          total={selectedTruckDevices.length}
          devices={loadingTruckVRIds ? [] : selectedTruckDevices}
          onClose={() => setSelectedTruckId(null)}
        />
      )}

      {selectedVR && (
        <div
          key={`edit-vr-modal-${selectedVR.id}`}
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-99"
        >
          <div className="relative bg-white text-[18px] lg:w-[35%] w-[85%] lg:h-[85%] h-[70%] rounded-[10px] p-6 shadow-xl flex flex-col justify-between items-center">
            <div className="w-full">
              <h2 className="text-[24px] font-bold">แก้ไขสถานะอุปกรณ์ VR</h2>
              <p className="text-[16px] text-black/50 mb-1">
                รหัสอุปกรณ์ VR: <span className="font-bold">{selectedVR.id}</span>
              </p>

              <button
                disabled={photoBusy}
                onClick={() => setSelectedVR(null)}
                className="absolute top-3 right-3 border border-black/10 rounded-full p-2"
              >
                <RxCross2 size={18} />
              </button>
            </div>

            <div className="w-full h-full overflow-y-auto">
              <VRPhotos key={selectedVR.id} deviceId={selectedVR.id} photos={selectedVR.photos} onBusyChange={setPhotoBusy} onAdded={(photo) => {
                const append = (item: IVR): IVR => ({ ...item, photos: [...(item.photos ?? []).filter(p => p.publicId !== photo.publicId), photo] });
                setSelectedVR(prev => prev ? append(prev) : prev);
                setDevices(prev => prev.map(item => item.id === selectedVR.id ? append(item) : item));
              }} />
              <div className="mb-4 p-3 rounded-[10px] bg-black/3 flex flex-col gap-1">
                <p className="text-[16px] text-black/60">
                  <span className="font-bold">สถานที่:</span>{" "}
                  {LOCATION_LABEL[selectedVR.locationType]} —{" "}
                  {getLocationName(
                    selectedVR.locationType,
                    selectedVR.locationId,
                  )}
                </p>
                <p className="text-[16px] text-black/60">
                  <span className="font-bold">อัปเดต:</span>{" "}
                  {selectedVR.updatedAt
                    ? selectedVR.updatedAt.toDate().toLocaleString("th-TH", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "-"}
                </p>
                <p className="text-[16px] text-black/60">
                  <span className="font-bold">ส่งล่าสุดโดย:</span>{" "}
                  {userMap[lastEditorMap[selectedVR.id] ?? ""] ?? "-"}
                </p>
                {selectedVR.status === "borrowed" && selectedVR.statusSource === "admin" && <p className="text-sm font-semibold text-red-700">สถานะยืมนี้ตั้งโดยแอดมิน ไม่ได้มาจากคำขอสแกนของผู้ใช้ · ผู้ถือ {selectedVR.adminBorrowerName ?? "ไม่ระบุผู้ยืม"}</p>}
              </div>

              <div className="flex flex-col gap-2 mb-6">
                <button
                  onClick={() => setNewStatus("good")}
                  className={`p-2 rounded-xl border ${newStatus === "good" ? "bg-emerald-100 border-emerald-400" : "border-black/10"}`}
                >
                  ปกติ
                </button>
                <button
                  onClick={() => setNewStatus("damaged")}
                  className={`p-2 rounded-xl border ${newStatus === "damaged" ? "bg-gray-200 border-gray-400" : "border-black/10"}`}
                >
                  ชำรุด
                </button>
                <button
                  onClick={() => setNewStatus("borrowed")}
                  className={`p-2 rounded-xl border ${newStatus === "borrowed" ? "bg-red-100 border-red-400" : "border-black/10"}`}
                >
                  ยืม (กำหนดโดยแอดมิน)
                </button>
                {newStatus === "borrowed" && <label className="text-sm font-semibold">ผู้ถือ VR (ไม่จำเป็น)
                  <select value={manualBorrowerId} onChange={e => setManualBorrowerId(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5"><option value="">ไม่ระบุผู้ยืม</option>{Object.entries(userMap).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
                </label>}
              </div>

              <div className="flex justify-center items-center w-full gap-3 mt-3">
                <button
                  onClick={handleDeleteVR}
                  disabled={isDeleting || isSaving || photoBusy}
                  className="px-4 py-2 w-full rounded-xl bg-red-500 text-white disabled:opacity-50"
                >
                  {isDeleting ? "กำลังลบ..." : "ลบอุปกรณ์ VR"}
                </button>
                {(newStatus !== (selectedVR.status === "good" ? "good" : selectedVR.status === "borrowed" ? "borrowed" : "damaged") || (newStatus === "borrowed" && manualBorrowerId !== (selectedVR.adminBorrowerId ?? ""))) && <button
                  onClick={handleSaveStatus}
                  disabled={photoBusy || isSaving}
                  className="px-4 py-2 w-full rounded-xl bg-black text-white disabled:opacity-50"
                >
                  {isSaving ? "กำลังบันทึก..." : "บันทึก"}
                </button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="mx-auto fixed inset-0 bg-black/40 flex items-center justify-center z-99">
          <div className="bg-white lg:w-[35%] w-[85%] lg:h-[85%] h-[70%] rounded-[10px] p-6 flex flex-col gap-4 shadow-xl max-h-[90svh]">
            <div className="flex items-center justify-between">
              <h2 className="text-[20px] font-bold">เพิ่มอุปกรณ์ VR</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddLocationId("");
                  setStoreSearch("");
                }}
                className="border border-black/10 rounded-full p-2"
              >
                <RxCross2 size={18} />
              </button>
            </div>

            <div className="overflow-y-auto">
              <div className="flex flex-col gap-1.5">
                <p className="text-[13px] font-bold text-black/40">สถานะ</p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setAddStatus("good")}
                    className={`p-3 rounded-[10px] border text-left font-bold text-[15px] transition-all ${addStatus === "good" ? "bg-emerald-100 border-emerald-400" : "border-black/10 text-black"}`}
                  >
                    {STATUS_LABEL["good"]}
                  </button>
                  <button
                    onClick={() => setAddStatus("damaged")}
                    className={`p-3 rounded-[10px] border text-left font-bold text-[15px] transition-all ${addStatus === "damaged" ? "bg-gray-200 border-gray-400" : "border-black/10 text-black"}`}
                  >
                    {STATUS_LABEL["damaged"]}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-[13px] font-bold text-black/40 mt-2">
                  สถานที่
                </p>
                <div className="flex flex-col gap-2">
                  {(["warehouse", "store", "truck"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleChangeLocationType(type)}
                      className={`p-3 rounded-[10px] border text-left font-bold text-[15px] transition-all ${addLocationType === type ? "border-black bg-black text-white" : "border-black/10 text-black"}`}
                    >
                      {LOCATION_LABEL[type]}
                    </button>
                  ))}
                </div>
              </div>

              {addLocationType === "store" && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[13px] font-bold text-black/40 mt-2">
                    ร้าน
                  </p>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="ค้นหาร้าน..."
                      value={storeSearch}
                      onChange={(e) => {
                        setStoreSearch(e.target.value);
                        setShowStoreSuggest(true);
                      }}
                      onFocus={() => {
                        if (storeSearch.trim()) setShowStoreSuggest(true);
                      }}
                      onBlur={() =>
                        setTimeout(() => setShowStoreSuggest(false), 150)
                      }
                      className="w-full px-4 py-3 text-[15px] pl-10 border border-black/10 rounded-[10px] focus:outline-none"
                    />
                    <IoIosSearch
                      size={20}
                      className="absolute top-1/2 -translate-y-1/2 left-3 text-black/30"
                    />

                    {showStoreSuggest && storeSearch.trim() && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-black/10 rounded-[10px] shadow-lg max-h-48 overflow-y-auto z-50">
                        {filteredAddStores.length > 0 ? (
                          filteredAddStores.map((store) => (
                            <div
                              key={store.id}
                              onMouseDown={() => {
                                setAddLocationId(store.id);
                                setStoreSearch("");
                                setShowStoreSuggest(false);
                              }}
                              className="px-4 py-3 text-[15px] font-bold active:bg-black/5 cursor-pointer flex justify-between items-center"
                            >
                              <span>{store.name}</span>
                              {nearestAddStoreId === store.id && (
                                <span className="text-[12px] bg-black text-white px-2 py-0.5 rounded-[7px]">
                                  ใกล้ที่สุด
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-black/30 text-[14px]">
                            ไม่พบร้าน
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {addLocationId && (
                    <div className="flex flex-col gap-1.5 mt-1">
                      <p className="text-[13px] font-bold text-black/40">
                        ที่เลือกอยู่
                      </p>
                      <button
                        onClick={() => setAddLocationId("")}
                        className="text-[15px] w-full text-left px-4 py-3 rounded-[10px] font-bold bg-black text-white flex justify-between items-center"
                      >
                        <span>{storeMap[addLocationId]}</span>
                        {nearestAddStoreId === addLocationId && (
                          <span className="text-[14px] bg-white text-black px-2 py-1.5 rounded-[7px]">
                            ใกล้ที่สุด
                          </span>
                        )}
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 mt-1">
                    <p className="text-[13px] font-bold text-black/40">
                      {nearestAddStoreId ? "ร้านใกล้คุณ" : "รายการร้าน"}
                    </p>
                    <div className="flex flex-col gap-2">
                      {displayAddStores
                        .filter((store) => store.id !== addLocationId)
                        .slice(0, 5)
                        .map((store) => {
                          const isNearest = nearestAddStoreId === store.id;
                          return (
                            <button
                              key={store.id}
                              onClick={() => setAddLocationId(store.id)}
                              className="text-[15px] w-full text-left px-4 py-3 rounded-[10px] font-bold bg-gray-100 text-black flex justify-between items-center"
                            >
                              <span>{store.name}</span>
                              {isNearest && (
                                <span className="text-[14px] bg-black text-white px-2 py-1.5 rounded-[7px]">
                                  ใกล้ที่สุด
                                </span>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}

              {addLocationType === "truck" && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[13px] font-bold text-black/40 mt-1">รถ</p>
                  <div className="flex flex-col gap-2">
                    {Object.entries(truckMap).map(([id, name]) => (
                      <button
                        key={id}
                        onClick={() => setAddLocationId(id)}
                        className={`p-3 rounded-[10px] border text-left font-bold text-[15px] transition-all ${addLocationId === id ? "border-black bg-black text-white" : "border-black/10 text-black"}`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleAddVR}
                disabled={isAdding || !addLocationId}
                className="w-full py-3 rounded-[10px] mt-5 bg-black text-white font-bold text-[16px] disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {isAdding ? "กำลังเพิ่ม..." : "เพิ่มอุปกรณ์ VR"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
