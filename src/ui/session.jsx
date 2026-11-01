import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { readOverview } from "../chain/read.js";
import { SEPOLIA_CHAIN_ID } from "../config/contract.js";
import { explainError, WRONG_NETWORK_MESSAGE } from "./format.js";
import { connectAccount, onWalletChange } from "../wallet/ethereum.js";

const SessionContext = createContext(null);

function isWrongNetwork(chainId) {
  return chainId !== null && BigInt(chainId) !== BigInt(SEPOLIA_CHAIN_ID);
}

export function useSession() {
  return useContext(SessionContext);
}

export function SessionProvider({ children }) {
  const [account, setAccount] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState(null);
  const [revision, setRevision] = useState(0);
  const [chainId, setChainId] = useState(null);

  const refreshNetwork = useCallback(async () => {
    if (!window.ethereum?.request) return null;
    const next = await window.ethereum.request({ method: "eth_chainId" });
    setChainId(next);
    return next;
  }, []);

  const requireSepolia = useCallback(async () => {
    const next = await refreshNetwork();
    if (isWrongNetwork(next)) {
      const error = new Error(WRONG_NETWORK_MESSAGE);
      error.code = "WRONG_NETWORK";
      throw error;
    }
  }, [refreshNetwork]);

  useEffect(() => {
    readOverview()
      .then((data) => setOrganizer(data.organizer))
      .catch(() => {});
    if (window.ethereum?.request) {
      window.ethereum
        .request({ method: "eth_chainId" })
        .then(setChainId)
        .catch(() => {});
      window.ethereum
        .request({ method: "eth_accounts" })
        .then((accounts) => {
          if (accounts?.[0]) setAccount(accounts[0]);
        })
        .catch(() => {});
    }
    return onWalletChange((next) => {
      setAccount(next);
      setRevision((value) => value + 1);
    });
  }, []);

  const openWallet = useCallback(() => {
    setError("");
    setModal(true);
  }, []);

  const closeWallet = useCallback(() => {
    if (busy) return;
    setModal(false);
    setError("");
  }, [busy]);

  const connect = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const next = await connectAccount();
      await refreshNetwork();
      setAccount(next);
      setModal(false);
      setRevision((value) => value + 1);
    } catch (err) {
      const currentChain = await refreshNetwork().catch(() => null);
      const message = explainError(err);
      const networkHint = isWrongNetwork(currentChain) && message !== WRONG_NETWORK_MESSAGE
        ? ` ${WRONG_NETWORK_MESSAGE}`
        : "";
      setError(`${message}${networkHint}`);
    } finally {
      setBusy(false);
    }
  }, [refreshNetwork]);

  const disconnect = useCallback(() => {
    setAccount("");
    setModal(false);
  }, []);

  const noteActivity = useCallback((entry) => {
    setActivity(entry);
    setRevision((value) => value + 1);
  }, []);

  const value = {
    account,
    organizer,
    modal,
    busy,
    error,
    activity,
    revision,
    wrongNetwork: isWrongNetwork(chainId),
    requireSepolia,
    openWallet,
    closeWallet,
    connect,
    disconnect,
    noteActivity,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
