const BASE_URL = "http://localhost:3001/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

export type VaultInfo = {
  initialized: boolean;
  vaultStatePDA: string;
  vaultTokenAccountPDA: string;
  shareMintPDA: string;
  tokenBalance?: { uiAmount: number; decimals: number; amount: string } | null;
  totalShares?: string;
};

export type WalletBalance = {
  wallet: string;
  solBalance: number;
  tokenBalance?: { uiAmount: number; decimals: number } | null;
  shareBalance?: { uiAmount: number; decimals: number } | null;
};

export type PoolInfo = {
  poolId: string;
  mintA: string;
  mintB: string;
  price: number;
  tickCurrent: number;
  tickSpacing: number;
};

export type BuildTxResponse = {
  transaction: string;
  message: string;
};

export type AdminTxResponse = {
  status: string;
  tx?: string;
  explorerUrl?: string;
  vaultStatePDA?: string;
};

export const api = {
  getVaultInfo: () => request<VaultInfo>("/vault/info"),

  getWalletBalance: (wallet: string) =>
    request<WalletBalance>(`/vault/balance?wallet=${wallet}`),

  getPoolInfo: () => request<PoolInfo>("/pool/info"),

  buildDeposit: (wallet: string, amount: number) =>
    request<BuildTxResponse>("/vault/deposit/build", {
      method: "POST",
      body: JSON.stringify({ wallet, amount }),
    }),

  buildWithdraw: (wallet: string, sharesAmount: number) =>
    request<BuildTxResponse>("/vault/withdraw/build", {
      method: "POST",
      body: JSON.stringify({ wallet, sharesAmount }),
    }),

  adminInitialize: () =>
    request<AdminTxResponse>("/admin/initialize", { method: "POST" }),

  adminMintTokens: (wallet: string, amount = 100) =>
    request<AdminTxResponse & { amountMinted: number }>("/admin/mint-tokens", {
      method: "POST",
      body: JSON.stringify({ wallet, amount }),
    }),

  adminOpenPosition: (params?: {
    solAmountSol?: number;
    tokenAmountRaw?: number;
    tickRange?: number;
  }) =>
    request<AdminTxResponse>("/admin/open-position", {
      method: "POST",
      body: JSON.stringify(params ?? {}),
    }),

  buildSwap: (wallet: string, inputMint: "SOL" | "TOKEN", amountIn: number, slippage = 0.01) =>
    request<BuildTxResponse>("/pool/swap/build", {
      method: "POST",
      body: JSON.stringify({ wallet, inputMint, amountIn, slippage }),
    }),
};
