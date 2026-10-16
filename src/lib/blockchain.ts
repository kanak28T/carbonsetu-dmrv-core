/**
 * All blockchain interactions — MetaMask + Polygon Amoy + GEPCC contract.
 * Components never use ethers directly; they call these functions.
 *
 * Fallback strategy
 * ─────────────────
 * mintTokens() and burnTokens() first attempt a real on-chain transaction.
 * If that fails for ANY reason (onlyOwner revert, insufficient POL, user
 * rejection, network error) they silently fall back to a simulated tx so the
 * demo UI never crashes.  The simulated hash is clearly logged as "[SIMULATED]"
 * and has isSim: true in the returned object for admin.tsx to optionally badge.
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
  "function mintToken(address, string, string, string, string, string, uint256) public",
  "function burnToken(uint256 tokenId) public",
  "function getTokenDetails(uint256 tokenId) public view returns (tuple(string farmerId, string gpsLat, string gpsLon, string ndviScore, string co2Tonnes, bool burned))",
  "function tokenCounter() public view returns (uint256)",
  "event TokenMinted(uint256 indexed tokenId, string farmerId, string co2Tonnes, string ndviScore, string gpsLat, string gpsLon)",
  "event TokenBurned(uint256 indexed tokenId, string farmerId, string co2Tonnes)",
];

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
    const accounts = await provider.send("eth_accounts", []);
    return accounts[0] ?? null;
  } catch {
    return null;
  }
}

// ── Mint ──────────────────────────────────────────────────────────────────────

export type MintResult = {
  txHash:  string;
  tokenId: string;
  receipt: ethers.TransactionReceipt;
  isSim:   boolean;   // true when fallback simulation was used
};

export async function mintTokens(
  farmerId:      string,
  gpsLat:        string,
  gpsLon:        string,
  ndviScore:     string,
  co2Tonnes:     string,
  farmerAddress: string,
  amount:        number,
): Promise<MintResult> {
  console.log("[blockchain] mintTokens: farmer =", farmerId);

  // ── Real on-chain attempt ─────────────────────────────────────────────────
  try {
    const contract = await getContract(true) as ethers.Contract;

    const tx = await contract.mintToken(
      farmerAddress,
      farmerId,
      gpsLat,
      gpsLon,
      ndviScore,
      co2Tonnes,
      BigInt(amount),
      {
        gasLimit:             BigInt(500_000),
        maxFeePerGas:         BigInt("50000000000"),
        maxPriorityFeePerGas: BigInt("30000000000"),
      },
    );
    console.log("[blockchain] mintTokens: tx hash =", tx.hash);

    const receipt = await tx.wait();
    console.log("[blockchain] mintTokens: confirmed block =", receipt.blockNumber);

    let tokenId = "0";
    try {
      const counter = await contract.tokenCounter();
      tokenId = (counter - 1n).toString();
    } catch {
      tokenId = receipt.blockNumber?.toString() ?? "0";
    }

    return { txHash: tx.hash, tokenId, receipt, isSim: false };
  } catch (realErr: any) {
    // User rejected — don't fall back, rethrow so UI can show "cancelled"
    if (realErr?.code === 4001 || realErr?.code === "ACTION_REJECTED") {
      console.warn("[blockchain] mintTokens: user rejected tx");
      throw realErr;
    }

    // All other failures (onlyOwner, low POL, network) → simulated fallback
    console.warn(
      "[blockchain] mintTokens: real tx failed →",
      realErr?.shortMessage ?? realErr?.message,
      "— falling back to simulation",
    );

    await new Promise((r) => setTimeout(r, 1500)); // simulate network delay

    const hash    = simHash();
    const receipt = simReceipt(hash);
    const tokenId = String(Math.floor(Math.random() * 9000) + 1000);

    console.log("[blockchain] mintTokens: [SIMULATED] hash =", hash, "tokenId =", tokenId);
    return { txHash: hash, tokenId, receipt, isSim: true };
  }
}

// ── Burn ──────────────────────────────────────────────────────────────────────

export type BurnResult = {
  txHash:  string;
  receipt: ethers.TransactionReceipt;
  isSim:   boolean;
};

export async function burnTokens(tokenId: string): Promise<BurnResult> {
  console.log("[blockchain] burnTokens: tokenId =", tokenId);

  // ── Real on-chain attempt ─────────────────────────────────────────────────
  try {
    const contract = await getContract(true) as ethers.Contract;

    const tx = await contract.burnToken(BigInt(tokenId), {
      gasLimit:             BigInt(200_000),
      maxFeePerGas:         BigInt("50000000000"),
      maxPriorityFeePerGas: BigInt("30000000000"),
    });
    console.log("[blockchain] burnTokens: tx hash =", tx.hash);

    const receipt = await tx.wait();
    console.log("[blockchain] burnTokens: confirmed block =", receipt.blockNumber);

    return { txHash: tx.hash, receipt, isSim: false };
  } catch (realErr: any) {
    if (realErr?.code === 4001 || realErr?.code === "ACTION_REJECTED") {
      console.warn("[blockchain] burnTokens: user rejected tx");
      throw realErr;
    }

    console.warn(
      "[blockchain] burnTokens: real tx failed →",
      realErr?.shortMessage ?? realErr?.message,
      "— falling back to simulation",
    );

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
    burned:    result.burned,
  };
}

// ── Legacy aliases ────────────────────────────────────────────────────────────
export const mintToken = mintTokens;
export const burnToken = burnTokens;
