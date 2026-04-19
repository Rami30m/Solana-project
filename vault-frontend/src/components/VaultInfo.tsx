import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { VaultInfo as TVaultInfo } from "../api/client";
import { StatCard } from "./StatCard";

export function VaultInfo() {
  const [info, setInfo] = useState<TVaultInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setInfo(await api.getVaultInfo());
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
          Состояние vault
        </h2>
        <button onClick={load} style={{ color: "#7a7a9a", fontSize: "0.75rem", background: "none", border: "none", cursor: "pointer" }}>
          ↻ обновить
        </button>
      </div>

      {loading && <p style={{ color: "#4a4a6a", fontSize: "0.875rem" }}>Загрузка...</p>}
      {error && <p style={{ color: "#ff4455", fontSize: "0.875rem" }}>Ошибка: {error}</p>}

      {info && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Статус"
            value={info.initialized ? "Активен" : "Не инициализирован"}
            glow={info.initialized}
          />
          <StatCard
            label="Токены в vault"
            value={info.tokenBalance?.uiAmount?.toFixed(4) ?? "0"}
            sub={`${info.tokenBalance?.decimals ?? 6} decimals`}
          />
          <StatCard
            label="Всего долей"
            value={info.totalShares ?? "0"}
          />
          <StatCard
            label="Vault PDA"
            value={info.vaultStatePDA ? info.vaultStatePDA.slice(0, 8) + "…" : "—"}
            sub={info.vaultStatePDA}
          />
        </div>
      )}
    </section>
  );
}
