/**
 * All blockchain interactions — MetaMask + Polygon Amoy + KisanCredit contract.
 * Components never use ethers directly; they call these functions.
 *
 * Land Hash
 * ─────────
 * SHA-256(District ∥ Taluka ∥ Village ∥ GatNo) is computed in the browser using
 * the Web Crypto API and passed to mintToken() as bytes32.  This is the on-chain
 * anti-duplicate fingerprint described in the paper:
 *   H_7/12 = SHA-256(District ∥ Taluka ∥ Village ∥ GatNo)
 *
 * Fallback strategy
 * ─────────────────
 * mintTokens() and burnTokens() first attempt a real on-chain transaction.
 * If that fails for ANY reason (onlyOwner revert, insufficient POL, network
 * error) they silently fall back to a simulated tx so the demo UI never crashes.
 * The simulated hash is clearly logged as "[SIMULATED]" and has isSim: true in
 * the returned object for admin.tsx to optionally badge.
 *
 * User rejection (MetaMask cancel, code 4001) is re-thrown — the caller
 * (admin.tsx) catches it silently so no red error banner appears.
 */
import { ethers } from "ethers";
import { CONFIG } from "./config";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum?: any;
  }
}

// ── ABI ───────────────────────────────────────────────────────────────────────

const CONTRACT_ABI = [
  // mintToken takes a single MintParams struct (tuple) — avoids stack-too-deep
  "function mintToken((address to, string farmerId, string gpsLat, string gpsLon, string ndviScore, string co2Tonnes, uint256 amount, bytes32 landHash) p) public",
  "function burnToken(uint256 tokenId) public",
  "function getTokenDetails(uint256 tokenId) public view returns (tuple(string farmerId, string gpsLat, string gpsLon, string ndviScore, string co2Tonnes, bytes32 landHash, bool burned))",
  "function tokenCounter() public view returns (uint256)",
  "function isLandRegistered(bytes32 landHash) public view returns (bool registered, uint256 existingTokenId)",
  "event TokenMinted(uint256 indexed tokenId, string farmerId, string co2Tonnes, string ndviScore, string gpsLat, string gpsLon, bytes32 landHash)",
  "event TokenBurned(uint256 indexed tokenId, string farmerId, string co2Tonnes)",
];

// ── Land Hash ─────────────────────────────────────────────────────────────────

/**
 * Compute the SHA-256 land fingerprint.
 *
 * Formula from paper:
 *   H_7/12 = SHA-256(District ∥ Taluka ∥ Village ∥ GatNo)
 *
 * District is always "NAGPUR" for this deployment.
 * Separator is "|" — consistent across frontend and any future backend re-check.
 *
 * @returns  bytes32 hex string, e.g. "0xabc123..."
 */
export async function computeLandHash(
  taluka: string,
  village: string,
  gatNo: string,
): Promise<string> {
  const input = `NAGPUR|${taluka.trim().toUpperCase()}|${village.trim().toUpperCase()}|${gatNo.trim()}`;
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generates a realistic-looking 66-char hex tx hash for simulated fallback. */
function simHash(): string {
  const hex = Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
  return `0x${hex}`;
}

/** Fake receipt that satisfies ethers.TransactionReceipt shape minimally. */
function simReceipt(hash: string): ethers.TransactionReceipt {
  return {
    hash,
    status: 1,
    blockNumber: Math.floor(Math.random() * 9_000_000) + 1_000_000,
    blockHash:   simHash(),
    index:       0,
    type:        2,
    to:          CONFIG.blockchain.contractAddress,
    from:        "0x0000000000000000000000000000000000000000",
    contractAddress: null,
    gasUsed:     BigInt(120_000),
    cumulativeGasUsed: BigInt(120_000),
    gasPrice:    BigInt("30000000000"),
    logs:        [],
    logsBloom:   "0x",
    root:        undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// ── Provider / Signer helpers ─────────────────────────────────────────────────

export function getProvider(): ethers.Provider {
  if (typeof window !== "undefined" && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum);
  }
  return new ethers.JsonRpcProvider(CONFIG.blockchain.rpcUrl);
}

export async function connectWallet(): Promise<{ address: string; chainId: number }> {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed. Please install MetaMask to continue.");
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);

  const network = await provider.getNetwork();

  if (network.chainId !== BigInt(CONFIG.blockchain.chainId)) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CONFIG.blockchain.chainIdHex }],
      });
    } catch (switchErr: any) {
      if (switchErr.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId:           CONFIG.blockchain.chainIdHex,
            chainName:         CONFIG.blockchain.chainName,
            nativeCurrency:    CONFIG.blockchain.nativeCurrency,
            rpcUrls:           [CONFIG.blockchain.rpcUrl],
            blockExplorerUrls: [CONFIG.blockchain.explorerUrl],
          }],
        });
      } else {
        throw switchErr;
      }
    }
  }

  const signer  = await provider.getSigner();
  const address = await signer.getAddress();
  return { address, chainId: CONFIG.blockchain.chainId };
}

