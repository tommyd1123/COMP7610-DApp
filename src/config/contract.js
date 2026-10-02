// 负责人：成员 1 填写部署后的地址；成员 2 改合约时同步改 ABI。
// 地址来自 .env，例子见仓库根目录的 .env.example。
// 这是小组合约要对上的函数名单，Solidity 还没写。成员 2 写合约时按这个名单来，写完再改 ABI。

export const SEAT_CAP = 50;

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS ?? "";

export const TICKET_ABI = [
  "function claim() returns (uint256 tokenId)",
  "function admit(address student)",
  "function remaining() view returns (uint256)",
  "function seatCap() view returns (uint256)",
  "function hasClaimed(address account) view returns (bool)",
  "function admitted(address account) view returns (bool)",
];

// 0xaa36a7 === 11155111，这是 Sepolia。
export const SEPOLIA_CHAIN_ID = "0xaa36a7";

export const SEPOLIA_EXPLORER_URL = "https://sepolia.etherscan.io";
