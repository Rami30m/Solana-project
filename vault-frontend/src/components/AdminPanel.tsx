import { useState } from "react";
import { api } from "../api/client";

export function AdminPanel() {
  const [initStatus, setInitStatus] = useState("");
  const [posStatus, setPosStatus] = useState("");
  const [loadingInit, setLoadingInit] = useState(false);
  const [loadingPos, setLoadingPos] = useState(false);

  const handleInit = async () => {
    setLoadingInit(true);
    setInitStatus("");
    try {
      const res = await api.adminInitialize();
      setInitStatus(
        res.status === "already_initialized"
          ? "Уже инициализирован"
          : `✓ Инициализирован — ${res.tx}`
      );
    } catch (e: any) {
      setInitStatus(`✗ ${e.message}`);
    } finally {
      setLoadingInit(false);
    }
  };

  const handleOpenPosition = async () => {
    setLoadingPos(true);
    setPosStatus("");
    try {
      const res = await api.adminOpenPosition();
      setPosStatus(`✓ Позиция открыта — ${res.tx}`);
    } catch (e: any) {
      setPosStatus(`✗ ${e.message}`);
    } finally {
      setLoadingPos(false);
    }
  };

  return (
    <section>
      <h2 style={{ color: "#e8e8f0", fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>
        Администратор
      </h2>

      <div className="flex flex-col gap-4">
        <div>
          <button
            onClick={handleInit}
            disabled={loadingInit}
            style={{
              background: "transparent",
              border: "1px solid #4a4a6a",
              borderRadius: "0.5rem",
              color: "#7a7a9a",
              padding: "0.5rem 1rem",
              fontSize: "0.8rem",
              cursor: "pointer",
              transition: "all 0.2s",
              width: "100%",
            }}
          >
            {loadingInit ? "Инициализация…" : "Инициализировать Vault"}
          </button>
          {initStatus && (
            <p
              style={{
                fontSize: "0.7rem",
                marginTop: "0.4rem",
                wordBreak: "break-all",
                color: initStatus.startsWith("✓") ? "#39ff14" : initStatus.startsWith("✗") ? "#ff4455" : "#7a7a9a",
              }}
            >
              {initStatus}
            </p>
          )}
        </div>

        <div>
          <button
            onClick={handleOpenPosition}
            disabled={loadingPos}
            style={{
              background: "transparent",
              border: "1px solid #4a4a6a",
              borderRadius: "0.5rem",
              color: "#7a7a9a",
              padding: "0.5rem 1rem",
              fontSize: "0.8rem",
              cursor: "pointer",
              transition: "all 0.2s",
              width: "100%",
            }}
          >
            {loadingPos ? "Открытие позиции…" : "Открыть позицию Raydium"}
          </button>
          {posStatus && (
            <p
              style={{
                fontSize: "0.7rem",
                marginTop: "0.4rem",
                wordBreak: "break-all",
                color: posStatus.startsWith("✓") ? "#39ff14" : "#ff4455",
              }}
            >
              {posStatus}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
