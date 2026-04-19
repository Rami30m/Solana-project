import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { api } from "../api/client";

function base64ToUint8Array(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export function WithdrawForm() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [shares, setShares] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleWithdraw = async () => {
    if (!publicKey || !shares) return;
    setStatus("loading");
    setMessage("");
    try {
      const sharesRaw = Math.floor(parseFloat(shares) * 1e6);
      const { transaction } = await api.buildWithdraw(publicKey.toBase58(), sharesRaw);

      const tx = Transaction.from(base64ToUint8Array(transaction));
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      setStatus("success");
      setMessage(`TX: ${sig}`);
    } catch (e: any) {
      setStatus("error");
      const logs = e?.logs?.join("\n");
      setMessage(logs ? `${e.message}\n\nLogs:\n${logs}` : (e.message ?? String(e)));
    }
  };

  return (
    <div>
      <h3 style={{ color: "#e8e8f0", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem" }}>
        Вывод
      </h3>
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Количество долей (Shares)"
          value={shares}
          min="0"
          step="any"
          onChange={(e) => setShares(e.target.value)}
          disabled={!publicKey || status === "loading"}
          style={{
            flex: 1,
            background: "#0e0e1a",
            border: "1px solid #1e1e32",
            borderRadius: "0.5rem",
            padding: "0.5rem 0.75rem",
            color: "#e8e8f0",
            fontSize: "0.875rem",
            outline: "none",
          }}
        />
        <button
          onClick={handleWithdraw}
          disabled={!publicKey || !shares || status === "loading"}
          style={{
            background: "transparent",
            border: "1px solid #00d4ff",
            borderRadius: "0.5rem",
            color: "#00d4ff",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            cursor: publicKey && shares ? "pointer" : "not-allowed",
            opacity: publicKey && shares ? 1 : 0.4,
            transition: "all 0.2s",
            whiteSpace: "nowrap",
          }}
        >
          {status === "loading" ? "Отправка…" : "Вывести"}
        </button>
      </div>

      {status === "success" && (
        <p style={{ color: "#39ff14", fontSize: "0.75rem", marginTop: "0.5rem", wordBreak: "break-all" }}>
          ✓ Успешно — {message}
        </p>
      )}
      {status === "error" && (
        <pre style={{
          color: "#ff4455", fontSize: "0.7rem", marginTop: "0.5rem",
          whiteSpace: "pre-wrap", wordBreak: "break-all",
          maxHeight: "120px", overflowY: "auto",
          background: "rgba(255,68,85,0.06)", borderRadius: "0.4rem", padding: "0.5rem",
        }}>
          ✗ {message}
        </pre>
      )}
      {!publicKey && (
        <p style={{ color: "#4a4a6a", fontSize: "0.75rem", marginTop: "0.5rem" }}>
          Подключите кошелёк для вывода
        </p>
      )}
    </div>
  );
}
