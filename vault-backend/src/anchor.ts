import * as anchor from "@coral-xyz/anchor";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import { CONFIG } from "./config";
import idl from "./simple_vault.json";

let _program: Program | null = null;
let _provider: AnchorProvider | null = null;
let _adminKeypair: Keypair | null = null;

export function getAdminKeypair(): Keypair {
  if (_adminKeypair) return _adminKeypair;
  const raw = JSON.parse(fs.readFileSync(CONFIG.ADMIN_KEYPAIR_PATH, "utf-8"));
  _adminKeypair = Keypair.fromSecretKey(Uint8Array.from(raw));
  return _adminKeypair;
}

export function getProvider(): AnchorProvider {
  if (_provider) return _provider;
  const connection = new Connection(CONFIG.RPC_URL, "confirmed");
  const wallet = new anchor.Wallet(getAdminKeypair());
  _provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(_provider);
  return _provider;
}

export function getProgram(): Program {
  if (_program) return _program;
  const provider = getProvider();
  _program = new Program(idl as anchor.Idl, provider);
  return _program;
}

export function getConnection(): Connection {
  return getProvider().connection;
}
