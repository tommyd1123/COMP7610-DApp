import { useEffect, useState } from "react";
import { isAddress } from "ethers";
import { CONTRACT_ADDRESS, SEPOLIA_EXPLORER_URL } from "../config/contract.js";
import { readActivity, readTicketFor } from "../chain/read.js";
import { explainError, shortAddress, ticketNumber, WRONG_NETWORK_MESSAGE } from "../ui/format.js";
import { useSession } from "../ui/session.jsx";
import { returnTicket, transferTicket } from "../wallet/ethereum.js";

export function TicketPage() {
  const session = useSession();
  // Remount wallet-specific state, dialogs and pending reads on account changes.
  return <AccountTicket key={session.account.toLowerCase()} session={session} />;
}

function AccountTicket({ session }) {
  const [ticket, setTicket] = useState(null);
  const [chainActivity, setChainActivity] = useState(null);
  const [dialog, setDialog] = useState("");
  const [recipient, setRecipient] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ticketError, setTicketError] = useState("");
  const [loading, setLoading] = useState(() => Boolean(session.account));
  // Confirmed wallet receipts remain available even if the RPC is slow or fails.
  const activity = session.activity || chainActivity;
  const receipt = activity?.hash ? <TicketActivity activity={activity} /> : null;

  useEffect(() => {
    if (!session.account) {
      setTicket(null);
      setLoading(false);
      return undefined;
    }
    let ignore = false;
    setLoading(true);
    setTicket(null);
    setTicketError("");
    readTicketFor(session.account)
      .then((nextTicket) => {
        if (!ignore) setTicket(nextTicket);
      })
      .catch(() => {
        if (!ignore) setTicketError("This ticket could not be read. Refresh and try again.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [session.account, session.revision]);

  useEffect(() => {
    if (!session.account) return undefined;
    let ignore = false;
    readActivity(session.account)
      .then((nextActivity) => {
        if (!ignore) setChainActivity(nextActivity);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [session.account, session.revision]);

  const number = ticketNumber(ticket?.tokenId);
  const active = Boolean(ticket?.active);
  const keepsake = Boolean(ticket?.entered && !ticket?.active);
  const notice = error || ticketError || (session.wrongNetwork ? WRONG_NETWORK_MESSAGE : "");

  function openDialog(kind) {
    setError("");
    setFieldError("");
    setDialog(kind);
  }

  function closeDialog() {
    if (busy) return;
    setDialog("");
    setFieldError("");
    setError("");
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
      await session.requireSepolia();
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
      await session.requireSepolia();
      const hash = await returnTicket(ticket.tokenId);
      session.noteActivity({ hash, tokenId: ticket.tokenId, kind: "returned" });
      setDialog("");
    } catch (err) {
      setError(explainError(err));
    } finally {
      setBusy(false);
    }
  }

  if (session.account && loading) {
    return (
      <section className="ticket-page">
        <div className="ticket-empty" aria-busy="true">
          <div className="empty-stack">
            <div className="spinner" role="status" aria-label="Loading your ticket" />
            {receipt}
          </div>
        </div>
      </section>
    );
  }

  if (!active && !keepsake) {
    return (
      <section className="ticket-empty">
        <div className="empty-stack">
          <h2>{!session.account ? "Connect to see your ticket." : ticketError ? "Ticket status unavailable." : "Nothing to manage."}</h2>
          <p className="deck">
            {!session.account
              ? "A connected wallet can hold, transfer, or return one ticket."
              : ticketError
                ? "Refresh to check this wallet's current ticket."
                : "This wallet does not hold an active or checked-in ticket."}
          </p>
          {session.account ? (
            <a className="btn btn-dark" href="#claim">
              Back to the event
            </a>
          ) : (
            <button className="btn btn-dark" type="button" onClick={session.openWallet}>
              Connect wallet
            </button>
          )}
          {notice && <p className="alert" role="alert">{notice}</p>}
          {receipt}
        </div>
      </section>
    );
  }

  return (
    <section className="ticket-page">
      <div className="split">
        <div>
          <p className="kicker">02 / My ticket</p>
          <h1>{keepsake ? "A moment to keep." : "Your seat, secured."}</h1>
          <p className="deck">
            {keepsake
              ? "You have checked in. Your NFT stays with you as a keepsake."
              : "Keep it for yourself, pass it to a friend, or make room for someone else."}
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
          ) : null}
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
              <button className="btn btn-dark" type="button" onClick={() => openDialog("transfer")}>
                Transfer ticket
              </button>
              <button className="btn btn-light" type="button" onClick={() => openDialog("return")}>
                Return to organizer
              </button>
              <p className="fine">
                Transferring keeps the seat reserved.
                <br />
                Returning makes one seat available again.
              </p>
            </>
          ) : null}
          {!dialog && notice && <p className="alert" role="alert">{notice}</p>}
        </aside>
      </div>
      {receipt || (
        <div className="activity">
          <p>Ticket #{number} {keepsake ? "checked in" : "is active"}</p>
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
                <button className="btn btn-dark" type="button" disabled={busy || session.wrongNetwork} onClick={confirmTransfer}>
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
                <button className="btn btn-dark" type="button" disabled={busy || session.wrongNetwork} onClick={confirmReturn}>
                  {busy ? "Waiting for the wallet..." : "Confirm return"}
                </button>
              </>
            )}
            {notice && <p className="alert" role="alert">{notice}</p>}
            <button className="btn btn-light" type="button" disabled={busy} onClick={closeDialog}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function TicketActivity({ activity }) {
  return (
    <div className="activity" role="status">
      <p>Confirmed / Ticket #{ticketNumber(activity.tokenId)} {activity.kind}</p>
      <a href={`${SEPOLIA_EXPLORER_URL}/tx/${activity.hash}`} target="_blank" rel="noreferrer">
        View transaction on Etherscan
      </a>
    </div>
  );
}
