import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { Contract, JsonRpcProvider, ZeroAddress, getAddress, getBytes, hexlify, zeroPadValue } from "ethers";
import { createDeploymentBundle, deploymentDirectory, jsonText, sha256 } from "./prepare-deployment.mjs";
import { projectRoot } from "./compile-contract.mjs";

export const SEPOLIA_CHAIN_ID = 11155111n;

export class VerificationError extends Error {}

function check(condition, message) {
  if (!condition) throw new VerificationError(message);
}

function address(value, label) {
  try {
    const normalized = getAddress(value);
    check(normalized !== ZeroAddress, `${label} cannot be the zero address`);
    return normalized;
  } catch (error) {
    if (error instanceof VerificationError) throw error;
    throw new VerificationError(`${label} must be a valid Ethereum address`);
  }
}

function splitMetadata(bytecode) {
  const bytes = getBytes(bytecode);
  check(bytes.length > 2, "Runtime bytecode is too short");
  const length = bytes[bytes.length - 2] * 256 + bytes[bytes.length - 1];
  const start = bytes.length - length - 2;
  check(length > 0 && start > 0, "Runtime bytecode has an invalid Solidity metadata trailer");
  // The compiler emits a CBOR map followed by its two-byte length.
  check(bytes[start] >= 0xa0 && bytes[start] <= 0xb7, "Runtime metadata is not a Solidity CBOR map");
  return { executable: bytes.slice(0, start), metadata: bytes.slice(start), length };
}

export function compareRuntimeCode(actualCode, artifact, organizer) {
  const template = getBytes(artifact.runtimeBytecodeTemplate);
  const referenceIds = Object.keys(artifact.immutableReferences);
  check(referenceIds.length === 1 && referenceIds[0] === artifact.organizerImmutableId, "Unexpected immutable references");
  const expectedAddress = getBytes(zeroPadValue(organizer, 32));
  for (const reference of artifact.immutableReferences[artifact.organizerImmutableId]) {
    check(reference.length === 32 && reference.start + 32 <= template.length, "Invalid organizer immutable reference");
    template.set(expectedAddress, reference.start);
  }
  const expected = splitMetadata(hexlify(template));
  const actual = splitMetadata(actualCode);
  check(actual.length === expected.length, "Runtime metadata length differs from the prepared compiler output");
  check(hexlify(actual.executable) === hexlify(expected.executable), "Runtime bytecode does not match the local contract and expected organizer");
  return {
    matches: true,
    method: "Compare executable runtime bytes after filling organizer immutable references; exclude the Solidity metadata trailer.",
    runtimeBytecodeSha256: sha256(getBytes(actualCode)),
    executableBytecodeSha256: sha256(actual.executable),
    metadataMatchesPrepared: hexlify(actual.metadata) === hexlify(expected.metadata),
    organizerImmutableReferenceCount: artifact.immutableReferences[artifact.organizerImmutableId].length,
  };
}

