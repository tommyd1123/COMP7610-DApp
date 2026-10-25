import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { readOverview } from "../chain/read.js";
import { explainError } from "./format.js";
import { connectAccount, onWalletChange } from "../wallet/ethereum.js";

const SessionContext = createContext(null);

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

  useEffect(() => {
    readOverview()
      .then((data) => setOrganizer(data.organizer))
      .catch(() => {});
    if (window.ethereum?.request) {
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
      setAccount(next);
      setModal(false);
      setRevision((value) => value + 1);
    } catch (err) {
      setError(explainError(err));
    } finally {
      setBusy(false);
    }
  }, []);

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
    openWallet,
    closeWallet,
    connect,
    disconnect,
    noteActivity,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
