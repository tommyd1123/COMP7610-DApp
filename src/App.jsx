import { useEffect, useState } from "react";
import { ClaimPage } from "./pages/ClaimPage.jsx";
import { DoorPage } from "./pages/DoorPage.jsx";
import "./App.css";

function pageFromHash() {
  return window.location.hash === "#door" ? "door" : "claim";
}

export default function App() {
  const [page, setPage] = useState(pageFromHash);

  useEffect(() => {
    function onHashChange() {
      setPage(pageFromHash());
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <main className="app">
      <p className="eyebrow">Sepolia seminar</p>
      <h1>Seminar tickets</h1>
      <nav className="nav">
        <a href="#claim" aria-current={page === "claim" ? "page" : undefined}>
          Claim a seat
        </a>
        <a href="#door" aria-current={page === "door" ? "page" : undefined}>
          Door
        </a>
      </nav>
      {page === "door" ? <DoorPage /> : <ClaimPage />}
    </main>
  );
}
