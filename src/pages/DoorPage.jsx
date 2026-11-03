import { useEffect, useState } from "react";
import { readOverview, readTicket } from "../chain/read.js";
import { explainError, shortAddress, ticketNumber, WRONG_NETWORK_MESSAGE } from "../ui/format.js";
import { useSession } from "../ui/session.jsx";
import { Status } from "../ui/Status.jsx";
import { admitStudent } from "../wallet/ethereum.js";

const STATE_LABEL = {
  0: "Returned / waiting to be claimed",
  1: "Active / ready to enter",
  2: "Checked in",
};

export function DoorPage() {
  const session = useSession();
  const [overview, setOverview] = useState(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [transaction, setTransaction] = useState(null);

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

  const isOrganizer =
    session.account &&
    overview?.organizer &&
    session.account.toLowerCase() === overview.organizer.toLowerCase();

  async function lookUp(event) {
    event.preventDefault();
    setError("");
    setTransaction(null);
    const tokenId = BigInt(query.trim() || "0");
    if (tokenId <= 0n) {
      setResult(null);
      setError("Enter the ticket number on the student's pass.");
      return;
    }
    setBusy(true);
    try {
      const ticket = await readTicket(tokenId);
      setResult(ticket);
      if (!ticket) setError("Ticket not found. Check the number and try again.");
    } catch (err) {
      setResult(null);
      setError(explainError(err));
    } finally {
      setBusy(false);
    }
  }

  async function checkIn() {
    if (!result || busy || !isOrganizer) return;
    setBusy(true);
    setError("");
    let confirmed = false;
    try {
      await session.requireSepolia();
      const hash = await admitStudent(result.tokenId);
      confirmed = true;
      setTransaction({ hash, tokenId: result.tokenId });
      session.noteActivity({ hash, tokenId: result.tokenId, kind: "checked in" });
      const next = await readTicket(result.tokenId);
      if (next) setResult(next);
      else setError("Check-in succeeded, but the updated ticket could not be read. Look up the ticket again.");
    } catch (err) {
      setError(confirmed
        ? "Check-in succeeded, but the updated ticket could not be read. Look up the ticket again."
        : explainError(err));
    } finally {
      setBusy(false);
    }
  }

  const canCheckIn = Boolean(isOrganizer && result?.state === 1 && !busy && !session.wrongNetwork && !transaction);
  const notice = error || (session.wrongNetwork ? WRONG_NETWORK_MESSAGE : "");

  return (
    <section className="door">
      <p className="kicker">03 / Organizer check-in</p>
      <h1>At the door.</h1>
      <p className="deck">Look up a ticket. Confirm its current holder. Check them in once.</p>
      <div className="stats">
        <p>
          <strong>{overview ? String(overview.seatCap) : "50"}</strong>
          <span>Total capacity</span>
        </p>
        <p>
          <strong>{overview ? String(overview.remaining) : "—"}</strong>
          <span>Seats available</span>
        </p>
      </div>
      <div className="split door-grid">
        <form className="panel" onSubmit={lookUp}>
          <h2>Find a ticket</h2>
          <p className="deck">Use the number on the student's pass.</p>
          <label className="field">
            Ticket ID
            <input
              inputMode="numeric"
              value={query}
              onChange={(event) => setQuery(event.target.value.replace(/\D/g, ""))}
              placeholder="12"
            />
          </label>
          <button className="btn btn-dark" type="submit" disabled={busy}>
            {busy ? "Looking up..." : "Look up ticket"}
          </button>
          <p className="fine">Only the deploying organizer wallet can confirm check-in.</p>
          {session.account && overview && !isOrganizer && (
            <p className="alert" role="alert">Organizer wallet required. Connect the wallet that deployed this contract to check in tickets.</p>
          )}
          {!session.account && (
            <button className="btn btn-light" type="button" onClick={session.openWallet}>
              Connect wallet
            </button>
          )}
        </form>
        <article className="result">
          {result ? (
            <>
              <div className="result-top">
                <h2>Ticket #{ticketNumber(result.tokenId)}</h2>
                <p className="kicker">{STATE_LABEL[result.state] || "Unknown"}</p>
              </div>
              <hr />
              <p className="kicker">Current holder</p>
              <p className="mono holder">{shortAddress(result.owner)}</p>
              <p className="mono full">{result.owner}</p>
              <p className="deck">
                {result.state === 1
                  ? "Ask the student to show this wallet. After check-in, this ticket cannot be transferred or returned."
                  : result.state === 2
                    ? "This ticket has already been used. It cannot be checked in again."
                    : "This ticket has been returned and is waiting to be claimed again."}
              </p>
              <button className="btn btn-dark" type="button" disabled={!canCheckIn} onClick={checkIn}>
                {result.state === 2 ? "Already checked in" : busy ? "Waiting for the wallet..." : "Confirm check-in"}
              </button>
            </>
          ) : (
            <>
              <h2>Ticket</h2>
              <p className="deck">The holder and status appear here after a lookup.</p>
            </>
          )}
          {transaction && (
            <Status
              hintText={`Ticket #${ticketNumber(transaction.tokenId)} checked in successfully.`}
              transactionId={transaction.hash}
            />
          )}
          {notice && <p className="alert" role="alert">{notice}</p>}
        </article>
      </div>
    </section>
  );
}
