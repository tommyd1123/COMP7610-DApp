// Compatibility exports for the old tutorial path. Use src/config/contract.js in new code.
import { SEPOLIA_CHAIN_ID as chainHex } from "./config/contract.js";

export {
  CONTRACT_ADDRESS,
  TICKET_ABI as CONTRACT_ABI,
  SEPOLIA_EXPLORER_URL,
} from "./config/contract.js";
export { shortAddress } from "./ui/format.js";

export const SEPOLIA_CHAIN_ID = BigInt(chainHex);
export const SEPOLIA_CHAIN_HEX = chainHex;
