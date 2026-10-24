import assert from "node:assert/strict";
import { before, beforeEach, test } from "node:test";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { BrowserProvider, ContractFactory, getBytes, hexlify } from "ethers";
import { createDeploymentBundle } from "../scripts/prepare-deployment.mjs";
import { verifyDeployment } from "../scripts/verify-deployment.mjs";
import { projectRoot } from "../scripts/compile-contract.mjs";

const require = createRequire(import.meta.url);
const { network } = require("hardhat");
let bundle;
let provider;
let accounts;
let contract;
let target;
let organizer;

before(async () => { bundle = await createDeploymentBundle(); });

beforeEach(async () => {
  await network.provider.request({ method: "hardhat_reset", params: [] });
  provider = new BrowserProvider(network.provider, undefined, { cacheTimeout: -1 });
  accounts = await Promise.all([0, 1, 2, 3].map((index) => provider.getSigner(index)));
  organizer = await accounts[0].getAddress();
  const factory = new ContractFactory(bundle.artifact.abi, bundle.artifact.creationBytecode, accounts[0]);
  contract = await factory.deploy();
  await contract.waitForDeployment();
  target = await contract.getAddress();
});

function verify(overrides = {}) {
  return verifyDeployment({
    provider, contractAddress: target, organizerAddress: organizer, artifact: bundle.artifact,
    expectedChainId: 31337n, ...overrides,
  });
}

test("deployment bundle embeds all imports and records compiler, constructor, and immutable references", () => {
  assert.equal(bundle.manifest.standardInputSelfContained, true);
  assert.equal(bundle.manifest.creationBytecodeReproduced, true);
  assert.ok(bundle.manifest.sourceCount > 1);
  assert.ok(Object.keys(bundle.input.sources).some((name) => name.startsWith("@openzeppelin/contracts@5.6.1/")));
  for (const source of Object.values(bundle.input.sources)) assert.equal(typeof source.content, "string");
  assert.match(bundle.artifact.compiler, /^0\.8\.30\+/);
  assert.deepEqual(bundle.artifact.optimizer, { enabled: true, runs: 200 });
  assert.equal(bundle.artifact.evmVersion, "cancun");
  assert.deepEqual(bundle.artifact.constructorArguments, []);
  assert.equal(bundle.artifact.constructorArgumentsEncoded, "0x");
  assert.ok(bundle.artifact.immutableReferences[bundle.artifact.organizerImmutableId].length > 0);
  assert.match(bundle.manifest.files["standard-input.json"].sha256, /^[0-9a-f]{64}$/);
});

test("verifier defaults to Sepolia and rejects the local chain before reading code", async () => {
  let codeWasRead = false;
  await assert.rejects(verifyDeployment({
    provider: {
      getNetwork: () => provider.getNetwork(),
      getCode: () => { codeWasRead = true; throw new Error("Unexpected code read"); },
    },
    contractAddress: target, organizerAddress: organizer, artifact: bundle.artifact,
  }), /Wrong network: expected chain ID 11155111, received 31337/);
  assert.equal(codeWasRead, false);
});

test("real local deployment matches runtime, immutable organizer, state, and deployment receipt", async () => {
  const evidence = await verify({ deploymentTx: contract.deploymentTransaction().hash });
  assert.equal(evidence.verified, true);
  assert.equal(evidence.organizer, organizer);
  assert.equal(evidence.contractAddress, target);
  assert.equal(evidence.code.matches, true);
  assert.equal(evidence.code.metadataMatchesPrepared, true);
  assert.equal(evidence.state.remaining, "50");
  assert.equal(evidence.state.isInitialState, true);
  assert.equal(evidence.deploymentTransaction.status, 1);
  assert.equal(evidence.deploymentTransaction.creationBytecodeMatchesPrepared, true);
  assert.deepEqual(evidence.tickets, []);
});

test("verification checks current owners, returned inventory, and used souvenir mappings", async () => {
  await (await contract.connect(accounts[1]).claim()).wait();
  await (await contract.connect(accounts[1]).transferTicket(await accounts[2].getAddress(), 1n)).wait();
  await (await contract.admit(1n)).wait();
  await (await contract.connect(accounts[3]).claim()).wait();
  await (await contract.connect(accounts[3]).returnTicket(2n)).wait();
  const evidence = await verify();
  assert.equal(evidence.state.totalMinted, "2");
  assert.equal(evidence.state.activeCount, "0");
  assert.equal(evidence.state.usedCount, "1");
  assert.equal(evidence.state.returnedInventoryCount, "1");
  assert.equal(evidence.state.remaining, "49");
  assert.equal(evidence.state.isInitialState, false);
  assert.deepEqual(evidence.tickets.map((ticket) => ticket.state), ["USED", "AVAILABLE"]);
  assert.equal(evidence.tickets[0].owner, await accounts[2].getAddress());
  assert.equal(evidence.tickets[1].owner, organizer);
});

test("verifier rejects empty addresses, a wrong immutable organizer, and altered executable code", async () => {
  await assert.rejects(verify({ contractAddress: await accounts[1].getAddress() }), /No deployed contract code/);
  await assert.rejects(verify({ organizerAddress: await accounts[1].getAddress() }), /Runtime bytecode does not match/);
  const code = getBytes(await provider.getCode(target));
  code[0] ^= 1;
  await network.provider.request({ method: "hardhat_setCode", params: [target, hexlify(code)] });
  await assert.rejects(verify(), /Runtime bytecode does not match/);
});

test("metadata hash differences are reported without accepting changes to executable code", async () => {
  const code = getBytes(await provider.getCode(target));
  const length = code[code.length - 2] * 256 + code[code.length - 1];
  code[code.length - length - 2 + 12] ^= 1; // An IPFS digest byte, outside executable code.
  await network.provider.request({ method: "hardhat_setCode", params: [target, hexlify(code)] });
  const evidence = await verify();
  assert.equal(evidence.code.matches, true);
  assert.equal(evidence.code.metadataMatchesPrepared, false);
});

test("deployment receipt must identify this contract and an actual creation transaction", async () => {
  const factory = new ContractFactory(bundle.artifact.abi, bundle.artifact.creationBytecode, accounts[0]);
  const another = await factory.deploy();
  await another.waitForDeployment();
  await assert.rejects(verify({ deploymentTx: another.deploymentTransaction().hash }), /created a different contract/);
  await assert.rejects(verify({ deploymentTx: `0x${"00".repeat(32)}` }), /has not been mined or cannot be found/);
});

test("CLI exposes no chain override or private-key parameter", () => {
  for (const flag of ["--expected-chain-id", "--private-key"]) {
    const result = spawnSync(process.execPath, ["scripts/verify-deployment.mjs", flag, "31337"], {
      cwd: projectRoot, encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stderr).verified, false);
    assert.match(JSON.parse(result.stderr).error, /no private key or network override/);
  }
});
