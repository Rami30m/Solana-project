import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { PoolInfo as TPoolInfo } from "../api/client";
import { StatCard } from "./StatCard";

export function PoolInfo() {
  const [info, setInfo] = useState<TPoolInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setInfo(await api.getPoolInfo());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ color: "#e8e8f0", fontSize: "1rem", fontWeight: 600, margin: 0 }}>
          Пул Raydium
        </h2>
        <button onClick={load} style={{ color: "#7a7a9a", fontSize: "0.75rem", background: "none", border: "none", cursor: "pointer" }}>
          ↻ обновить
        </button>
      </div>

      {loading && <p style={{ color: "#4a4a6a", fontSize: "0.875rem" }}>Загрузка...</p>}
      {error && <p style={{ color: "#ff4455", fontSize: "0.875rem" }}>Ошибка: {error}</p>}

      {info && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Текущая цена" value={Number(info.price).toFixed(6)} glow />
          <StatCard label="Текущий тик" value={info.tickCurrent} />
          <StatCard label="Шаг тика" value={info.tickSpacing} />
          <StatCard
            label="ID пула"
            value={info.poolId.slice(0, 8) + "…"}
            sub={info.poolId}
          />
        </div>
      )}
    </section>
  );
}
