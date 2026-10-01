import { useEffect, useMemo, useState } from "react";
import { getDistance } from "../functions/location.func";
import { fetchStores } from "../lib/store.services";
import { useNavigate } from "react-router-dom";
import type { ILocation, IStore } from "../interfaces/data.interface";
import { IoIosSearch } from "react-icons/io";

export default function StorePage() {
  const navigate = useNavigate();

  const [stores, setStores] = useState<IStore[]>([]);
  const [loadingStores, setLoadingStores] = useState<boolean>(true);
  const [userLocation, setUserLocation] = useState<ILocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [showSuggest, setShowSuggest] = useState<boolean>(false);

  const isGeolocationSupported =
    typeof navigator !== "undefined" && !!navigator.geolocation;

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchStores();
        setStores(data);
      } finally {
        setLoadingStores(false);
      }
    };
    load();
  }, []);

  const nearestStores = useMemo(() => {
    if (!userLocation) return stores;
    return [...stores].sort((a, b) => {
      const distA = getDistance(
        userLocation.lat,
        userLocation.lng,
        a.latitude,
        a.longitude,
      );
      const distB = getDistance(
        userLocation.lat,
        userLocation.lng,
        b.latitude,
        b.longitude,
      );
      return distA - distB;
    });
  }, [stores, userLocation]);

  useEffect(() => {
    if (!isGeolocationSupported) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationError(null);
      },
      () => {
        setLocationError("ไม่สามารถดึงตำแหน่งได้ หรือผู้ใช้ไม่อนุญาต");
      },
      { enableHighAccuracy: true },
    );
    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isGeolocationSupported]);

  const nearestStoreId = useMemo(() => {
    if (!userLocation || stores.length === 0) return "";
    let nearest = stores[0];
    let minDistance = Infinity;
    for (const store of stores) {
      const distance = getDistance(
        userLocation.lat,
        userLocation.lng,
        store.latitude,
        store.longitude,
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearest = store;
      }
    }
    return nearest.id;
  }, [userLocation, stores]);

  const activeStoreId = selectedStoreId || nearestStoreId;

  const filteredStores = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const result = stores
      .map((store) => {
        const name = store.name.toLowerCase();
        let score = 0;
        if (name.startsWith(keyword)) score = 3;
        else if (name.includes(keyword)) score = 2;
        else score = 1;
        let distance = 0;
        if (userLocation) {
          distance = getDistance(
            userLocation.lat,
            userLocation.lng,
            store.latitude,
            store.longitude,
          );
        }
        return { ...store, score, distance };
      })
      .filter((store) =>
        keyword ? store.name.toLowerCase().includes(keyword) : true,
      )
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.distance - b.distance;
      });
    return result;
  }, [search, userLocation, stores]);

  return (
    <main className="w-full h-full p-4 flex flex-col justify-between items-center bg-white">
      <div className="w-full h-full flex flex-col gap-3">
        <h2 className="text-[24px] font-bold">เลือกร้าน</h2>

        {locationError && <p className="text-red-500 mb-2">{locationError}</p>}

        {!userLocation && !locationError && (
          <p className="text-gray-500 mb-2">กำลังค้นหาตำแหน่งของคุณ...</p>
        )}

        {loadingStores ? (
          <div className="flex justify-center items-center w-full h-full text-gray-500">
            <div className="w-18 h-18 border-6 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="relative">
            <div className="w-full relative">
              <input
                type="text"
                placeholder="ค้นหาร้าน..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowSuggest(true);
                  setSelectedStoreId("");
                }}
                onFocus={() => {
                  if (search.trim()) setShowSuggest(true);
                }}
                onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                className="w-full px-4 py-3 text-[18px] pr-10 pl-12 border border-gray-300 rounded-full focus:outline-none focus:ring-0 focus:ring-transparent"
              />
              <div className="absolute top-1/2 -translate-y-1/2 left-3">
                <IoIosSearch size={28} />
              </div>
            </div>

            <div className="mt-4">
              {selectedStoreId && (
                <div className="flex flex-col gap-1.5 mb-3">
                  <p className="text-[18px] font-semibold">ที่เลือกอยู่</p>
                  <button
                    onClick={() => {
                      setSelectedStoreId("");
                      setSearch("");
                    }}
                    className="text-[18px] w-full text-left px-4 py-3 rounded-[10px] bg-black text-white flex justify-between items-center"
                  >
                    <span>
                      {stores.find((s) => s.id === selectedStoreId)?.name}
                    </span>
                    {nearestStoreId === selectedStoreId && (
                      <span className="text-[14px] bg-white text-black px-2 py-1.5 rounded-[7px]">
                        ใกล้ที่สุด
                      </span>
                    )}
                  </button>
                </div>
              )}

              <h3 className="text-[18px] font-semibold mb-2">ร้านใกล้คุณ</h3>

              <div className="flex flex-col gap-2">
                {nearestStores
                  .filter((store) => store.id !== selectedStoreId)
                  .slice(0, 5)
                  .map((store) => {
                    const isNearest = nearestStoreId === store.id;
                    return (
                      <button
                        key={store.id}
                        onClick={() => {
                          setSelectedStoreId(store.id);
                          // setSearch(store.name);
                        }}
                        className="text-[18px] w-full text-left px-4 py-3 rounded-[10px] transition flex justify-between items-center bg-gray-100"
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

            {showSuggest && (
              <div
                className={`text-[18px] absolute top-13 left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto z-20 transition-all duration-200 ease-out
                  ${showSuggest ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"}`}
              >
                {filteredStores.length > 0 ? (
                  filteredStores.slice(0, 8).map((store) => {
                    const isNearest = nearestStoreId === store.id;
                    return (
                      <div
                        key={store.id}
                        onMouseDown={() => {
                          setSearch("");
                          setSelectedStoreId(store.id);
                          setShowSuggest(false);
                        }}
                        className="px-4 py-3 transition flex justify-between items-center"
                      >
                        <span>{store.name}</span>
                        {isNearest && (
                          <span className="text-[14px] bg-black rounded-[10px] py-1 px-2 text-white">
                            ใกล้ที่สุด
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="px-4 py-3 text-gray-400">ไม่พบร้าน</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <button
        disabled={!selectedStoreId || !activeStoreId}
        onClick={() => navigate(`/private/store/${selectedStoreId}`)}
        className="w-full py-3 rounded-xl bg-black text-white disabled:opacity-50 transition"
      >
        ถัดไป
      </button>
    </main>
  );
}
