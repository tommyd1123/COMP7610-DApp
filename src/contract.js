export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS ?? "";

export const SEPOLIA_CHAIN_ID = 11155111n;
export const SEPOLIA_CHAIN_HEX = "0xaa36a7";
export const SEPOLIA_EXPLORER_URL = "https://sepolia.etherscan.io";

export const CONTRACT_ABI = [
  "function mint() external",
  "function hasClaimed(address account) view returns (bool)",
];

export function shortAddress(value) {
  if (!value) return "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
