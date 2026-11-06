import { useEffect, useState } from "react";
import { ClaimPage } from "./pages/ClaimPage.jsx";
import { DoorPage } from "./pages/DoorPage.jsx";
import { TicketPage } from "./pages/TicketPage.jsx";
import { shortAddress } from "./ui/format.js";
import { SessionProvider, useSession } from "./ui/session.jsx";
import "./App.css";

function pageFromHash() {
  if (window.location.hash === "#ticket") return "ticket";
  if (window.location.hash === "#door") return "door";
  return "claim";
}

const PAGES = {
  claim: ClaimPage,
  ticket: TicketPage,
  door: DoorPage,
};

function Shell() {
  const session = useSession();
  const [page, setPage] = useState(pageFromHash);
  const [details, setDetails] = useState(false);
  const Page = PAGES[page];
  const isOrganizer =
    session.account &&
    session.organizer &&
    session.account.toLowerCase() === session.organizer.toLowerCase();

  useEffect(() => {
    function onHashChange() {
      setPage(pageFromHash());
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  let walletLabel = "Connect wallet";
  if (isOrganizer) walletLabel = "Organizer wallet";
  else if (session.account) walletLabel = shortAddress(session.account);

  return (
    <div className="shell">
      <header className="top">
        <a className="brand" href="#claim">
          SEAT. <span>Campus seminar</span>
        </a>
        <nav className="nav" aria-label="Pages">
          <a href="#claim" aria-current={page === "claim" ? "page" : undefined}>
            Event
          </a>
          <a href="#ticket" aria-current={page === "ticket" ? "page" : undefined}>
            My ticket
          </a>
        </nav>
        <div className="wallet-slot">
          <span className="network">Sepolia</span>
          <button
            className="wallet-btn"
            type="button"
            onClick={() => {
              if (session.account) setDetails((open) => !open);
              else session.openWallet();
            }}
          >
            {walletLabel}
          </button>
          {details && session.account && (
            <div className="wallet-card">
              <p className="kicker">Connected</p>
              <p className="mono full">{session.account}</p>
              <p className="fine">Sepolia</p>
              <button
                className="btn btn-light"
                type="button"
                onClick={() => {
                  setDetails(false);
                  session.openAccountSwitcher();
                }}
              >
                Switch account
              </button>
              <button
                className="btn btn-light"
                type="button"
                onClick={() => {
                  session.disconnect();
                  setDetails(false);
                }}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="app">
        <Page />
      </main>
      <footer className="foot">
        <div className="frame foot-row">
          <span>SEAT. / Student-led events</span>
          <a href="#door" aria-current={page === "door" ? "page" : undefined}>
            Organizer access
          </a>
        </div>
      </footer>
      {session.modal && (
        <div className="modal-back" role="presentation" onClick={session.closeWallet}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="wallet-title">{session.chooseAccount ? "Switch account" : "Connect a wallet"}</h2>
            <p className="deck">
              {session.chooseAccount
                ? "Choose the account you want to use in MetaMask, then approve the connection."
                : "Continue with MetaMask on Sepolia. To use a different account, choose another account below."}
            </p>
            {session.error && <p className="alert">{session.error}</p>}
            <button className="btn btn-dark" type="button" disabled={session.busy} onClick={session.connect}>
              {session.busy ? "Waiting for the wallet..." : session.chooseAccount ? "Choose account in MetaMask" : "Continue with MetaMask"}
            </button>
            {!session.chooseAccount && (
              <button className="btn btn-light" type="button" disabled={session.busy} onClick={session.openAccountSwitcher}>
                Choose another account
              </button>
            )}
            <button className="btn btn-light" type="button" disabled={session.busy} onClick={session.closeWallet}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <Shell />
    </SessionProvider>
  );
}