export async function getSigner(): Promise<ethers.Signer> {
  await connectWallet();
  const provider = new ethers.BrowserProvider(window.ethereum);
  return provider.getSigner();
}

export function getContract(withSigner = false): ethers.Contract | Promise<ethers.Contract> {
  if (withSigner) {
    return getSigner().then(
      (signer) => new ethers.Contract(CONFIG.blockchain.contractAddress, CONTRACT_ABI, signer),
    );
  }
  return new ethers.Contract(CONFIG.blockchain.contractAddress, CONTRACT_ABI, getProvider());
}

export async function getWalletAddress(): Promise<string | null> {
  try {
    if (!window.ethereum) return null;
    const provider = new ethers.BrowserProvider(window.ethereum);
    // eth_accounts — NO popup, just returns already-connected accounts
    const accounts = await provider.send("eth_accounts", []);
    return accounts[0] ?? null;
  } catch {
    return null;
  }
}

// ── Mint ──────────────────────────────────────────────────────────────────────

export type MintResult = {
  txHash:   string;
  tokenId:  string;
  receipt:  ethers.TransactionReceipt;
  landHash: string;  // SHA-256 fingerprint stored on-chain
  isSim:    boolean; // true when fallback simulation was used
};

/**
 * Mint a carbon credit token on-chain.
 *
 * Computes the SHA-256 land hash from taluka/village/gatNo before calling the
 * contract so the fingerprint is stored permanently on-chain.
 *
 * Falls back to simulation if the real tx fails for any reason other than
 * user rejection (code 4001).
 */
export async function mintTokens(
  farmerId:      string,
  gpsLat:        string,
  gpsLon:        string,
  ndviScore:     string,
  co2Tonnes:     string,
  farmerAddress: string,
  amount:        number,
  // Land record fields for SHA-256 fingerprint (paper: H_7/12)
  taluka:        string = "",
  village:       string = "",
  gatNo:         string = "",
): Promise<MintResult> {
  console.log("[blockchain] mintTokens: farmer =", farmerId);

  // Compute SHA-256 land hash (District=NAGPUR is fixed for this deployment)
  const landHash = await computeLandHash(taluka, village, gatNo);
  console.log("[blockchain] landHash =", landHash, `(NAGPUR|${taluka}|${village}|${gatNo})`);

  // ── Real on-chain path ────────────────────────────────────────────────────
  try {
    const contract = await getContract(true) as ethers.Contract;

    const tx = await contract.mintToken(
      {
        to:         farmerAddress,
        farmerId:   farmerId,
        gpsLat:     gpsLat,
        gpsLon:     gpsLon,
        ndviScore:  ndviScore,
        co2Tonnes:  co2Tonnes,
        amount:     BigInt(amount),
        landHash:   landHash,
      },
      {
        gasLimit: BigInt(500_000),
        maxFeePerGas:         BigInt("50000000000"),  // 50 gwei
        maxPriorityFeePerGas: BigInt("30000000000"),  // 30 gwei
      },
    );

    console.log("[blockchain] mintTokens: tx submitted, hash =", tx.hash);
    const receipt = await tx.wait();

    // Read the new tokenId — tokenCounter increments after mint, so counter-1
    let tokenId = "0";
    try {
      const counter = await contract.tokenCounter();
      tokenId = (counter - 1n).toString();
    } catch (e) {
      console.warn("[blockchain] could not read tokenCounter:", e);
    }

    console.log("[blockchain] mintTokens: confirmed, tokenId =", tokenId);
    return { txHash: tx.hash, tokenId, receipt, landHash, isSim: false };

  } catch (e: any) {
    // User cancelled MetaMask — re-throw so admin.tsx can catch silently
    if (e?.code === 4001 || e?.code === "ACTION_REJECTED") throw e;

    // Any other failure → simulated fallback so demo never blocks
    console.warn("[blockchain] mintTokens: real tx failed, using simulation:", e?.message ?? e);
    await new Promise((r) => setTimeout(r, 1500));
    const hash    = simHash();
    const receipt = simReceipt(hash);
    const tokenId = String(Math.floor(Math.random() * 9000) + 1000);
    console.log("[blockchain] mintTokens: [SIMULATED] hash =", hash, "tokenId =", tokenId);
    return { txHash: hash, tokenId, receipt, landHash, isSim: true };
  }
}

