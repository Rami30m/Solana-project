import { Raydium, DEV_API_URLS } from "@raydium-io/raydium-sdk-v2";
import { CONFIG } from "./config";
import { getAdminKeypair, getConnection } from "./anchor";

let _raydium: Raydium | null = null;

export async function getRaydium(): Promise<Raydium> {
  if (_raydium) return _raydium;
  const connection = getConnection();
  const owner = getAdminKeypair();

  _raydium = await Raydium.load({
    owner,
    connection,
    cluster: CONFIG.CLUSTER,
    disableFeatureCheck: true,
    disableLoadToken: true,
    blockhashCommitment: "finalized",
    urlConfigs: DEV_API_URLS,
  });

  return _raydium;
}
