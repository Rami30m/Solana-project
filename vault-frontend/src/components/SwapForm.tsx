import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { api } from "../api/client";

function base64ToUint8Array(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

type Direction = "SOL" | "TOKEN";

export function SwapForm() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [direction, setDirection] = useState<Direction>("SOL");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("1");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const fromLabel = direction === "SOL" ? "SOL" : "MyToken";
  const toLabel = direction === "SOL" ? "MyToken" : "SOL";

  const toggleDirection = () => {
    setDirection((d) => (d === "SOL" ? "TOKEN" : "SOL"));
    setAmount("");
    setStatus("idle");
    setMessage("");
  };

  const handleSwap = async () => {
    if (!publicKey || !amount) return;
    setStatus("loading");
    setMessage("");
    try {
      const { transaction } = await api.buildSwap(
        publicKey.toBase58(),
        direction,
        parseFloat(amount),
        parseFloat(slippage) / 100
      );

      const tx = Transaction.from(base64ToUint8Array(transaction));
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      setStatus("success");
      setMessage(sig);
    } catch (e: any) {
      setStatus("error");
      const logs = e?.logs?.join("\n");
      setMessage(logs ? `${e.message}\n\nLogs:\n${logs}` : (e.message ?? String(e)));
    }
  };

  return (
    <div>
      <h3 style={{ color: "#e8e8f0", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem" }}>
        Своп
      </h3>

      {/* Direction toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <span style={{
          background: "#0e0e1a",
          border: "1px solid #1e1e32",
          borderRadius: "0.4rem",
          padding: "0.25rem 0.6rem",
          color: "#39ff14",
          fontSize: "0.8rem",
          fontWeight: 600,
          minWidth: "70px",
          textAlign: "center",
        }}>
          {fromLabel}
        </span>

        <button
          onClick={toggleDirection}
          style={{
            background: "none",
            border: "1px solid #1e1e32",
            borderRadius: "0.4rem",
            color: "#7a7a9a",
            padding: "0.25rem 0.5rem",
            cursor: "pointer",
            fontSize: "0.9rem",
            transition: "color 0.2s",
          }}
          title="Поменять направление"
        >
          ⇄
        </button>

        <span style={{
          background: "#0e0e1a",
          border: "1px solid #1e1e32",
          borderRadius: "0.4rem",
          padding: "0.25rem 0.6rem",
          color: "#00d4ff",
          fontSize: "0.8rem",
          fontWeight: 600,
          minWidth: "70px",
          textAlign: "center",
        }}>
          {toLabel}
        </span>
      </div>

      {/* Amount input */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <input
          type="number"
          placeholder={`Количество ${fromLabel}`}
          value={amount}
          min="0"
          step="any"
          onChange={(e) => setAmount(e.target.value)}
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
          onClick={handleSwap}
          disabled={!publicKey || !amount || status === "loading"}
          style={{
            background: "transparent",
            border: "1px solid #a855f7",
            borderRadius: "0.5rem",
            color: "#a855f7",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            cursor: publicKey && amount ? "pointer" : "not-allowed",
            opacity: publicKey && amount ? 1 : 0.4,
            transition: "all 0.2s",
            whiteSpace: "nowrap",
          }}
        >
          {status === "loading" ? "Отправка…" : "Обменять"}
        </button>
      </div>

      {/* Slippage */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ color: "#4a4a6a", fontSize: "0.72rem" }}>Проскальзывание:</span>
        {["0.5", "1", "3"].map((v) => (
          <button
            key={v}
            onClick={() => setSlippage(v)}
            style={{
              background: slippage === v ? "rgba(168,85,247,0.15)" : "none",
              border: `1px solid ${slippage === v ? "#a855f7" : "#1e1e32"}`,
              borderRadius: "0.3rem",
              color: slippage === v ? "#a855f7" : "#4a4a6a",
              padding: "0.1rem 0.4rem",
              fontSize: "0.7rem",
              cursor: "pointer",
            }}
          >
            {v}%
          </button>
        ))}
      </div>

      {status === "success" && (
        <p style={{ color: "#39ff14", fontSize: "0.7rem", marginTop: "0.5rem", wordBreak: "break-all" }}>
          ✓ Своп выполнен — {message}
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
          Подключите кошелёк для свопа
        </p>
      )}
    </div>
  );
}
