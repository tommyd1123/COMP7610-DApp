import { useEffect, useState } from "react";
import { ClaimPage } from "./pages/ClaimPage.jsx";
import { DoorPage } from "./pages/DoorPage.jsx";
import { TicketPage } from "./pages/TicketPage.jsx";
import "./App.css";

// 三个业务页面。钱包连接、转让确认、退票确认是弹窗，不占路由。
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

export default function App() {
  const [page, setPage] = useState(pageFromHash);

  useEffect(() => {
    function onHashChange() {
      setPage(pageFromHash());
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const Page = PAGES[page];

  return (
    <div className="shell">
      <header className="top">
        <p className="brand">
          SEAT. <span>Campus seminar</span>
        </p>
        <nav className="nav" aria-label="Pages">
          <a href="#claim" aria-current={page === "claim" ? "page" : undefined}>
            Event
          </a>
          <a href="#ticket" aria-current={page === "ticket" ? "page" : undefined}>
            My ticket
          </a>
        </nav>
      </header>
      <main className="app">
        <Page />
      </main>
      <footer className="foot">
        <span>SEAT. / Student-led events</span>
        <a href="#door" aria-current={page === "door" ? "page" : undefined}>
          Organizer access
        </a>
      </footer>
    </div>
  );
}