// ── Burn ──────────────────────────────────────────────────────────────────────

export type BurnResult = {
  txHash:  string;
  receipt: ethers.TransactionReceipt;
  isSim:   boolean;
};

/**
 * Permanently retire a carbon credit token on-chain.
 * Falls back to simulation on any error (except user rejection).
 */
export async function burnTokens(tokenId: string): Promise<BurnResult> {
  console.log("[blockchain] burnTokens: tokenId =", tokenId);

  // ── Real on-chain path ────────────────────────────────────────────────────
  try {
    const contract = await getContract(true) as ethers.Contract;

    const tx = await contract.burnToken(BigInt(tokenId), {
      gasLimit: BigInt(200_000),
      maxFeePerGas:         BigInt("50000000000"),
      maxPriorityFeePerGas: BigInt("30000000000"),
    });

    console.log("[blockchain] burnTokens: tx submitted, hash =", tx.hash);
    const receipt = await tx.wait();
    console.log("[blockchain] burnTokens: confirmed");
    return { txHash: tx.hash, receipt, isSim: false };

  } catch (e: any) {
    // User cancelled MetaMask — re-throw so registry.tsx can catch
    if (e?.code === 4001 || e?.code === "ACTION_REJECTED") throw e;

    // Fallback simulation
    console.warn("[blockchain] burnTokens: real tx failed, using simulation:", e?.message ?? e);
    await new Promise((r) => setTimeout(r, 1500));
    const hash    = simHash();
    const receipt = simReceipt(hash);
    console.log("[blockchain] burnTokens: [SIMULATED] hash =", hash);
    return { txHash: hash, receipt, isSim: true };
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getTokenDetails(tokenId: string): Promise<{
  farmerId:  string;
  gpsLat:    string;
  gpsLon:    string;
  ndviScore: string;
  co2Tonnes: string;
  landHash:  string;
  burned:    boolean;
}> {
  const contract = getContract(false) as ethers.Contract;
  const result   = await contract.getTokenDetails(BigInt(tokenId));
  return {
    farmerId:  result.farmerId,
    gpsLat:    result.gpsLat,
    gpsLon:    result.gpsLon,
    ndviScore: result.ndviScore,
    co2Tonnes: result.co2Tonnes,
    landHash:  result.landHash,
    burned:    result.burned,
  };
}

/**
 * Check if a land parcel is already registered on-chain.
 * Call this before minting to catch duplicates early without spending gas.
 */
export async function checkLandRegistered(
  taluka: string,
  village: string,
  gatNo: string,
): Promise<{ registered: boolean; existingTokenId: string; landHash: string }> {
  const landHash = await computeLandHash(taluka, village, gatNo);
  try {
    const contract = getContract(false) as ethers.Contract;
    const [registered, existingTokenId] = await contract.isLandRegistered(landHash);
    return {
      registered,
      existingTokenId: existingTokenId.toString(),
      landHash,
    };
  } catch {
    // Read call failed (no RPC, contract not deployed yet) — don't block UI
    return { registered: false, existingTokenId: "0", landHash };
  }
}

// ── Legacy aliases ────────────────────────────────────────────────────────────
export const mintToken = mintTokens;
export const burnToken = burnTokens;
