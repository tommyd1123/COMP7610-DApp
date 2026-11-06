// 负责人：成员 3。连接、切网和四笔交易都从这里发出。
import { BrowserProvider, Contract } from "ethers";
import { CONTRACT_ADDRESS, SEPOLIA_CHAIN_ID, TICKET_ABI } from "../config/contract.js";

function requireWallet() {
  if (!window.ethereum) {
    const error = new Error("Install MetaMask to continue.");
    error.code = "NO_WALLET";
    throw error;
  }
}

async function signerContract() {
  requireWallet();
  const provider = new BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(SEPOLIA_CHAIN_ID)) {
    await provider.send("wallet_switchEthereumChain", [{ chainId: SEPOLIA_CHAIN_ID }]);
  }
  const signer = await provider.getSigner();
  return new Contract(CONTRACT_ADDRESS, TICKET_ABI, signer);
}

async function send(tx) {
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

export async function connectAccount({ chooseAccount = false } = {}) {
  requireWallet();
  if (chooseAccount) {
    await window.ethereum.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }],
    });
  }
  const provider = new BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  const network = await provider.getNetwork();
  if (network.chainId !== BigInt(SEPOLIA_CHAIN_ID)) {
    await provider.send("wallet_switchEthereumChain", [{ chainId: SEPOLIA_CHAIN_ID }]);
  }
  const next = await provider.send("eth_accounts", []);
  return next[0] ?? accounts[0];
}

export async function claimTicket() {
  const contract = await signerContract();
  return send(await contract.claim());
}

export async function transferTicket(to, tokenId) {
  const contract = await signerContract();
  return send(await contract.transferTicket(to, tokenId));
}

export async function returnTicket(tokenId) {
  const contract = await signerContract();
  return send(await contract.returnTicket(tokenId));
}

export async function admitStudent(tokenId) {
  const contract = await signerContract();
  return send(await contract.admit(tokenId));
}

export function onWalletChange(handler) {
  if (!window.ethereum?.on) return () => {};
  const wallet = window.ethereum;
  const onAccounts = (accounts) => handler(accounts[0] ?? "");
  const onChain = () => window.location.reload();
  wallet.on("accountsChanged", onAccounts);
  wallet.on("chainChanged", onChain);
  return () => {
    wallet.removeListener("accountsChanged", onAccounts);
    wallet.removeListener("chainChanged", onChain);
  };
}
