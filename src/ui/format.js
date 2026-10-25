export function shortAddress(value) {
  if (!value || value.length < 10) return value || "";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function ticketNumber(id) {
  if (id === undefined || id === null || id === "" || id === 0 || id === 0n) return "";
  return String(id).padStart(3, "0");
}

export function explainError(error) {
  const code = error?.code;
  if (code === 4001 || code === "ACTION_REJECTED") return "The request was rejected in the wallet.";
  if (code === "NO_WALLET") return "Install MetaMask, then try again.";
  const text = `${error?.shortMessage || ""} ${error?.reason || ""} ${error?.message || ""}`;
  const known = [
    ["AlreadyHasTicket", "This wallet already holds an active ticket."],
    ["AlreadyEntered", "This wallet has already been checked in."],
    ["SoldOut", "This event is sold out."],
    ["OrganizerOnly", "Only the organizer wallet can check a ticket in."],
    ["HolderOnly", "Only the current holder can do this."],
    ["TicketNotActive", "This ticket is not active."],
    ["InvalidRecipient", "That address cannot receive this ticket."],
    ["user rejected", "The request was rejected in the wallet."],
  ];
  for (const [needle, sentence] of known) {
    if (text.includes(needle)) return sentence;
  }
  return "Something went wrong. You can try again.";
}
