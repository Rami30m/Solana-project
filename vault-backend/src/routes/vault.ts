import { Router, Request, Response } from "express";
import {
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { getProgram, getConnection } from "../anchor";
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
 * GET /api/vault/info
 * Возвращает состояние vault: баланс токенов, total shares, адреса PDA
 */
router.get("/info", async (_req: Request, res: Response) => {
  try {
    const connection = getConnection();
    const { vaultStatePDA, vaultTokenAccountPDA, shareMintPDA } = getVaultPDAs();

    const vaultAccountInfo = await connection.getAccountInfo(vaultStatePDA);
    if (!vaultAccountInfo) {
      return res.json({
        initialized: false,
        vaultStatePDA: vaultStatePDA.toBase58(),
        vaultTokenAccountPDA: vaultTokenAccountPDA.toBase58(),
        shareMintPDA: shareMintPDA.toBase58(),
      });
    }

    const tokenBalance = await connection
      .getTokenAccountBalance(vaultTokenAccountPDA)
      .catch(() => null);

    const shareMintInfo = await connection.getParsedAccountInfo(shareMintPDA).catch(() => null);
    const totalShares =
      (shareMintInfo?.value?.data as any)?.parsed?.info?.supply ?? "0";

    return res.json({
      initialized: true,
      vaultStatePDA: vaultStatePDA.toBase58(),
      vaultTokenAccountPDA: vaultTokenAccountPDA.toBase58(),
      shareMintPDA: shareMintPDA.toBase58(),
      tokenBalance: tokenBalance?.value ?? null,
      totalShares,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/vault/balance?wallet=<pubkey>
 * Возвращает SOL баланс и токен-баланс пользователя
 */
router.get("/balance", async (req: Request, res: Response) => {
  try {
    const { wallet } = req.query;
    if (!wallet || typeof wallet !== "string") {
      return res.status(400).json({ error: "wallet query param required" });
    }

    const pubkey = new PublicKey(wallet);
    const connection = getConnection();

    const solBalance = await connection.getBalance(pubkey);

    const userTokenAta = await getAssociatedTokenAddress(
      CONFIG.MY_TOKEN_MINT,
      pubkey
    );
    const tokenBalance = await connection
      .getTokenAccountBalance(userTokenAta)
      .catch(() => null);

    const { shareMintPDA } = getVaultPDAs();
    const userShareAta = await getAssociatedTokenAddress(shareMintPDA, pubkey);
    const shareBalance = await connection
      .getTokenAccountBalance(userShareAta)
      .catch(() => null);

    return res.json({
      wallet: pubkey.toBase58(),
      solBalance: solBalance / 1e9,
      tokenBalance: tokenBalance?.value ?? null,
      shareBalance: shareBalance?.value ?? null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/vault/deposit/build
 * Body: { wallet: string, amount: number }
 * Строит неподписанную транзакцию для депозита.
 * Автоматически создаёт userShareAccount (ATA) если его нет.
 */
router.post("/deposit/build", async (req: Request, res: Response) => {
  try {
    const { wallet, amount } = req.body;
    if (!wallet || !amount) {
      return res.status(400).json({ error: "wallet and amount required" });
    }

    const userPubkey = new PublicKey(wallet);
    const connection = getConnection();
    const program = getProgram();
    const { vaultStatePDA, vaultTokenAccountPDA, shareMintPDA } = getVaultPDAs();

    const userTokenAta = await getAssociatedTokenAddress(
      CONFIG.MY_TOKEN_MINT,
      userPubkey
    );
    const userShareAta = await getAssociatedTokenAddress(shareMintPDA, userPubkey);

    // Проверяем нужно ли создавать userTokenAta и userShareAta
    const [tokenAtaInfo, shareAtaInfo] = await Promise.all([
      connection.getAccountInfo(userTokenAta),
      connection.getAccountInfo(userShareAta),
    ]);

    const depositIx = await program.methods
      .deposit(new BN(amount))
      .accountsPartial({
        vaultState: vaultStatePDA,
        vaultTokenAccount: vaultTokenAccountPDA,
        shareMint: shareMintPDA,
        userTokenAccount: userTokenAta,
        userShareAccount: userShareAta,
        user: userPubkey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: userPubkey });

    // Создаём userTokenAta если нет (на случай нового кошелька)
    if (!tokenAtaInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          userPubkey,
          userTokenAta,
          userPubkey,
          CONFIG.MY_TOKEN_MINT
        )
      );
    }

    // Создаём userShareAta если нет (первый депозит — share account не существует)
    if (!shareAtaInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          userPubkey,
          userShareAta,
          userPubkey,
          shareMintPDA
        )
      );
    }

    tx.add(depositIx);

    const serialized = tx.serialize({ requireAllSignatures: false });

    return res.json({
      transaction: serialized.toString("base64"),
      needsCreateShareAta: !shareAtaInfo,
      needsCreateTokenAta: !tokenAtaInfo,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message, logs: (err as any).logs });
  }
});

/**
 * POST /api/vault/withdraw/build
 * Body: { wallet: string, sharesAmount: number }
 * Строит неподписанную транзакцию для вывода средств.
 * Автоматически создаёт userTokenAta если его нет.
 */
router.post("/withdraw/build", async (req: Request, res: Response) => {
  try {
    const { wallet, sharesAmount } = req.body;
    if (!wallet || !sharesAmount) {
      return res.status(400).json({ error: "wallet and sharesAmount required" });
    }

    const userPubkey = new PublicKey(wallet);
    const connection = getConnection();
    const program = getProgram();
    const { vaultStatePDA, vaultTokenAccountPDA, shareMintPDA } = getVaultPDAs();

    const userTokenAta = await getAssociatedTokenAddress(
      CONFIG.MY_TOKEN_MINT,
      userPubkey
    );
    const userShareAta = await getAssociatedTokenAddress(shareMintPDA, userPubkey);

    // Проверяем нужно ли создавать userTokenAta
    const tokenAtaInfo = await connection.getAccountInfo(userTokenAta);

    const withdrawIx = await program.methods
      .withdraw(new BN(sharesAmount))
      .accountsPartial({
        vaultState: vaultStatePDA,
        vaultTokenAccount: vaultTokenAccountPDA,
        shareMint: shareMintPDA,
        userTokenAccount: userTokenAta,
        userShareAccount: userShareAta,
        user: userPubkey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();

    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: userPubkey });

    // Создаём userTokenAta если нет
    if (!tokenAtaInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          userPubkey,
          userTokenAta,
          userPubkey,
          CONFIG.MY_TOKEN_MINT
        )
      );
    }

    tx.add(withdrawIx);

    const serialized = tx.serialize({ requireAllSignatures: false });

    return res.json({
      transaction: serialized.toString("base64"),
      needsCreateTokenAta: !tokenAtaInfo,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message, logs: (err as any).logs });
  }
});

export default router;
