import * as dotenv from "dotenv";
import { PublicKey } from "@solana/web3.js";

dotenv.config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT ?? "3001", 10),
  RPC_URL: process.env.RPC_URL ?? "https://api.devnet.solana.com",
  CLUSTER: (process.env.CLUSTER ?? "devnet") as "devnet" | "mainnet",
  ADMIN_KEYPAIR_PATH:
    process.env.ADMIN_KEYPAIR_PATH?.replace("~", process.env.HOME ?? "") ??
    `${process.env.HOME}/.config/solana/id.json`,

  PROGRAM_ID: new PublicKey("894Q1DP9SU4KE2U3ijPUBUfkJyPtBbAb6FG1HeAZMBG7"),
  POOL_ID: new PublicKey("7ZVMVG2fa1chZVqGDuiofgqq6R5puZJJNGgjFd4EkXpu"),
  MY_TOKEN_MINT: new PublicKey("4T9jq581kFSNE4aAtgzsAAVAy6Cfvq9M4dkBtahD4JSa"),
  RAYDIUM_CLMM_DEVNET: new PublicKey("DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH"),
};
