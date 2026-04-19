import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

import { VaultInfo } from "./components/VaultInfo";
import { PoolInfo } from "./components/PoolInfo";
import { WalletBalance } from "./components/WalletBalance";
import { DepositForm } from "./components/DepositForm";
import { WithdrawForm } from "./components/WithdrawForm";
import { SwapForm } from "./components/SwapForm";
import { AdminPanel } from "./components/AdminPanel";

const RPC_ENDPOINT = "https://api.devnet.solana.com";

function Divider() {
  return <div style={{ borderTop: "1px solid #1e1e32", margin: "0.25rem 0" }} />;
}

function Dashboard() {
  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "2rem 1.5rem" }}>

      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: "#39ff14",
              boxShadow: "0 0 8px #39ff14",
              display: "inline-block"
            }} />
            <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#e8e8f0", letterSpacing: "-0.02em" }}>
              SimpleVault
            </h1>
          </div>
          <p style={{ margin: "0.25rem 0 0", color: "#4a4a6a", fontSize: "0.75rem" }}>
            Devnet · Raydium CLMM
          </p>
        </div>
        <WalletMultiButton />
      </header>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Vault info */}
          <Card>
            <VaultInfo />
          </Card>

          {/* Pool info */}
          <Card>
            <PoolInfo />
          </Card>

        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

          {/* Balances */}
          <Card>
            <WalletBalance />
          </Card>

          {/* Actions */}
          <Card>
            <h2 style={{ color: "#e8e8f0", fontSize: "1rem", fontWeight: 600, margin: "0 0 1rem" }}>
              Действия
            </h2>
            <DepositForm />
            <Divider />
            <div style={{ marginTop: "1rem" }}>
              <WithdrawForm />
            </div>
            <Divider />
            <div style={{ marginTop: "1rem" }}>
              <SwapForm />
            </div>
          </Card>

          {/* Admin */}
          <Card muted>
            <AdminPanel />
          </Card>

        </div>
      </div>

      <footer style={{ marginTop: "2.5rem", textAlign: "center", color: "#2a2a3a", fontSize: "0.7rem" }}>
        SimpleVault · {new Date().getFullYear()} · Devnet
      </footer>
    </div>
  );
}

function Card({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div
      style={{
        background: "#13131f",
        border: `1px solid ${muted ? "#161620" : "#1e1e32"}`,
        borderRadius: "1rem",
        padding: "1.25rem",
      }}
    >
      {children}
    </div>
  );
}

export default function App() {
  const network = WalletAdapterNetwork.Devnet;
  const wallets = useMemo(() => [new PhantomWalletAdapter()], [network]);

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Dashboard />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