// expectedChainId is dependency injection for local tests only. The CLI always
// uses SEPOLIA_CHAIN_ID and deliberately exposes no network override option.
export async function verifyDeployment({ provider, contractAddress, organizerAddress, deploymentTx, artifact, expectedChainId = SEPOLIA_CHAIN_ID }) {
  const target = address(contractAddress, "Contract address");
  const expectedOrganizer = address(organizerAddress, "Organizer address");
  check(target !== expectedOrganizer, "Contract and organizer addresses must differ");
  if (deploymentTx !== undefined) check(/^0x[0-9a-fA-F]{64}$/.test(deploymentTx), "Deployment transaction hash must contain 32 bytes");
  const network = await provider.getNetwork();
  check(network.chainId === expectedChainId, `Wrong network: expected chain ID ${expectedChainId}, received ${network.chainId}`);

  const blockNumber = await provider.getBlockNumber();
  const block = await provider.getBlock(blockNumber);
  check(block && block.hash, "Could not retrieve the verification block");
  const runtime = await provider.getCode(target, blockNumber);
  check(runtime !== "0x", "No deployed contract code exists at this address");
  const code = compareRuntimeCode(runtime, artifact, expectedOrganizer);
  const contract = new Contract(target, artifact.abi, provider);
  const atBlock = { blockTag: blockNumber };
  const [actualOrganizer, seatCap, remaining, totalMinted, activeCount, usedCount, name, symbol] = await Promise.all([
    contract.organizer(atBlock), contract.seatCap(atBlock), contract.remaining(atBlock),
    contract.totalMinted(atBlock), contract.activeCount(atBlock), contract.usedCount(atBlock),
    contract.name(atBlock), contract.symbol(atBlock),
  ]);
  check(actualOrganizer === expectedOrganizer, "The contract organizer does not match the expected address");
  check(seatCap === 50n, "The deployed seat capacity must be 50");
  check(remaining + activeCount + usedCount === seatCap, "Seat accounting invariant failed");
  check(totalMinted <= seatCap && activeCount + usedCount <= totalMinted, "Minted ticket accounting invariant failed");
  check(name === "Seminar Tickets" && symbol === "SEAT", "NFT name or symbol differs from the prepared contract");

  const [organizerActive, organizerEnteredId, organizerHasEntered, organizerBalance] = await Promise.all([
    contract.activeTicketOf(expectedOrganizer, atBlock), contract.enteredTicketOf(expectedOrganizer, atBlock),
    contract.hasEntered(expectedOrganizer, atBlock), contract.balanceOf(expectedOrganizer, atBlock),
  ]);
  check(organizerActive === 0n && organizerEnteredId === 0n && !organizerHasEntered, "Organizer must not hold admission eligibility");
  const tickets = [];
  const counts = [0n, 0n, 0n];
  const studentOwners = new Set();
  for (let tokenId = 1n; tokenId <= totalMinted; tokenId++) {
    const [owner, state] = await Promise.all([contract.ownerOf(tokenId, atBlock), contract.ticketState(tokenId, atBlock)]);
    check(state >= 0n && state <= 2n, `Ticket ${tokenId} has an unknown state`);
    counts[Number(state)]++;
    if (state === 0n) {
      check(owner === expectedOrganizer, `Available ticket ${tokenId} is not held by organizer`);
    } else {
      check(owner !== expectedOrganizer && owner !== target && owner !== ZeroAddress, `Ticket ${tokenId} has an ineligible owner`);
      check(!studentOwners.has(owner), `Address ${owner} holds multiple student tickets`);
      studentOwners.add(owner);
      const [activeId, enteredId, entered, balance] = await Promise.all([
        contract.activeTicketOf(owner, atBlock), contract.enteredTicketOf(owner, atBlock),
        contract.hasEntered(owner, atBlock), contract.balanceOf(owner, atBlock),
      ]);
      check(balance === 1n, `Ticket balance for ${owner} violates the one-ticket rule`);
      if (state === 1n) {
        check(activeId === tokenId && enteredId === 0n && !entered, `Active ticket ${tokenId} has inconsistent owner mappings`);
      } else {
        check(activeId === 0n && enteredId === tokenId && entered, `Used ticket ${tokenId} has inconsistent souvenir mappings`);
      }
    }
    tickets.push({ tokenId: tokenId.toString(), owner, state: ["AVAILABLE", "ACTIVE", "USED"][Number(state)] });
  }
  check(counts[1] === activeCount && counts[2] === usedCount, "Stored counters differ from actual ticket states");
  check(counts[0] === organizerBalance, "Organizer inventory balance differs from available ticket count");

  let deploymentTransaction = null;
  if (deploymentTx) {
    const [receipt, transaction] = await Promise.all([
      provider.getTransactionReceipt(deploymentTx), provider.getTransaction(deploymentTx),
    ]);
    check(receipt && transaction, "Deployment transaction has not been mined or cannot be found");
    check(receipt.status === 1, "Deployment transaction did not succeed");
    check(receipt.contractAddress && getAddress(receipt.contractAddress) === target, "Deployment transaction created a different contract");
    check(getAddress(receipt.from) === expectedOrganizer && getAddress(transaction.from) === expectedOrganizer, "Deployment transaction sender differs from organizer");
    check(transaction.to === null, "Deployment transaction must directly create the contract");
    check(receipt.blockNumber <= blockNumber, "Deployment occurred after the verification snapshot; run verification again");
    deploymentTransaction = {
      hash: receipt.hash,
      status: receipt.status,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      from: receipt.from,
      contractAddress: receipt.contractAddress,
      gasUsed: receipt.gasUsed.toString(),
      creationBytecodeMatchesPrepared: transaction.data.toLowerCase() === artifact.creationBytecode.toLowerCase(),
    };
  }

  // Detect a reorganization during the reads instead of merging two snapshots.
  const sameBlock = await provider.getBlock(blockNumber);
  check(sameBlock?.hash === block.hash, "The verification block changed; run verification again");
  return {
    verified: true,
    chainId: network.chainId.toString(),
    contractAddress: target,
    organizer: actualOrganizer,
    snapshot: { blockNumber, blockHash: block.hash, blockTimestampUtc: new Date(block.timestamp * 1000).toISOString() },
    compiler: artifact.compiler,
    optimizer: artifact.optimizer,
    evmVersion: artifact.evmVersion,
    code,
    state: {
      name, symbol,
      seatCap: seatCap.toString(), remaining: remaining.toString(), totalMinted: totalMinted.toString(),
      activeCount: activeCount.toString(), usedCount: usedCount.toString(),
      returnedInventoryCount: counts[0].toString(),
      isInitialState: totalMinted === 0n && remaining === 50n,
    },
    tickets,
    deploymentTransaction,
  };
}

