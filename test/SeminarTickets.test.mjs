import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { BrowserProvider, ContractFactory, ZeroAddress } from "ethers";
import { compileContracts } from "../scripts/compile-contract.mjs";

const require = createRequire(import.meta.url);
const { network } = require("hardhat");
let compiled;
let provider;
let accounts;
let addresses;
let tickets;
let ticketAddress;

before(async () => {
  compiled = await compileContracts({ includeTests: true });
});

beforeEach(async () => {
  await network.provider.request({ method: "hardhat_reset", params: [] });
  provider = new BrowserProvider(network.provider, undefined, { cacheTimeout: -1 });
  accounts = await Promise.all(Array.from({ length: 60 }, (_, index) => provider.getSigner(index)));
  addresses = await Promise.all(accounts.map((account) => account.getAddress()));
  tickets = await deploy("contracts/SeminarTickets.sol", "SeminarTickets");
  ticketAddress = await tickets.getAddress();
});

async function deploy(sourceName, name, args = [], signer = accounts[0]) {
  const artifact = compiled[sourceName][name];
  const factory = new ContractFactory(artifact.abi, `0x${artifact.evm.bytecode.object}`, signer);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function mined(transaction) {
  return (await transaction).wait();
}

async function claim(index) {
  const receipt = await mined(tickets.connect(accounts[index]).claim());
  return { tokenId: await tickets.activeTicketOf(addresses[index]), receipt };
}

async function receiver() {
  return deploy("test/fixtures/TicketReceivers.sol", "TicketReceiver", [ticketAddress]);
}

function event(receipt, name) {
  const matches = receipt.logs.flatMap((log) => {
    if (log.address.toLowerCase() !== ticketAddress.toLowerCase()) return [];
    try {
      const parsed = tickets.interface.parseLog(log);
      return parsed?.name === name ? [parsed] : [];
    } catch {
      return [];
    }
  });
  assert.equal(matches.length, 1, `Expected exactly one ${name} event`);
  return [...matches[0].args];
}

async function reverted(action, expectedError) {
  let caught;
  try {
    const result = await action();
    if (result?.wait) await result.wait();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, `Expected ${expectedError ?? "a revert"}`);
  assert.ok(
    caught.code === "CALL_EXCEPTION" || /revert|VM Exception/i.test(caught.message),
    `Expected an EVM revert, got: ${caught.message}`,
  );
  if (expectedError) {
    const candidates = [caught.data, caught.error?.data, caught.info?.error?.data];
    const names = candidates.flatMap((data) => {
      if (data && typeof data === "object") data = data.data;
      if (typeof data !== "string") return [];
      try {
        return [tickets.interface.parseError(data)?.name];
      } catch {
        return [];
      }
    });
    assert.ok(
      names.includes(expectedError) || caught.message.includes(expectedError),
      `Expected ${expectedError}, got: ${caught.message}`,
    );
  }
  return caught;
}

async function invariant() {
  const minted = await tickets.totalMinted();
  assert.ok(minted <= 50n);
  let available = 0n;
  let active = 0n;
  let used = 0n;
  const activeOwners = new Set();
  for (let tokenId = 1n; tokenId <= minted; tokenId++) {
    const owner = await tickets.ownerOf(tokenId);
    const state = await tickets.ticketState(tokenId);
    if (state === 0n) {
      available++;
      assert.equal(owner, addresses[0], "Returned inventory belongs to organizer");
    } else if (state === 1n) {
      active++;
      assert.notEqual(owner, addresses[0]);
      assert.ok(!activeOwners.has(owner), "At most one active ticket per owner");
      activeOwners.add(owner);
      assert.equal(await tickets.activeTicketOf(owner), tokenId);
      assert.equal(await tickets.hasEntered(owner), false);
    } else if (state === 2n) {
      used++;
      assert.notEqual(owner, addresses[0]);
      assert.equal(await tickets.activeTicketOf(owner), 0n);
      assert.equal(await tickets.enteredTicketOf(owner), tokenId);
      assert.equal(await tickets.hasEntered(owner), true);
    } else {
      assert.fail(`Unknown state ${state}`);
    }
  }
  assert.equal(available + active + used, minted);
  assert.equal(await tickets.activeCount(), active);
  assert.equal(await tickets.usedCount(), used);
  assert.equal(await tickets.remaining() + active + used, 50n);
  assert.equal(await tickets.activeTicketOf(addresses[0]), 0n);
  assert.equal(await tickets.hasEntered(addresses[0]), false);
}

test("initial state, metadata, ERC-721 support, and nonexistent ticket queries", async () => {
  assert.equal(await tickets.name(), "Seminar Tickets");
  assert.equal(await tickets.symbol(), "SEAT");
  assert.equal(await tickets.organizer(), addresses[0]);
  assert.equal(await tickets.seatCap(), 50n);
  assert.equal(await tickets.remaining(), 50n);
  assert.equal(await tickets.totalMinted(), 0n);
  assert.equal(await tickets.enteredTicketOf(addresses[1]), 0n);
  assert.equal(await tickets.supportsInterface("0x80ac58cd"), true);
  for (const tokenId of [0n, 1n, 999n]) {
    await reverted(() => tickets.ownerOf(tokenId), "ERC721NonexistentToken");
    await reverted(() => tickets.ticketState(tokenId), "ERC721NonexistentToken");
  }
  await invariant();
});

test("claim mints one active ticket and emits business and ERC-721 events", async () => {
  const { tokenId, receipt } = await claim(1);
  assert.equal(tokenId, 1n);
  assert.equal(await tickets.ownerOf(tokenId), addresses[1]);
  assert.equal(await tickets.balanceOf(addresses[1]), 1n);
  assert.equal(await tickets.remaining(), 49n);
  assert.deepEqual(event(receipt, "TicketClaimed"), [addresses[1], tokenId, false]);
  assert.deepEqual(event(receipt, "Transfer"), [ZeroAddress, addresses[1], tokenId]);
  await invariant();
});

test("organizer and an existing holder cannot claim; failures preserve state", async () => {
  await reverted(() => tickets.claim(), "InvalidRecipient");
  await claim(1);
  await reverted(() => tickets.connect(accounts[1]).claim(), "AlreadyHasTicket");
  assert.equal(await tickets.totalMinted(), 1n);
  await invariant();
});

test("holder transfers the same ticket; sender can claim again", async () => {
  const { tokenId } = await claim(1);
  const receipt = await mined(tickets.connect(accounts[1]).transferTicket(addresses[2], tokenId));
  assert.equal(await tickets.activeTicketOf(addresses[1]), 0n);
  assert.equal(await tickets.activeTicketOf(addresses[2]), tokenId);
  assert.equal(await tickets.ownerOf(tokenId), addresses[2]);
  assert.equal(await tickets.remaining(), 49n);
  assert.deepEqual(event(receipt, "TicketTransferred"), [addresses[1], addresses[2], tokenId]);
  assert.deepEqual(event(receipt, "Transfer"), [addresses[1], addresses[2], tokenId]);
  assert.equal((await claim(1)).tokenId, 2n);
  await invariant();
});

test("wrapper rejects invalid recipients, occupied addresses, and nonholders", async () => {
  const { tokenId } = await claim(1);
  await claim(2);
  await reverted(() => tickets.connect(accounts[1]).transferTicket(ZeroAddress, tokenId), "ERC721InvalidReceiver");
  for (const recipient of [addresses[1], addresses[0], ticketAddress]) {
    await reverted(() => tickets.connect(accounts[1]).transferTicket(recipient, tokenId), "InvalidRecipient");
  }
  await reverted(() => tickets.connect(accounts[1]).transferTicket(addresses[2], tokenId), "AlreadyHasTicket");
  await reverted(() => tickets.connect(accounts[2]).transferTicket(addresses[3], tokenId), "HolderOnly");
  await reverted(() => tickets.connect(accounts[2]).returnTicket(tokenId), "HolderOnly");
  await mined(tickets.connect(accounts[1]).approve(addresses[3], tokenId));
  await reverted(() => tickets.connect(accounts[3]).transferTicket(addresses[4], tokenId), "HolderOnly");
  await reverted(() => tickets.connect(accounts[3]).returnTicket(tokenId), "HolderOnly");
  await invariant();
});

test("return releases exactly one seat; next claim reuses token and clears approval", async () => {
  const { tokenId } = await claim(1);
  await mined(tickets.connect(accounts[1]).approve(addresses[3], tokenId));
  const receipt = await mined(tickets.connect(accounts[1]).returnTicket(tokenId));
  assert.equal(await tickets.ownerOf(tokenId), addresses[0]);
  assert.equal(await tickets.ticketState(tokenId), 0n);
  assert.equal(await tickets.activeTicketOf(addresses[1]), 0n);
  assert.equal(await tickets.remaining(), 50n);
  assert.equal(await tickets.getApproved(tokenId), ZeroAddress);
  assert.deepEqual(event(receipt, "TicketReturned"), [addresses[1], tokenId]);
  assert.deepEqual(event(receipt, "Transfer"), [addresses[1], addresses[0], tokenId]);
  await reverted(() => tickets.connect(accounts[1]).returnTicket(tokenId));
  await reverted(() => tickets.admit(tokenId), "TicketNotActive");
  await invariant();
  const reclaimed = await claim(2);
  assert.equal(reclaimed.tokenId, tokenId);
  assert.equal(await tickets.totalMinted(), 1n);
  assert.deepEqual(event(reclaimed.receipt, "TicketClaimed"), [addresses[2], tokenId, true]);
  assert.deepEqual(event(reclaimed.receipt, "Transfer"), [addresses[0], addresses[2], tokenId]);
  await reverted(() => tickets.connect(accounts[3]).transferFrom(addresses[2], addresses[4], tokenId), "ERC721InsufficientApproval");
  await invariant();
});

test("return pool reuses multiple tokens once in LIFO order before minting", async () => {
  const first = (await claim(1)).tokenId;
  const second = (await claim(2)).tokenId;
  await mined(tickets.connect(accounts[1]).returnTicket(first));
  await mined(tickets.connect(accounts[2]).returnTicket(second));
  assert.equal((await claim(3)).tokenId, second);
  assert.equal((await claim(4)).tokenId, first);
  assert.equal((await claim(5)).tokenId, 3n);
  await mined(tickets.connect(accounts[3]).returnTicket(second));
  assert.equal((await claim(3)).tokenId, second, "A returner may reclaim");
  assert.equal(await tickets.totalMinted(), 3n);
  await invariant();
});

test("only organizer admits current holder; used ticket remains as a souvenir", async () => {
  const { tokenId } = await claim(1);
  await mined(tickets.connect(accounts[1]).transferTicket(addresses[2], tokenId));
  await reverted(() => tickets.connect(accounts[1]).admit(tokenId), "OrganizerOnly");
  const receipt = await mined(tickets.admit(tokenId));
  assert.deepEqual(event(receipt, "TicketAdmitted"), [addresses[2], tokenId]);
  assert.equal(await tickets.ownerOf(tokenId), addresses[2]);
  assert.equal(await tickets.balanceOf(addresses[2]), 1n);
  assert.equal(await tickets.ticketState(tokenId), 2n);
  assert.equal(await tickets.hasEntered(addresses[1]), false);
  assert.equal(await tickets.hasEntered(addresses[2]), true);
  assert.equal(await tickets.enteredTicketOf(addresses[2]), tokenId);
  assert.equal(await tickets.activeTicketOf(addresses[2]), 0n);
  assert.equal(await tickets.remaining(), 49n);
  await reverted(() => tickets.admit(tokenId), "TicketNotActive");
  await reverted(() => tickets.connect(accounts[2]).returnTicket(tokenId), "TicketNotActive");
  await reverted(() => tickets.connect(accounts[2]).transferTicket(addresses[3], tokenId), "TicketNotActive");
  await reverted(() => tickets.connect(accounts[2]).claim(), "AlreadyEntered");
  const another = (await claim(1)).tokenId;
  await reverted(() => tickets.connect(accounts[1]).transferTicket(addresses[2], another), "AlreadyEntered");
  await invariant();
});

test("missing tickets cannot be returned, transferred, or admitted", async () => {
  await reverted(() => tickets.connect(accounts[1]).returnTicket(0n), "ERC721NonexistentToken");
  await reverted(() => tickets.connect(accounts[1]).transferTicket(addresses[2], 99n), "ERC721NonexistentToken");
  await reverted(() => tickets.admit(99n), "ERC721NonexistentToken");
  await invariant();
});

test("50 occupied seats sell out; used seats stay occupied; returned seats reopen", async () => {
  for (let index = 1; index <= 50; index++) await claim(index);
  assert.equal(await tickets.remaining(), 0n);
  assert.equal(await tickets.totalMinted(), 50n);
  await reverted(() => tickets.connect(accounts[51]).claim(), "SoldOut");
  await mined(tickets.admit(1n));
  await reverted(() => tickets.connect(accounts[51]).claim(), "SoldOut");
  await mined(tickets.connect(accounts[2]).returnTicket(2n));
  assert.equal(await tickets.remaining(), 1n);
  assert.equal((await claim(51)).tokenId, 2n);
  assert.equal(await tickets.totalMinted(), 50n);
  await reverted(() => tickets.connect(accounts[52]).claim(), "SoldOut");
  await invariant();
});

const standardEntrypoints = [
  "transferFrom(address,address,uint256)",
  "safeTransferFrom(address,address,uint256)",
  "safeTransferFrom(address,address,uint256,bytes)",
];

function standardTransfer(signer, entrypoint, from, to, tokenId) {
  const args = [from, to, tokenId];
  if (entrypoint.endsWith(",bytes)")) args.push("0x1234");
  return tickets.connect(signer)[entrypoint](...args);
}

for (const entrypoint of standardEntrypoints) {
  test(`${entrypoint}: approved transfer obeys authorization and receiver eligibility`, async () => {
    const { tokenId } = await claim(1);
    await claim(2);
    await reverted(() => standardTransfer(accounts[3], entrypoint, addresses[1], addresses[4], tokenId), "ERC721InsufficientApproval");
    await mined(tickets.connect(accounts[1]).approve(addresses[3], tokenId));
    for (const recipient of [ZeroAddress, addresses[1], ticketAddress]) {
      await reverted(() => standardTransfer(accounts[3], entrypoint, addresses[1], recipient, tokenId));
    }
    await reverted(() => standardTransfer(accounts[3], entrypoint, addresses[1], addresses[2], tokenId), "AlreadyHasTicket");
    await mined(tickets.admit(2n));
    await reverted(() => standardTransfer(accounts[3], entrypoint, addresses[1], addresses[2], tokenId), "AlreadyEntered");
    const receipt = await mined(standardTransfer(accounts[3], entrypoint, addresses[1], addresses[4], tokenId));
    assert.deepEqual(event(receipt, "TicketTransferred"), [addresses[1], addresses[4], tokenId]);
    assert.equal(await tickets.activeTicketOf(addresses[1]), 0n);
    assert.equal(await tickets.activeTicketOf(addresses[4]), tokenId);
    assert.equal(await tickets.getApproved(tokenId), ZeroAddress);
    await mined(tickets.connect(accounts[4]).setApprovalForAll(addresses[3], true));
    await mined(standardTransfer(accounts[3], entrypoint, addresses[4], addresses[5], tokenId));
    assert.equal(await tickets.activeTicketOf(addresses[4]), 0n);
    assert.equal(await tickets.activeTicketOf(addresses[5]), tokenId);
    await invariant();
  });

  test(`${entrypoint}: incorrect from reverts all ownership, mapping, approval, and pool changes`, async () => {
    const { tokenId } = await claim(1);
    await mined(tickets.connect(accounts[1]).approve(addresses[3], tokenId));
    for (const destination of [addresses[2], addresses[0]]) {
      await reverted(() => standardTransfer(accounts[3], entrypoint, addresses[4], destination, tokenId), "ERC721IncorrectOwner");
      assert.equal(await tickets.ownerOf(tokenId), addresses[1]);
      assert.equal(await tickets.activeTicketOf(addresses[1]), tokenId);
      assert.equal(await tickets.activeTicketOf(destination), 0n);
      assert.equal(await tickets.getApproved(tokenId), addresses[3]);
      assert.equal(await tickets.remaining(), 49n);
    }
    assert.equal((await claim(2)).tokenId, 2n, "Failed return must not add a token to the pool");
    await invariant();
  });

  test(`${entrypoint}: organizer destination returns; inventory cannot leave outside claim`, async () => {
    const { tokenId } = await claim(1);
    await mined(tickets.connect(accounts[1]).setApprovalForAll(addresses[3], true));
    const receipt = await mined(standardTransfer(accounts[3], entrypoint, addresses[1], addresses[0], tokenId));
    assert.deepEqual(event(receipt, "TicketReturned"), [addresses[1], tokenId]);
    assert.equal(await tickets.remaining(), 50n);
    assert.equal(await tickets.ticketState(tokenId), 0n);
    await reverted(() => standardTransfer(accounts[0], entrypoint, addresses[0], addresses[2], tokenId), "InventoryOnlyViaClaim");
    await mined(tickets.setApprovalForAll(addresses[3], true));
    await reverted(() => standardTransfer(accounts[3], entrypoint, addresses[0], addresses[2], tokenId), "InventoryOnlyViaClaim");
    assert.equal((await claim(2)).tokenId, tokenId);
    await invariant();
  });

  test(`${entrypoint}: used tickets cannot move, including previously authorized operators`, async () => {
    const { tokenId } = await claim(1);
    await mined(tickets.connect(accounts[1]).setApprovalForAll(addresses[3], true));
    await mined(tickets.admit(tokenId));
    for (const signer of [accounts[1], accounts[3]]) {
      for (const recipient of [addresses[2], addresses[0]]) {
        await reverted(() => standardTransfer(signer, entrypoint, addresses[1], recipient, tokenId), "TicketNotActive");
      }
    }
    await invariant();
  });
}

test("safe transfer accepts contract receivers and exposes consistent state during callback", async () => {
  const recipient = await receiver();
  const recipientAddress = await recipient.getAddress();
  const { tokenId } = await claim(1);
  await mined(tickets.connect(accounts[1]).transferTicket(recipientAddress, tokenId));
  assert.equal(await recipient.callbackCount(), 1n);
  assert.equal(await recipient.observedOwner(), recipientAddress);
  assert.equal(await recipient.observedActiveTicket(), tokenId);
  assert.equal(await recipient.observedRemaining(), 49n);
  await invariant();
});

test("safe mint and inventory reissue call receivers only after state is consistent", async () => {
  const recipient = await receiver();
  const recipientAddress = await recipient.getAddress();
  await mined(recipient.execute(tickets.interface.encodeFunctionData("claim")));
  assert.equal(await recipient.callbackCount(), 1n);
  assert.equal(await recipient.observedOwner(), recipientAddress);
  assert.equal(await recipient.observedActiveTicket(), 1n);
  assert.equal(await recipient.observedRemaining(), 49n);
  await mined(recipient.execute(tickets.interface.encodeFunctionData("returnTicket", [1n])));
  await mined(recipient.execute(tickets.interface.encodeFunctionData("claim")));
  assert.equal(await recipient.callbackCount(), 2n);
  assert.equal(await tickets.totalMinted(), 1n);
  await invariant();
});

test("rejecting mint rolls back token ID, seat, receiver state, and address mappings", async () => {
  const recipient = await receiver();
  await mined(recipient.configure("0x", true));
  await reverted(() => recipient.execute(tickets.interface.encodeFunctionData("claim")));
  assert.equal(await tickets.totalMinted(), 0n);
  assert.equal(await tickets.activeTicketOf(await recipient.getAddress()), 0n);
  assert.equal(await recipient.callbackCount(), 0n);
  assert.equal(await tickets.remaining(), 50n);
  assert.equal((await claim(1)).tokenId, 1n);
  await invariant();
});

test("rejecting reissue leaves the returned ticket available in the pool", async () => {
  const { tokenId } = await claim(1);
  await mined(tickets.connect(accounts[1]).returnTicket(tokenId));
  const recipient = await receiver();
  await mined(recipient.configure("0x", true));
  await reverted(() => recipient.execute(tickets.interface.encodeFunctionData("claim")));
  assert.equal(await tickets.ownerOf(tokenId), addresses[0]);
  assert.equal(await tickets.ticketState(tokenId), 0n);
  assert.equal(await tickets.remaining(), 50n);
  assert.equal(await tickets.activeTicketOf(await recipient.getAddress()), 0n);
  assert.equal((await claim(2)).tokenId, tokenId);
  assert.equal(await tickets.totalMinted(), 1n);
  await invariant();
});

for (const entrypoint of ["transferTicket", ...standardEntrypoints.slice(1)]) {
  test(`${entrypoint}: rejecting and nonreceiver contracts revert the complete transfer`, async () => {
    const { tokenId } = await claim(1);
    await mined(tickets.connect(accounts[1]).approve(addresses[3], tokenId));
    const rejector = await receiver();
    await mined(rejector.configure("0x", true));
    const nonReceiver = await deploy("test/fixtures/TicketReceivers.sol", "NonReceiver");
    for (const contract of [rejector, nonReceiver]) {
      const destination = await contract.getAddress();
      await reverted(() => entrypoint === "transferTicket"
        ? tickets.connect(accounts[1]).transferTicket(destination, tokenId)
        : standardTransfer(accounts[1], entrypoint, addresses[1], destination, tokenId));
      assert.equal(await tickets.ownerOf(tokenId), addresses[1]);
      assert.equal(await tickets.activeTicketOf(addresses[1]), tokenId);
      assert.equal(await tickets.activeTicketOf(destination), 0n);
      assert.equal(await tickets.remaining(), 49n);
      assert.equal(await tickets.getApproved(tokenId), addresses[3]);
    }
    assert.equal(await rejector.callbackCount(), 0n);
    await invariant();
  });
}

test("receiver callback cannot reenter any business or standard transfer entrypoint", async () => {
  const recipient = await receiver();
  const recipientAddress = await recipient.getAddress();
  const payloads = [
    tickets.interface.encodeFunctionData("claim"),
    tickets.interface.encodeFunctionData("returnTicket", [1n]),
    tickets.interface.encodeFunctionData("transferTicket", [addresses[2], 1n]),
    tickets.interface.encodeFunctionData("admit", [1n]),
    ...standardEntrypoints.map((entrypoint) => tickets.interface.encodeFunctionData(
      entrypoint,
      entrypoint.endsWith(",bytes)")
        ? [recipientAddress, addresses[2], 1n, "0x"]
        : [recipientAddress, addresses[2], 1n],
    )),
  ];
  for (const payload of payloads) {
    await mined(recipient.configure(payload, false));
    await mined(recipient.execute(tickets.interface.encodeFunctionData("claim")));
    assert.equal(await recipient.nestedCallSucceeded(), false);
    assert.equal(tickets.interface.parseError(await recipient.nestedResult()).name, "ReentrancyGuardReentrantCall");
    assert.equal(await tickets.ownerOf(1n), recipientAddress);
    assert.equal(await tickets.activeTicketOf(recipientAddress), 1n);
    await invariant();
    await mined(recipient.execute(tickets.interface.encodeFunctionData("returnTicket", [1n])));
    await invariant();
  }
  assert.equal(await tickets.totalMinted(), 1n);
});

test("safe transfer callback blocks a nested return and preserves outer transfer", async () => {
  const recipient = await receiver();
  await mined(recipient.configure(tickets.interface.encodeFunctionData("returnTicket", [1n]), false));
  await claim(1);
  await mined(standardTransfer(accounts[1], standardEntrypoints[2], addresses[1], await recipient.getAddress(), 1n));
  assert.equal(await recipient.nestedCallSucceeded(), false);
  assert.equal(tickets.interface.parseError(await recipient.nestedResult()).name, "ReentrancyGuardReentrantCall");
  assert.equal(await tickets.ownerOf(1n), await recipient.getAddress());
  assert.equal(await tickets.remaining(), 49n);
  await invariant();
});

test("malicious receiver that attempts reentry then rejects leaves no partial effects", async () => {
  const recipient = await receiver();
  const recipientAddress = await recipient.getAddress();
  await mined(recipient.configure(tickets.interface.encodeFunctionData("returnTicket", [1n]), true));
  await claim(1);
  await reverted(() => tickets.connect(accounts[1]).transferTicket(recipientAddress, 1n));
  assert.equal(await tickets.ownerOf(1n), addresses[1]);
  assert.equal(await tickets.activeTicketOf(addresses[1]), 1n);
  assert.equal(await tickets.activeTicketOf(recipientAddress), 0n);
  assert.equal(await recipient.callbackCount(), 0n);
  assert.equal(await tickets.remaining(), 49n);
  assert.equal((await claim(2)).tokenId, 2n);
  await invariant();
});
