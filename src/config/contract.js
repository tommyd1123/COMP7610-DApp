import ticketAbi from "./SeminarTickets.abi.json";

// 负责人：成员 1 填写部署后的地址；成员 2 改合约时重新生成 ABI。
// 地址来自 .env，例子见仓库根目录的 .env.example。
// npm run compile:contract 从 Solidity 生成完整 ABI（包含事件和自定义错误）。

export const SEAT_CAP = 50;

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS ?? "";

export const TICKET_ABI = ticketAbi;

// 0xaa36a7 === 11155111，这是 Sepolia。
export const SEPOLIA_CHAIN_ID = "0xaa36a7";

export const SEPOLIA_EXPLORER_URL = "https://sepolia.etherscan.io";
