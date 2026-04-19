import { Router, Request, Response } from "express";
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Keypair,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
} from "@solana/spl-token";
import {
  TickUtils,
  PoolUtils,
  getPdaTickArrayAddress,
} from "@raydium-io/raydium-sdk-v2";
import { BN } from "@coral-xyz/anchor";
import Decimal from "decimal.js";
import { getProgram, getConnection, getAdminKeypair } from "../anchor";
import { getRaydium } from "../raydium";
import { CONFIG } from "../config";

const router = Router();

function getVaultPDAs() {
  const [vaultStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), CONFIG.MY_TOKEN_MINT.toBuffer()],
    CONFIG.PROGRAM_ID
  );
  const [vaultTokenAccountPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_tokens"), CONFIG.MY_TOKEN_MINT.toBuffer()],
    CONFIG.PROGRAM_ID
  );
  const [shareMintPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("share_mint"), CONFIG.MY_TOKEN_MINT.toBuffer()],
    CONFIG.PROGRAM_ID
  );
  return { vaultStatePDA, vaultTokenAccountPDA, shareMintPDA };
}

/**
 * POST /api/admin/initialize
 * Инициализирует vault (только admin).
 * Если vault уже создан — возвращает его адрес без ошибки.
 */
router.post("/initialize", async (_req: Request, res: Response) => {
  try {
    const connection = getConnection();
    const program = getProgram();
    const admin = getAdminKeypair();
    const { vaultStatePDA, vaultTokenAccountPDA, shareMintPDA } = getVaultPDAs();

    const existing = await connection.getAccountInfo(vaultStatePDA);
    if (existing) {
      return res.json({
        status: "already_initialized",
        vaultStatePDA: vaultStatePDA.toBase58(),
      });
    }

    const tx = await program.methods
      .initializeVault()
      .accountsPartial({
        vaultState: vaultStatePDA,
        vaultTokenAccount: vaultTokenAccountPDA,
        shareMint: shareMintPDA,
        tokenMint: CONFIG.MY_TOKEN_MINT,
        admin: admin.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([admin])
      .rpc({ commitment: "confirmed" });

    return res.json({
      status: "initialized",
      tx,
      vaultStatePDA: vaultStatePDA.toBase58(),
      explorerUrl: `https://explorer.solana.com/tx/${tx}?cluster=devnet`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/open-position
 * Body: { solAmountSol?: number, tokenAmountRaw?: number, tickRange?: number }
 * Открывает позицию в Raydium CLMM (только admin, подписывает сервер).
 */
router.post("/open-position", async (req: Request, res: Response) => {
  try {
    const connection = getConnection();
    const program = getProgram();
    const admin = getAdminKeypair();
    const raydium = await getRaydium();

    const solAmountLamports = Math.floor(
      (req.body.solAmountSol ?? 0.05) * 1e9
    );
    const tokenAmountRaw = req.body.tokenAmountRaw ?? 10 * 1e6;
    const tickRange = req.body.tickRange ?? 5000;

    const { vaultStatePDA, vaultTokenAccountPDA } = getVaultPDAs();

    // ── Pool info ──────────────────────────────────────────────────────────
    const { poolInfo, poolKeys } = await raydium.clmm.getPoolInfoFromRpc(
      CONFIG.POOL_ID.toBase58()
    );

    const tickSpacing = poolInfo.config.tickSpacing;
    const currentTick: number = (poolInfo as any).tickCurrent ?? 0;

    const tickLower =
      Math.floor((currentTick - tickRange) / tickSpacing) * tickSpacing;
    const tickUpper =
      Math.ceil((currentTick + tickRange) / tickSpacing) * tickSpacing;

    const tickArrayLowerStart = TickUtils.getTickArrayStartIndexByTick(
      tickLower,
      tickSpacing
    );
    const tickArrayUpperStart = TickUtils.getTickArrayStartIndexByTick(
      tickUpper,
      tickSpacing
    );

    // ── Liquidity ──────────────────────────────────────────────────────────
    const myTokenIsA =
      poolInfo.mintA.address === CONFIG.MY_TOKEN_MINT.toBase58();
    const baseAmount = myTokenIsA ? tokenAmountRaw : solAmountLamports;
    const epochInfo = await connection.getEpochInfo();

    const { liquidity, amountSlippageA, amountSlippageB } =
      await PoolUtils.getLiquidityAmountOutFromAmountIn({
        poolInfo,
        slippage: 0.01,
        inputA: myTokenIsA,
        tickUpper: Math.max(tickLower, tickUpper),
        tickLower: Math.min(tickLower, tickUpper),
        amount: new BN(baseAmount),
        add: true,
        epochInfo,
        amountHasFee: false,
      });

    const amount0Max = amountSlippageA.amount.toNumber();
    const amount1Max = amountSlippageB.amount.toNumber();

    // ── wSOL account ───────────────────────────────────────────────────────
    const wsolAta = await getAssociatedTokenAddress(
      NATIVE_MINT,
      vaultStatePDA,
      true
    );
    const wsolInfo = await connection.getAccountInfo(wsolAta);
    const wrapTx = new Transaction();
    if (!wsolInfo) {
      wrapTx.add(
        createAssociatedTokenAccountInstruction(
          admin.publicKey,
          wsolAta,
          vaultStatePDA,
          NATIVE_MINT
        )
      );
    }
    wrapTx.add(
      SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: wsolAta,
        lamports: solAmountLamports + 10_000_000,
      }),
      createSyncNativeInstruction(wsolAta)
    );
    const wrapSig = await connection.sendTransaction(wrapTx, [admin]);
    await connection.confirmTransaction(wrapSig, "confirmed");

    // ── Raydium PDAs ───────────────────────────────────────────────────────
    const poolState = new PublicKey(poolKeys.id);
    const tokenVault0 = new PublicKey(poolKeys.vault.A);
    const tokenVault1 = new PublicKey(poolKeys.vault.B);
    const vault0Mint = new PublicKey(poolInfo.mintA.address);
    const vault1Mint = new PublicKey(poolInfo.mintB.address);

    const tickArrayLower = getPdaTickArrayAddress(
      CONFIG.RAYDIUM_CLMM_DEVNET,
      poolState,
      tickArrayLowerStart
    ).publicKey;
    const tickArrayUpper = getPdaTickArrayAddress(
      CONFIG.RAYDIUM_CLMM_DEVNET,
      poolState,
      tickArrayUpperStart
    ).publicKey;

    const [tickArrayBitmap] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("pool_tick_array_bitmap_extension"),
        poolState.toBuffer(),
      ],
      CONFIG.RAYDIUM_CLMM_DEVNET
    );

    const positionNftMint = Keypair.generate();
    const positionNftAccount = await getAssociatedTokenAddress(
      positionNftMint.publicKey,
      vaultStatePDA,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    const [personalPosition] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), positionNftMint.publicKey.toBuffer()],
      CONFIG.RAYDIUM_CLMM_DEVNET
    );

    // ── CPI → vault::open_raydium_position ────────────────────────────────
    const tx = await program.methods
      .openRaydiumPosition(
        tickLower,
        tickUpper,
        tickArrayLowerStart,
        tickArrayUpperStart,
        new BN(liquidity.toString()),
        new BN(amount0Max),
        new BN(amount1Max)
      )
      .accountsPartial({
        admin: admin.publicKey,
        vaultState: vaultStatePDA,
        vaultTokenAccount: vaultTokenAccountPDA,
        vaultWsolAccount: wsolAta,
        wsolMint: NATIVE_MINT,
        poolState,
        positionNftMint: positionNftMint.publicKey,
        positionNftAccount,
        personalPosition,
        tickArrayLower,
        tickArrayUpper,
        tokenVault0,
        tokenVault1,
        vault0Mint,
        vault1Mint,
        tickArrayBitmap,
        clmmProgram: CONFIG.RAYDIUM_CLMM_DEVNET,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([admin, positionNftMint])
      .rpc({ commitment: "confirmed" });

    return res.json({
      status: "success",
      tx,
      positionNftMint: positionNftMint.publicKey.toBase58(),
      tickLower,
      tickUpper,
      liquidity: liquidity.toString(),
      amount0Max,
      amount1Max,
      explorerUrl: `https://explorer.solana.com/tx/${tx}?cluster=devnet`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message, logs: err.logs });
  }
});

/**
 * POST /api/admin/mint-tokens
 * Body: { wallet: string, amount?: number }
 * Минтит MyToken на указанный кошелёк (только если admin = mint authority).
 */
router.post("/mint-tokens", async (req: Request, res: Response) => {
  try {
    const { wallet, amount = 100 } = req.body;
    if (!wallet) {
      return res.status(400).json({ error: "wallet required" });
    }

    const connection = getConnection();
    const admin = getAdminKeypair();
    const recipient = new PublicKey(wallet);

    const { mintTo, getOrCreateAssociatedTokenAccount } = await import("@solana/spl-token");

    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      admin,
      CONFIG.MY_TOKEN_MINT,
      recipient
    );

    const amountRaw = Math.floor(amount * 1e6);
    const sig = await mintTo(
      connection,
      admin,
      CONFIG.MY_TOKEN_MINT,
      tokenAccount.address,
      admin,
      amountRaw
    );

    return res.json({
      status: "success",
      tx: sig,
      recipient: recipient.toBase58(),
      tokenAccount: tokenAccount.address.toBase58(),
      amountMinted: amount,
      explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