async function main() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        rpc: { type: "string" }, address: { type: "string" }, organizer: { type: "string" },
        "deployment-tx": { type: "string" }, output: { type: "string" }, help: { type: "boolean" },
      },
      strict: true,
    }));
  } catch {
    throw new VerificationError("Invalid arguments. Use --help; no private key or network override is accepted.");
  }
  if (values.help) {
    console.log(jsonText({ usage: "npm run verify:deployment -- --rpc URL --address 0x... --organizer 0x... [--deployment-tx 0x...] [--output artifacts/deployment/verification.json]", chainId: SEPOLIA_CHAIN_ID.toString(), readOnly: true }).trimEnd());
    return;
  }
  check(values.rpc && values.address && values.organizer, "Required arguments: --rpc URL --address 0x... --organizer 0x...");
  let rpc;
  try { rpc = new URL(values.rpc); } catch { throw new VerificationError("RPC must be a valid HTTP(S) URL"); }
  check(rpc.protocol === "https:" || rpc.protocol === "http:", "RPC must use HTTP(S)");
  let output;
  if (values.output) {
    output = path.resolve(projectRoot, values.output);
    const relative = path.relative(deploymentDirectory, output);
    check(relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative) && output.endsWith(".json"), "Evidence output must be a JSON file inside artifacts/deployment/");
  }
  const { artifact, manifest } = await createDeploymentBundle();
  const provider = new JsonRpcProvider(values.rpc);
  try {
    const evidence = await verifyDeployment({
      provider, contractAddress: values.address, organizerAddress: values.organizer,
      deploymentTx: values["deployment-tx"], artifact,
    });
    evidence.standardInputSha256 = manifest.files["standard-input.json"].sha256;
    if (output) {
      await fs.mkdir(path.dirname(output), { recursive: true });
      await fs.writeFile(output, jsonText(evidence));
    }
    console.log(jsonText(evidence).trimEnd());
  } finally {
    provider.destroy();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    // RPC exception details can contain provider credentials. Do not echo them.
    const message = error instanceof VerificationError ? error.message : "RPC or compilation failed; check the endpoint, installed dependencies, and contract source.";
    console.error(jsonText({ verified: false, error: message }).trimEnd());
    process.exitCode = 1;
  });
}
