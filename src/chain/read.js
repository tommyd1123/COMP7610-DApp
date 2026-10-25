// 负责人：成员 5。只放不花 gas 的查询。
import { Contract, JsonRpcProvider } from "ethers";
import { CONTRACT_ADDRESS, TICKET_ABI } from "../config/contract.js";

const provider = new JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com", 11155111);
const tickets = new Contract(CONTRACT_ADDRESS, TICKET_ABI, provider);
const FROM_BLOCK = 11984380;

export async function readOverview() {
  const [remaining, seatCap, organizer] = await Promise.all([
    tickets.remaining(),
    tickets.seatCap(),
    tickets.organizer(),
  ]);
  return { remaining, seatCap, organizer };
}

export async function readRemaining() {
  return tickets.remaining();
}

export async function readTicketFor(account) {
  const [active, entered] = await Promise.all([
    tickets.activeTicketOf(account),
    tickets.enteredTicketOf(account),
  ]);
  const tokenId = active === 0n ? entered : active;
  if (tokenId === 0n) {
    return { tokenId: 0n, state: null, owner: "", active: false, entered: false };
  }
  const [state, owner] = await Promise.all([
    tickets.ticketState(tokenId),
    tickets.ownerOf(tokenId),
  ]);
  return {
    tokenId,
    state: Number(state),
    owner,
    active: active !== 0n,
    entered: entered !== 0n,
  };
}

export async function readTicket(tokenId) {
  try {
    const [state, owner] = await Promise.all([
      tickets.ticketState(tokenId),
      tickets.ownerOf(tokenId),
    ]);
    return { tokenId, state: Number(state), owner };
  } catch {
    return null;
  }
}

export async function readActivity(account) {
  try {
    const [claimed, transferred, returned, admitted] = await Promise.all([
      tickets.queryFilter(tickets.filters.TicketClaimed(account), FROM_BLOCK),
      tickets.queryFilter(tickets.filters.TicketTransferred(null, account), FROM_BLOCK),
      tickets.queryFilter(tickets.filters.TicketReturned(account), FROM_BLOCK),
      tickets.queryFilter(tickets.filters.TicketAdmitted(account), FROM_BLOCK),
    ]);
    const sent = await tickets.queryFilter(tickets.filters.TicketTransferred(account, null), FROM_BLOCK);
    const logs = [
      ...claimed.map((log) => ({ log, kind: "claimed" })),
      ...transferred.map((log) => ({ log, kind: "received" })),
      ...returned.map((log) => ({ log, kind: "returned" })),
      ...admitted.map((log) => ({ log, kind: "checked in" })),
      ...sent.map((log) => ({ log, kind: "transferred" })),
    ];
    logs.sort((a, b) => a.log.blockNumber - b.log.blockNumber || a.log.index - b.log.index);
    const latest = logs.at(-1);
    if (!latest) return null;
    return {
      kind: latest.kind,
      hash: latest.log.transactionHash,
      tokenId: latest.log.args.tokenId,
    };
  } catch {
    return null;
  }
}
