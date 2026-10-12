/** Live PageKey deploy on GenLayer Studio Dev (chain 61997). Override via env. */
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_PAGEKEY_ADDRESS ||
  "0x909151ae02909e88a2D03c73591e90a0DA0AF95d") as `0x${string}`;

/** Studio Dev / Studio Next — chain ID 61997. */
export const CHAIN_ID = 61997;
export const RPC_URL =
  process.env.NEXT_PUBLIC_GENLAYER_RPC || "https://studio-dev.genlayer.com/api";
export const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_GENLAYER_EXPLORER || "https://explorer-studio-dev.genlayer.com";
export const EXPLORER = `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`;
export const txUrl = (hash: string) => `${EXPLORER_BASE}/tx/${hash}`;

export const GITHUB = "https://github.com/valentinzubok/PageKey";
export const CONTRACT_REPO = "https://github.com/valentinzubok/PageKeyCore";

/** A page you control: a GitHub profile README, a gist, a personal site. */
export const DEMO_URL = "https://gist.githubusercontent.com/your-name/your-gist-id/raw/pagekey.txt";
