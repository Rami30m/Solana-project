import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { api } from "../api/client";

function base64ToUint8Array(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

export function DepositForm() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleDeposit = async () => {
    if (!publicKey || !amount) return;
    setStatus("loading");
    setMessage("");
    try {
      const amountRaw = Math.floor(parseFloat(amount) * 1e6);

      console.log("[Deposit] amountRaw:", amountRaw);
      console.log("[Deposit] wallet:", publicKey.toBase58());

      const buildRes = await api.buildDeposit(publicKey.toBase58(), amountRaw);
      console.log("[Deposit] buildRes:", buildRes);

      const tx = Transaction.from(base64ToUint8Array(buildRes.transaction));
      console.log("[Deposit] tx instructions count:", tx.instructions.length);

      // Симулируем транзакцию перед отправкой — получаем program logs
      const sim = await connection.simulateTransaction(tx);
      console.log("[Deposit] simulation:", JSON.stringify(sim.value, null, 2));

      if (sim.value.err) {
        const simLogs = sim.value.logs?.join("\n") ?? "no logs";
        throw new Error(`Simulation failed: ${JSON.stringify(sim.value.err)}\n\nLogs:\n${simLogs}`);
      }

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      setStatus("success");
      setMessage(`TX: ${sig}`);
    } catch (e: any) {
      console.error("[Deposit] full error:", e);
      // WalletSendTransactionError wraps the real cause
      const cause = e?.cause ?? e?.error ?? e;
      const logs = cause?.logs?.join?.("\n") ?? e?.logs?.join?.("\n");
      const msg = cause?.message ?? e?.message ?? String(e);
      setStatus("error");
      setMessage(logs ? `${msg}\n\nLogs:\n${logs}` : msg);
    }
  };

  return (
    <div>
      <h3 style={{ color: "#e8e8f0", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem" }}>
        Депозит
      </h3>
      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Количество (MyToken)"
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
          onClick={handleDeposit}
          disabled={!publicKey || !amount || status === "loading"}
          style={{
            background: "transparent",
            border: "1px solid #39ff14",
            borderRadius: "0.5rem",
            color: "#39ff14",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            cursor: publicKey && amount ? "pointer" : "not-allowed",
            opacity: publicKey && amount ? 1 : 0.4,
            transition: "all 0.2s",
            whiteSpace: "nowrap",
          }}
        >
          {status === "loading" ? "Отправка…" : "Внести"}
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
          Подключите кошелёк для депозита
        </p>
      )}
    </div>
  );
}
