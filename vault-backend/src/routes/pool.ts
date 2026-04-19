import { Router, Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { TxVersion } from "@raydium-io/raydium-sdk-v2";
import { getRaydium } from "../raydium";
import { getConnection } from "../anchor";
import { CONFIG } from "../config";

const router = Router();

/**
 * GET /api/pool/info
 * Возвращает информацию о Raydium CLMM пуле:
 * цена, текущий тик, tickSpacing, mintA, mintB
 */
router.get("/info", async (_req: Request, res: Response) => {
  try {
    const raydium = await getRaydium();
    const { poolInfo } = await raydium.clmm.getPoolInfoFromRpc(
      CONFIG.POOL_ID.toBase58()
    );

    res.json({
      poolId: CONFIG.POOL_ID.toBase58(),
      mintA: poolInfo.mintA.address,
      mintB: poolInfo.mintB.address,
      price: poolInfo.price,
      tickCurrent: (poolInfo as any).tickCurrent ?? 0,
      tickSpacing: poolInfo.config.tickSpacing,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/pool/swap/build
 * Body:
 *   wallet      — pubkey пользователя (fee payer + signer)
 *   inputMint   — "SOL" | "TOKEN" (что отдаём)
 *   amountIn    — количество в человеческих единицах (напр. 0.05 для SOL)
 *   slippage    — проскальзывание 0–1 (напр. 0.01 = 1%), по умолчанию 0.01
 *
 * Возвращает base64 неподписанной транзакции — фронт подписывает кошельком.
 */
router.post("/swap/build", async (req: Request, res: Response) => {
  try {
    const { wallet, inputMint, amountIn, slippage = 0.01 } = req.body;

    if (!wallet || !inputMint || amountIn === undefined) {
      return res.status(400).json({
        error: "wallet, inputMint (SOL|TOKEN) и amountIn обязательны",
      });
    }

    const userPubkey = new PublicKey(wallet);
    const connection = getConnection();
    const raydium = await getRaydium();

    const { poolInfo, poolKeys } = await raydium.clmm.getPoolInfoFromRpc(
      CONFIG.POOL_ID.toBase58()
    );

    // Определяем направление свопа
    const isSolIn = (inputMint as string).toUpperCase() === "SOL";
    const inputMintAddr = isSolIn
      ? NATIVE_MINT.toBase58()
      : CONFIG.MY_TOKEN_MINT.toBase58();
    const outputMintAddr = isSolIn
      ? CONFIG.MY_TOKEN_MINT.toBase58()
      : NATIVE_MINT.toBase58();

    // Переводим в raw units
    const inputDecimals = isSolIn
      ? 9
      : poolInfo.mintA.address === CONFIG.MY_TOKEN_MINT.toBase58()
        ? poolInfo.mintA.decimals
        : poolInfo.mintB.decimals;

    const amountInRaw = Math.floor(parseFloat(amountIn) * 10 ** inputDecimals);

    // Строим swap через Raydium SDK с TxVersion.LEGACY
    const swapResult = await (raydium.clmm as any).swap({
      poolInfo,
      poolKeys,
      inputMint: inputMintAddr,
      amountIn: amountInRaw,
      amountOutMin: 0,
      priceLimit: undefined,
      ownerInfo: {
        useSOLBalance: isSolIn,
      },
      txVersion: TxVersion.LEGACY,
      slippage: parseFloat(slippage),
    });

    // SDK может вернуть { transaction } или { transactions } или объект с execute
    // Извлекаем транзакцию и добавляем blockhash если нужно
    let txObj = swapResult?.transaction ?? swapResult?.transactions?.[0] ?? swapResult;

    // Если SDK вернул объект с инструкциями — собираем вручную
    if (!txObj || typeof txObj.serialize !== "function") {
      return res.status(500).json({
        error: "Не удалось получить транзакцию от Raydium SDK",
        swapResultKeys: Object.keys(swapResult ?? {}),
      });
    }

    // Устанавливаем feePayer и recentBlockhash если не заданы
    if (!txObj.feePayer) txObj.feePayer = userPubkey;
    if (!txObj.recentBlockhash) {
      const { blockhash } = await connection.getLatestBlockhash();
      txObj.recentBlockhash = blockhash;
    }

    const serialized = txObj.serialize({ requireAllSignatures: false });

    return res.json({
      transaction: Buffer.from(serialized).toString("base64"),
      inputMint: inputMintAddr,
      outputMint: outputMintAddr,
      amountIn: amountInRaw,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message, stack: err.stack?.split("\n").slice(0, 5) });
  }
});

export default router;
