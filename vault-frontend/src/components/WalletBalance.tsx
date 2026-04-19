import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "../api/client";
import type { WalletBalance as TWalletBalance } from "../api/client";
import { StatCard } from "./StatCard";


export function WalletBalance() {
  const { publicKey } = useWallet();
  const [balance, setBalance] = useState<TWalletBalance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mintStatus, setMintStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [mintMsg, setMintMsg] = useState("");

  const load = async () => {
    if (!publicKey) return;
    setLoading(true);
    setError(null);
    try {
      setBalance(await api.getWalletBalance(publicKey.toBase58()));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMint = async () => {
    if (!publicKey) return;
    setMintStatus("loading");
    setMintMsg("");
    try {
      const res = await api.adminMintTokens(publicKey.toBase58(), 100);
      setMintStatus("success");
      setMintMsg(`+100 MyToken зачислено`);
      setTimeout(load, 2000);
    } catch (e: any) {
      setMintStatus("error");
      setMintMsg(e.message);
    }
  };

  useEffect(() => { load(); }, [publicKey]);

  if (!publicKey) {
    return (
      <section>
        <h2 style={{ color: "#e8e8f0", fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>
          Ваши балансы
        </h2>
        <p style={{ color: "#4a4a6a", fontSize: "0.875rem" }}>Подключите кошелёк для просмотра балансов</p>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ color: "#e8e8f0", fontSize: "1rem", fontWeight: 600, margin: 0 }}>
          Ваши балансы
        </h2>
        <button onClick={load} style={{ color: "#7a7a9a", fontSize: "0.75rem", background: "none", border: "none", cursor: "pointer" }}>
          ↻ обновить
        </button>
      </div>

      <p style={{ color: "#4a4a6a", fontSize: "0.7rem", fontFamily: "monospace", marginBottom: "0.75rem", wordBreak: "break-all" }}>
        {publicKey.toBase58()}
      </p>

      {loading && <p style={{ color: "#4a4a6a", fontSize: "0.875rem" }}>Загрузка...</p>}
      {error && <p style={{ color: "#ff4455", fontSize: "0.875rem" }}>Ошибка: {error}</p>}

      {balance && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="SOL" value={balance.solBalance.toFixed(4)} glow />
            <StatCard
              label="MyToken"
              value={balance.tokenBalance?.uiAmount?.toFixed(4) ?? "0"}
            />
            <StatCard
              label="Доли (Shares)"
              value={balance.shareBalance?.uiAmount?.toFixed(4) ?? "0"}
            />
          </div>

          {/* Кнопка получить тестовые токены */}
          <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              onClick={handleMint}
              disabled={mintStatus === "loading"}
              style={{
                background: "transparent",
                border: "1px solid #1e1e32",
                borderRadius: "0.4rem",
                color: "#4a4a6a",
                padding: "0.3rem 0.75rem",
                fontSize: "0.72rem",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {mintStatus === "loading" ? "Минтим…" : "+ Получить 100 MyToken (devnet)"}
            </button>
            {mintStatus === "success" && (
              <span style={{ color: "#39ff14", fontSize: "0.7rem" }}>✓ {mintMsg}</span>
            )}
            {mintStatus === "error" && (
              <span style={{ color: "#ff4455", fontSize: "0.7rem" }}>✗ {mintMsg}</span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
