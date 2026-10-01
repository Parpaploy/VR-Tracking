import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ITruck } from "../interfaces/data.interface";
import { fetchTrucks } from "../lib/truck.services";

export default function TruckPage() {
  const navigate = useNavigate();

  const [trucks, setTrucks] = useState<ITruck[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTruckId, setSelectedTruckId] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchTrucks();
        setTrucks(data);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <main className="w-full h-full p-4 flex flex-col justify-between items-center bg-white">
      <div className="w-full h-full flex flex-col gap-3">
        <h2 className="text-[24px] font-bold">เลือกรถ</h2>

        {loading ? (
          <div className="flex justify-center items-center w-full h-full text-gray-500">
            <div className="w-18 h-18 border-6 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {trucks.map((truck) => {
              const isActive = selectedTruckId === truck.id;

              return (
                <li key={truck.id} style={{ marginBottom: 10 }}>
                  <button
                    onClick={() => setSelectedTruckId(truck.id)}
                    className={`w-full text-left px-4 py-3 rounded-[10px] transition flex justify-between items-center ${isActive ? "bg-black text-white" : "bg-gray-100"}`}
                  >
                    {truck.name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        onClick={() => navigate(`/private/truck/${selectedTruckId}`)}
        disabled={!selectedTruckId}
        className="w-full py-3 rounded-xl bg-black text-white disabled:opacity-50 transition"
      >
        ถัดไป
      </button>
    </main>
  );
}
