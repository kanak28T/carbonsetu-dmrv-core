/**
 * All external API calls — Flask dMRV engine, Decentro, Polygonscan.
 * Components never call fetch/axios directly; they call these functions.
 *
 * n8n has been replaced with a direct call to the Flask dMRV engine.
 * The frontend POSTs farmer data directly to the Flask /process endpoint.
 */
import axios from "axios";
import { CONFIG } from "./config";

// ── Flask dMRV Engine (replaces n8n) ─────────────────────────────────────────

/**
 * Fires after farmer registration.
 * Calls Flask /process directly — no n8n intermediary needed.
 * Flask calculates NDVI + CO₂ and writes back to Supabase.
 */
export async function triggerDMRVPipeline(farmerData: Record<string, unknown>) {
  const flaskUrl = CONFIG.flask?.processUrl;

  if (!flaskUrl) {
    console.warn("[api] Flask dMRV URL not set — skipping. Add VITE_FLASK_URL to .env");
    return null;
  }

  try {
    const res = await axios.post(`${flaskUrl}/process`, { farmer: farmerData }, {
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    });
    console.log("[api] Flask dMRV pipeline triggered:", res.status);
    return res.data;
  } catch (e: any) {
    console.error("[api] Flask dMRV error:", e?.message);
    return null; // non-fatal — farmer registration already saved
  }
}

// ── Legacy alias (keeps register.tsx working without changes) ─────────────────
export const triggerN8NWebhook = triggerDMRVPipeline;

// ── Decentro Payment ──────────────────────────────────────────────────────────

/**
 * Generates a UPI payment link for the buyer.
 * TODO: Replace mock with real Decentro integration when API key is ready.
 * Real endpoint: POST https://in.decentro.tech/v2/payments/upi/link
 */
export async function generateDecentroPayment(
  amount: number,
  buyerName: string,
  tokenId: string,
): Promise<{ qrCode: string; paymentRef: string; payment_ref?: string }> {
  if (!CONFIG.decentro.apiKey) {
    // TODO: Remove mock when Decentro API key is added to .env
    console.warn("[api] Decentro API key not set — returning mock payment response");
    return {
      qrCode:     "mock_qr_code",
      paymentRef: `mock_ref_${Date.now()}`,
      payment_ref: `mock_ref_${Date.now()}`,
    };
  }

  try {
    const res = await axios.post(
      `${CONFIG.decentro.baseUrl}/v2/payments/upi/link`,
      { amount, buyer_name: buyerName, reference_id: tokenId },
      {
        headers: {
          "Content-Type": "application/json",
          "client_id": CONFIG.decentro.apiKey,
        },
        timeout: 15000,
      },
    );
    return res.data;
  } catch (e: any) {
    console.error("[api] Decentro payment error:", e?.message);
    throw new Error("Payment service error. Please try again.");
  }
}

// ── Polygonscan ───────────────────────────────────────────────────────────────

export async function getPolygonscanTx(hash: string) {
  try {
    const res = await axios.get(
      `https://api.polygonscan.com/api?module=transaction&action=gettxreceiptstatus&txhash=${hash}`,
      { timeout: 10000 },
    );
    return res.data;
  } catch (e: any) {
    console.error("[api] Polygonscan error:", e?.message);
    return null;
  }
}
