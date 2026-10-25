import { useEffect, useState } from "react";
import { readOverview, readTicketFor } from "../chain/read.js";
import { useSession } from "../ui/session.jsx";
import { explainError } from "../ui/format.js";
import { claimTicket } from "../wallet/ethereum.js";

export function ClaimPage() {
  const session = useSession();
  const [overview, setOverview] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [ticketFailed, setTicketFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    readOverview()
      .then((data) => {
        if (!ignore) setOverview(data);
      })
      .catch(() => {
        if (!ignore) setError("Seat count could not be read. Refresh and try again.");
      });
    return () => {
      ignore = true;
    };
  }, [session.revision]);

  useEffect(() => {
    if (!session.account) {
      setTicket(null);
      setTicketFailed(false);
      return undefined;
    }
    let ignore = false;
    setTicket(null);
    setTicketFailed(false);
    readTicketFor(session.account)
      .then((data) => {
        if (!ignore) setTicket(data);
      })
      .catch(() => {
        if (!ignore) setTicketFailed(true);
      });
    return () => {
      ignore = true;
    };
  }, [session.account, session.revision]);

  const remaining = overview ? overview.remaining : null;
  const seatCap = overview ? overview.seatCap : 50n;
  const soldOut = remaining === 0n;
  const ticketLoading = Boolean(session.account) && ticket === null && !ticketFailed;
  const hasActive = Boolean(ticket?.active);
  const checkedIn = Boolean(ticket?.entered && !ticket?.active);

  async function claim() {
    setBusy(true);
    setError("");
    try {
      const hash = await claimTicket();
      const next = await readTicketFor(session.account);
      session.noteActivity({
        hash,
        tokenId: next.tokenId,
        kind: "claimed",
      });
      window.location.hash = "#ticket";
    } catch (err) {
      setError(explainError(err));
    } finally {
      setBusy(false);
    }
  }

  let label = "Connect to claim a seat";
  let onClick = session.openWallet;
  let disabled = false;
  if (ticketLoading) {
    label = "";
    disabled = true;
    onClick = undefined;
  } else if (session.account && hasActive) {
    label = "View my ticket";
    onClick = () => {
      window.location.hash = "#ticket";
    };
  } else if (session.account && checkedIn) {
    label = "Already checked in";
    disabled = true;
    onClick = undefined;
  } else if (session.account && soldOut) {
    label = "Sold out";
    disabled = true;
    onClick = undefined;
  } else if (session.account) {
    label = busy ? "Waiting for the wallet..." : "Claim a free seat";
    disabled = busy;
    onClick = claim;
  }

  const availableCopy = soldOut
    ? "A return will open one seat."
    : "Claim while there is room.";

  return (
    <section className="event">
      <div className="split">
        <div>
          <p className="kicker">01 / Campus seminar</p>
          <h1>
            Make room
            <br />
            for new ideas.
          </h1>
          <p className="deck">
            One open lecture. Fifty seats.
            <br />
            A ticket you can keep, pass on, or return.
          </p>
          <div className="facts">
            <div>
              <p className="kicker">When</p>
              <p>1 November 2026, 10:00</p>
            </div>
            <div>
              <p className="kicker">Where</p>
              <p>3/F, CDS Building 5, HKU</p>
            </div>
          </div>
          <div className="actions">
            <button className="btn btn-dark" type="button" disabled={disabled} onClick={onClick} aria-busy={ticketLoading}>
              {ticketLoading ? (
                <span className="spinner spinner-sm spinner-on-dark" role="status" aria-label="Loading your ticket" />
              ) : (
                label
              )}
            </button>
            {!ticketLoading && !hasActive && (
              <a className="text-link" href="#ticket">
                View my ticket
              </a>
            )}
          </div>
          <p className="fine">Free admission · Testnet gas applies</p>
          {checkedIn && (
            <p className="fine">This wallet has already been checked in and cannot claim again.</p>
          )}
          {error && <p className="alert">{error}</p>}
        </div>
        <aside className="invite">
          <p className="kicker on-dark">An open invitation</p>
          <p className="mega">{String(seatCap)}</p>
          <div className="invite-meta">
            <span>Total seats</span>
            <span>Free admission</span>
          </div>
          <hr />
          <div className="available-row">
            {remaining === null ? (
              <span className="spinner spinner-sm spinner-on-dark" role="status" aria-label="Loading seats" />
            ) : (
              <p className="available">{String(remaining)}</p>
            )}
            <p className="invite-note">
              seats available
              <br />
              {remaining === null ? "Claim while there is room." : availableCopy}
            </p>
          </div>
        </aside>
      </div>
      <ol className="steps">
        <li>
          <p className="kicker">01 / Connect</p>
          <p>Use your wallet on Sepolia.</p>
        </li>
        <li>
          <p className="kicker">02 / Claim</p>
          <p>One active ticket per wallet.</p>
        </li>
        <li>
          <p className="kicker">03 / Attend</p>
          <p>The organizer checks you in.</p>
        </li>
      </ol>
    </section>
  );
}
