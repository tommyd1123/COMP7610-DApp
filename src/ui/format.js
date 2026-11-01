export function shortAddress(value) {
  if (!value || value.length < 10) return value || "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function ticketNumber(id) {
  if (id === undefined || id === null || id === "" || id === 0 || id === 0n) return "";
  return String(id).padStart(3, "0");
}

export const WRONG_NETWORK_MESSAGE = "Wrong network. Switch to Sepolia in MetaMask to continue.";

export function explainError(error) {
  // ethers may wrap MetaMask's error under info.error or error.data.originalError.
  const errors = [];
  const pending = [error];
  const seen = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    errors.push(current);
    pending.push(current.error, current.info?.error, current.data, current.originalError, current.cause);
  }
  const codes = errors.map((entry) => String(entry.code || ""));
  if (codes.includes("4001") || codes.includes("ACTION_REJECTED")) {
    return "The request was rejected in MetaMask. You can try again.";
  }
  if (codes.includes("NO_WALLET")) return "Install MetaMask, then try again.";
  if (codes.includes("WRONG_NETWORK") || codes.includes("4902")) return WRONG_NETWORK_MESSAGE;
  const text = errors
    .map((entry) => `${entry.shortMessage || ""} ${entry.reason || ""} ${entry.message || ""} ${entry.revert?.name || ""}`)
    .join(" ")
    .toLowerCase();
  const known = [
    ["AlreadyHasTicket", "This wallet already holds an active ticket."],
    ["AlreadyEntered", "This wallet has already been checked in."],
    ["SoldOut", "This event is sold out."],
    ["OrganizerOnly", "Only the organizer wallet can check a ticket in."],
    ["HolderOnly", "Only the current holder can do this."],
    ["TicketNotActive", "This ticket is not active."],
    ["InvalidRecipient", "That address cannot receive this ticket."],
    ["user rejected", "The request was rejected in MetaMask. You can try again."],
    ["user denied", "The request was rejected in MetaMask. You can try again."],
    ["wrong network", WRONG_NETWORK_MESSAGE],
    ["network changed", WRONG_NETWORK_MESSAGE],
    ["chain mismatch", WRONG_NETWORK_MESSAGE],
  ];
  for (const [needle, sentence] of known) {
    if (text.includes(needle.toLowerCase())) return sentence;
  }
  return "Something went wrong. You can try again.";
}
