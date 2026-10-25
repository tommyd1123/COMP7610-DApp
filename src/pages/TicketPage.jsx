import { useEffect, useState } from "react";
import { isAddress } from "ethers";
import { CONTRACT_ADDRESS, SEPOLIA_EXPLORER_URL } from "../config/contract.js";
import { readActivity, readTicketFor } from "../chain/read.js";
import { explainError, shortAddress, ticketNumber } from "../ui/format.js";
import { useSession } from "../ui/session.jsx";
import { returnTicket, transferTicket } from "../wallet/ethereum.js";

export function TicketPage() {
  const session = useSession();
  const [ticket, setTicket] = useState(null);
  const [activity, setActivity] = useState(session.activity);
  const [dialog, setDialog] = useState("");
  const [recipient, setRecipient] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session.account) {
      setTicket(null);
      return undefined;
    }
    let ignore = false;
    Promise.all([readTicketFor(session.account), readActivity(session.account)])
      .then(([nextTicket, nextActivity]) => {
        if (ignore) return;
        setTicket(nextTicket);
        setActivity(session.activity?.hash ? session.activity : nextActivity);
      })
      .catch(() => {
        if (!ignore) setError("This ticket could not be read. Refresh and try again.");
      });
    return () => {
      ignore = true;
    };
  }, [session.account, session.revision, session.activity]);

  const number = ticketNumber(ticket?.tokenId);
  const active = Boolean(ticket?.active);
  const keepsake = Boolean(ticket?.entered && !ticket?.active);

  function closeDialog() {
    if (busy) return;
    setDialog("");
    setFieldError("");
  }

  function recipientProblem() {
    const value = recipient.trim();
    if (!isAddress(value)) return "Enter the full recipient address.";
    const next = value.toLowerCase();
    if (next === session.account.toLowerCase()) return "You cannot transfer a ticket to yourself.";
    if (session.organizer && next === session.organizer.toLowerCase()) {
      return "Use return to send the ticket back to the organizer.";
    }
    if (next === CONTRACT_ADDRESS.toLowerCase()) return "That address cannot receive this ticket.";
    if (next === "0x0000000000000000000000000000000000000000") return "Enter a real wallet address.";
    return "";
  }

  async function confirmTransfer() {
    const problem = recipientProblem();
    if (problem) {
      setFieldError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const hash = await transferTicket(recipient.trim(), ticket.tokenId);
      session.noteActivity({ hash, tokenId: ticket.tokenId, kind: "transferred" });
      setDialog("");
      setRecipient("");
    } catch (err) {
      setError(explainError(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmReturn() {
    setBusy(true);
    setError("");
    try {
      const hash = await returnTicket(ticket.tokenId);
      session.noteActivity({ hash, tokenId: ticket.tokenId, kind: "returned" });
      setDialog("");
    } catch (err) {
      setError(explainError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ticket-page">
      <div className="split">
        <div>
          <p className="kicker">02 / My ticket</p>
          <h1>
            {keepsake ? "A moment to keep." : active ? "Your seat, secured." : "No active ticket."}
          </h1>
          <p className="deck">
            {keepsake
              ? "You have checked in. Your NFT stays with you as a keepsake."
              : active
                ? "Keep it for yourself, pass it to a friend, or make room for someone else."
                : "Claim a seat, or this wallet has already passed its ticket on."}
          </p>
          {active || keepsake ? (
            <article className="pass">
              <div className="pass-top">
                <p>Seat. / Campus seminar</p>
                <p>{keepsake ? "Checked in" : "Active ticket"}</p>
              </div>
              <div className="pass-number">
                <p className="mega">{number}</p>
                <p>
                  Entry pass
                  <br />
                  of 50 seats
                </p>
              </div>
              <hr />
              <div className="pass-foot">
                <div>
                  <p className="kicker on-dark">Current holder</p>
                  <p className="mono">{shortAddress(ticket.owner || session.account)}</p>
                </div>
                <p>{keepsake ? "A keepsake of your visit." : "Valid until check-in."}</p>
              </div>
            </article>
          ) : (
            <div className="empty-pass">
              {session.account ? (
                <a className="btn btn-dark" href="#claim">
                  Back to the event
                </a>
              ) : (
                <button className="btn btn-dark" type="button" onClick={session.openWallet}>
                  Connect wallet
                </button>
              )}
            </div>
          )}
        </div>
        <aside className="plans">
          {keepsake ? (
            <>
              <h2>You're checked in.</h2>
              <p className="deck">
                This ticket has been used.
                <br />
                It cannot be transferred, returned, or used again.
              </p>
              <button className="btn btn-quiet" type="button" disabled>
                Transfer unavailable
              </button>
              <button className="btn btn-quiet" type="button" disabled>
                Return unavailable
              </button>
              <p className="fine">An admitted wallet cannot claim or receive another ticket.</p>
            </>
          ) : active ? (
            <>
              <h2>A change of plans?</h2>
              <p className="deck">
                Manage your ticket before check-in.
                <br />
                The entry right follows the current holder.
              </p>
              <button className="btn btn-dark" type="button" onClick={() => setDialog("transfer")}>
                Transfer ticket
              </button>
              <button className="btn btn-light" type="button" onClick={() => setDialog("return")}>
                Return to organizer
              </button>
              <p className="fine">
                Transferring keeps the seat reserved.
                <br />
                Returning makes one seat available again.
              </p>
            </>
          ) : (
            <>
              <h2>{session.account ? "Nothing to manage." : "Connect to see your ticket."}</h2>
              <p className="deck">
                {session.account
                  ? "This wallet does not hold an active or checked-in ticket."
                  : "A connected wallet can hold, transfer, or return one ticket."}
              </p>
            </>
          )}
          {error && <p className="alert">{error}</p>}
        </aside>
      </div>
      {(active || keepsake) && (
        <div className="activity">
          <p>
            Recent activity / Ticket #{number} {activity?.kind || (keepsake ? "checked in" : "is active")}
          </p>
          {activity?.hash && (
            <a href={`${SEPOLIA_EXPLORER_URL}/tx/${activity.hash}`} target="_blank" rel="noreferrer">
              View transaction
            </a>
          )}
        </div>
      )}
      {dialog && (
        <div className="modal-back" role="presentation" onClick={closeDialog}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            {dialog === "transfer" ? (
              <>
                <h2 id="ticket-dialog-title">Transfer ticket</h2>
                <p className="deck">The entry right follows the current holder. Confirm the full address.</p>
                <label className="field">
                  Recipient address
                  <input
                    value={recipient}
                    onChange={(event) => {
                      setRecipient(event.target.value);
                      setFieldError("");
                    }}
                    placeholder="0x"
                    autoComplete="off"
                    spellCheck="false"
                  />
                </label>
                {fieldError && <p className="alert">{fieldError}</p>}
                <button className="btn btn-dark" type="button" disabled={busy} onClick={confirmTransfer}>
                  {busy ? "Waiting for the wallet..." : "Confirm transfer"}
                </button>
              </>
            ) : (
              <>
                <h2 id="ticket-dialog-title">Return to organizer</h2>
                <p className="deck">
                  This sends the NFT back to the organizer and cancels entry. The ticket is free, so there is no
                  refund.
                </p>
                <p className="mono full">{session.organizer}</p>
                <button className="btn btn-dark" type="button" disabled={busy} onClick={confirmReturn}>
                  {busy ? "Waiting for the wallet..." : "Confirm return"}
                </button>
              </>
            )}
            <button className="btn btn-light" type="button" disabled={busy} onClick={closeDialog}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
