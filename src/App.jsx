import { useEffect, useState } from "react";
import { BrowserProvider, Contract, isAddress } from "ethers";
import {
  CONTRACT_ABI,
  CONTRACT_ADDRESS,
  SEPOLIA_CHAIN_HEX,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_EXPLORER_URL,
  shortAddress,
} from "./contract.js";

export default function App() {
  const [walletAddr, setWalletAddr] = useState("");
  const [claimedNft, setClaimedNft] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [hintText, setHintText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const contractConfigured = isAddress(CONTRACT_ADDRESS);

  let claimBtnText = "Claim NFT";
  if (claimedNft) claimBtnText = "NFT already claimed";
  if (isProcessing) claimBtnText = "Processing...";

  function getProvider() {
    if (!window.ethereum) {
      throw new Error("MetaMask is not installed. Please install it and try again.");
    }
    return new BrowserProvider(window.ethereum);
  }

  async function ensureSepolia() {
    const provider = getProvider();
    const network = await provider.getNetwork();
    if (network.chainId === SEPOLIA_CHAIN_ID) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_HEX }],
      });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: SEPOLIA_CHAIN_HEX,
            chainName: "Sepolia",
            nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://rpc.sepolia.org"],
            blockExplorerUrls: [SEPOLIA_EXPLORER_URL],
          }],
        });
        return;
      }
      throw err;
    }
  }

  async function refreshClaimStatus(address) {
    if (!contractConfigured || !address) {
      setClaimedNft(false);
      return;
    }

    try {
      const provider = getProvider();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const alreadyClaimed = await contract.hasClaimed(address);
      setClaimedNft(Boolean(alreadyClaimed));
    } catch {
      setClaimedNft(false);
    }
  }

  async function connectWallet() {
    try {
      setIsProcessing(true);
      setHintText("Connecting wallet...");
      await ensureSepolia();
      const provider = getProvider();
      const accounts = await provider.send("eth_requestAccounts", []);
      const address = accounts[0] ?? "";
      setWalletAddr(address);
      await refreshClaimStatus(address);
      setHintText(address ? "Wallet connected." : "No account selected.");
    } catch (err) {
      setHintText(err.shortMessage || err.message || "Failed to connect wallet.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function mint() {
    if (!contractConfigured) {
      setHintText("Please set VITE_CONTRACT_ADDRESS in a .env file first.");
      return;
    }

    try {
      setIsProcessing(true);
      setHintText("Sending transaction...");
      await ensureSepolia();
      const provider = getProvider();
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const tx = await contract.mint();
      setTransactionId(tx.hash);
      setHintText("Waiting for confirmation...");
      await tx.wait();
      setClaimedNft(true);
      setHintText("NFT claimed successfully!");
    } catch (err) {
      setHintText(err.shortMessage || err.message || "Mint failed.");
    } finally {
      setIsProcessing(false);
    }
  }

  useEffect(() => {
    if (!window.ethereum) return undefined;

    const onAccountsChanged = (accounts) => {
      const address = accounts[0] ?? "";
      setWalletAddr(address);
      setTransactionId("");
      setClaimedNft(false);
    };

    window.ethereum.on("accountsChanged", onAccountsChanged);
    return () => {
      window.ethereum.removeListener("accountsChanged", onAccountsChanged);
    };
  }, []);

  return (
    <div style={{
      maxWidth: "600px",
      margin: "4rem auto",
      padding: "2rem",
      backgroundColor: "#f0f4f8",
      borderRadius: "16px",
      fontFamily: "sans-serif",
      textAlign: "left",
    }}>
      <h2 style={{color:"#1a202c"}}>Sepolia NFT Claim System</h2>
      <p style={{color:"#4a5568"}}>
        This DApp lets users claim one NFT ticket on Sepolia testnet.
      </p>

      {!contractConfigured && (
        <p style={{
          padding:"10px",
          backgroundColor:"#fff3cd",
          color:"#856404",
          borderRadius:"8px",
          marginTop: "16px",
        }}>
          ⚠️ Warning: Please fill your deployed contract address in environment file first.
        </p>
      )}

      {!walletAddr ? (
        <button
          onClick={connectWallet}
          disabled={isProcessing}
          style={{
            marginTop: "16px",
            padding:"10px 20px",
            backgroundColor:"#2b6cb0",
            color:"white",
            border:"none",
            borderRadius:"8px",
            fontSize:"16px",
            cursor:"pointer"
          }}
        >
          Link MetaMask Wallet
        </button>
      ) : (
        <div style={{marginTop:"16px"}}>
          <p style={{color:"#2d3748"}}>
            Wallet Connected: <strong>{shortAddress(walletAddr)}</strong>
          </p>
          <button
            onClick={mint}
            disabled={isProcessing || claimedNft || !contractConfigured}
            style={{
              marginTop:"8px",
              padding:"10px 20px",
              backgroundColor:"#38a169",
              color:"white",
              border:"none",
              borderRadius:"8px",
              fontSize:"16px",
              cursor:"pointer"
            }}
          >
            {claimBtnText}
          </button>
        </div>
      )}

      {hintText && (
        <p style={{marginTop:"16px", color:"#2d3748"}}>
          Status: {hintText}
        </p>
      )}

      {transactionId && (
        <a
          href={`${SEPOLIA_EXPLORER_URL}/tx/${transactionId}`}
          target="_blank"
          rel="noreferrer"
          style={{
            display:"inline-block",
            marginTop:"12px",
            color:"#2b6cb0"
          }}
        >
          Check transaction record: {shortAddress(transactionId)} →
        </a>
      )}

    </div>
  );
}
