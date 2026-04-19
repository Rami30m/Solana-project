import express from "express";
import cors from "cors";
import { CONFIG } from "./config";

import vaultRoutes from "./routes/vault";
import poolRoutes from "./routes/pool";
import adminRoutes from "./routes/admin";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/vault", vaultRoutes);
app.use("/api/pool", poolRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", cluster: CONFIG.CLUSTER });
});

app.listen(CONFIG.PORT, () => {
  console.log(`✅ Vault backend running on http://localhost:${CONFIG.PORT}`);
  console.log(`   Cluster:    ${CONFIG.CLUSTER}`);
  console.log(`   Program ID: ${CONFIG.PROGRAM_ID.toBase58()}`);
  console.log(`   Pool ID:    ${CONFIG.POOL_ID.toBase58()}`);
});
