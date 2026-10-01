// 负责人：成员 1 填写部署后的地址；成员 2 改合约时同步改 ABI。
// 地址来自 .env，例子见仓库根目录的 .env.example。
// 教学用的 ABI 和链 ID 与老师教程第 3 页一致。合约一改，ABI 必须跟着改。

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS ?? "";

export const TICKET_ABI = [
  "function mint() returns (uint256 tokenId)",
  "function hasMinted(address account) view returns (bool)",
  "event Mint(address indexed minter, uint256 indexed tokenId)",
];

// 0xaa36a7 === 11155111，这是 Sepolia。
export const SEPOLIA_CHAIN_ID = "0xaa36a7";

export const SEPOLIA_EXPLORER_URL = "https://sepolia.etherscan.io";
