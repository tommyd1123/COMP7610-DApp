import assert from "node:assert/strict";
import { test } from "node:test";
import http from "node:http";
import { createPreviewServer } from "../scripts/deployment-preview.mjs";
import { assertTransactionContext, assertCanSend, ORGANIZER, STUDENT } from "../scripts/deployment-preview/guards.mjs";

test("transaction guard requires Sepolia and the fixed approved account for the role", () => {
  assert.doesNotThrow(() => assertTransactionContext({ chainId: "0xaa36a7", account: ORGANIZER, role: "organizer" }));
  assert.doesNotThrow(() => assertTransactionContext({ chainId: "0xaa36a7", account: STUDENT, role: "student" }));
  assert.throws(() => assertTransactionContext({ chainId: "0x1", account: ORGANIZER, role: "organizer" }), /Sepolia/);
  assert.throws(() => assertTransactionContext({ chainId: "0xaa36a7", account: STUDENT, role: "organizer" }), /Account 2/);
  assert.throws(() => assertTransactionContext({ chainId: "0xaa36a7", account: ORGANIZER, role: "student" }), /Account 1/);
  assert.throws(() => assertTransactionContext({ chainId: "0xaa36a7", account: undefined, role: "student" }), /Account 1/);
});

test("persisted pending records and an existing deployment prevent duplicate writes", () => {
  for (const status of ["awaiting-signature", "submitted"]) {
    for (const kind of ["deploy", "claim", "return", "reclaim"]) {
      assert.throws(() => assertCanSend(kind, { transactions: [{ kind: "deploy", status }] }), /已有签名或交易/);
    }
  }
  assert.throws(() => assertCanSend("deploy", { contractAddress: ORGANIZER, transactions: [] }), /重复部署/);
  assert.throws(() => assertCanSend("deploy", { transactions: [{ kind: "deploy", status: "confirmed" }] }), /重复部署/);
  assert.doesNotThrow(() => assertCanSend("deploy", { transactions: [{ kind: "deploy", status: "rejected" }] }));
});

test("HTTP server binds loopback and exposes only fixed public assets", async () => {
  const server = await createPreviewServer({ artifact: { testArtifact: true }, port: 0 });
  try {
    assert.equal(server.address().address, "127.0.0.1");
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(base)).status, 200);
    assert.deepEqual(await (await fetch(`${base}/artifact.json`)).json(), { testArtifact: true });
    assert.equal((await fetch(`${base}/ethers.js`)).status, 200);
    for (const route of ["/.env", "/package.json", "/src/config/contract.js", "/node_modules/solc/soljson.js", "/artifact.json?file=.env", "/%2e%2e/.env"]) {
      assert.equal((await fetch(`${base}${route}`)).status, 404, route);
    }
    assert.equal((await fetch(`${base}/`, { method: "POST" })).status, 405);
    const foreignHostStatus = await new Promise((resolve, reject) => {
      http.get(base, { headers: { Host: "attacker.example" } }, (response) => {
        response.resume(); resolve(response.statusCode);
      }).on("error", reject);
    });
    assert.equal(foreignHostStatus, 403);
    assert.match((await fetch(base)).headers.get("content-security-policy"), /connect-src 'self'/);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
