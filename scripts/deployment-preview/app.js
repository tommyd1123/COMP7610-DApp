import { BrowserProvider, Contract, Interface, getAddress } from "/ethers.js";
import { ORGANIZER, STUDENT, SEPOLIA_CHAIN_HEX, sameAddress, assertTransactionContext, assertCanSend, assertRuntimeMatches, isPending } from "/guards.js";

const $ = (id) => document.getElementById(id);
const storageKey = "comp7610.sepolia.deployment-preview.v1";
const labels = { deploy: "部署", claim: "首次领取", return: "退票", reclaim: "重新领取" };
let stored = { contractAddress: "", transactions: [] };
let artifact;
let iface;
let wallet;
let account = "";
let chainId = "";
let busy = false;
let polling = false;
let verified = false;
let state = null;
let storageReady = true;

function save() {
  localStorage.setItem(storageKey, JSON.stringify(stored));
}
function reloadStored() {
  const previous = localStorage.getItem(storageKey);
  if (!previous) return;
  const parsed = JSON.parse(previous);
  if (!Array.isArray(parsed.transactions)) throw new Error("浏览器交易记录格式异常。");
  if (parsed.contractAddress !== stored.contractAddress) { verified = false; state = null; }
  stored = parsed;
}
function message(value) { $("message").textContent = value; }
function safeError(error) { return error.shortMessage || error.message || "操作未完成。"; }
function render() {
  $("connected").textContent = account || "未连接";
  $("network").textContent = chainId ? `${chainId === SEPOLIA_CHAIN_HEX ? "Sepolia" : "错误网络"} (${BigInt(chainId)})` : "尚未读取";
  const pending = stored.transactions.some(isPending);
  const ready = !busy && !pending && artifact && storageReady && chainId === SEPOLIA_CHAIN_HEX;
  $("connect").disabled = busy;
  $("refresh").disabled = busy || !wallet;
  $("load").disabled = busy || !wallet;
  $("deploy").disabled = !ready || !sameAddress(account, ORGANIZER) || !!stored.contractAddress || stored.transactions.some((item) => item.kind === "deploy" && item.status === "confirmed");
  const studentReady = ready && verified && sameAddress(account, STUDENT) && state;
  $("claim").disabled = !studentReady || state.activeTicketOf !== "0" || state.hasEntered || stored.transactions.some((item) => item.kind === "claim" && item.status === "confirmed");
  $("return").disabled = !studentReady || state.activeTicketOf === "0";
  $("reclaim").disabled = !studentReady || state.activeTicketOf !== "0" || state.hasEntered || !stored.transactions.some((item) => item.kind === "return" && item.status === "confirmed");
  $("state").textContent = state ? JSON.stringify(state, null, 2) : "尚无链上状态。";
  $("clear-unsigned").hidden = busy || !stored.transactions.some((item) => item.status === "awaiting-signature" && !item.hash);
  $("transactions").replaceChildren();
  for (const entry of [...stored.transactions].reverse()) {
    const row = document.createElement("div"); row.className = "transaction";
    const heading = document.createElement("strong"); heading.textContent = `${labels[entry.kind]} · ${entry.status}`; row.append(heading);
    for (const text of [`发起账户：${entry.sender}`, entry.contractAddress ? `合约地址：${entry.contractAddress}` : "", entry.error || ""]) {
      if (text) { const p = document.createElement("p"); p.textContent = text; row.append(p); }
    }
    if (entry.hash) {
      const link = document.createElement("a"); link.textContent = entry.hash; link.href = `https://sepolia.etherscan.io/tx/${entry.hash}`; link.target = "_blank"; link.rel = "noreferrer"; row.append(link);
    }
    if (entry.events) { const pre = document.createElement("pre"); pre.textContent = JSON.stringify(entry.events, null, 2); row.append(pre); }
    $("transactions").append(row);
  }
  $("evidence").textContent = JSON.stringify({ ...stored, state }, null, 2);
}

async function context() {
  if (!wallet) throw new Error("没有检测到 MetaMask。请在安装 MetaMask 的 Chrome 中打开此页。");
  [chainId, [account = ""]] = await Promise.all([
    wallet.request({ method: "eth_chainId" }), wallet.request({ method: "eth_accounts" }),
  ]);
  render();
}
function provider() { return new BrowserProvider(wallet, undefined, { cacheTimeout: -1 }); }

async function readContract(target) {
  await context();
  if (chainId !== SEPOLIA_CHAIN_HEX) throw new Error("只允许在 Sepolia 加载与查询本合约。");
  const address = getAddress(target);
  const reader = provider();
  assertRuntimeMatches(await reader.getCode(address), artifact);
  const contract = new Contract(address, artifact.abi, reader);
  const [organizer, name, symbol, remaining, totalMinted, activeCount, usedCount, activeTicketOf, hasEntered, enteredTicketOf] = await Promise.all([
    contract.organizer(), contract.name(), contract.symbol(), contract.remaining(), contract.totalMinted(),
    contract.activeCount(), contract.usedCount(), contract.activeTicketOf(STUDENT), contract.hasEntered(STUDENT), contract.enteredTicketOf(STUDENT),
  ]);
  if (!sameAddress(organizer, ORGANIZER) || name !== "Seminar Tickets" || symbol !== "SEAT") throw new Error("主办方或 NFT 信息不匹配。");
  if (remaining + activeCount + usedCount !== 50n) throw new Error("座位计数不变量不成立。");
  const tokenId = activeTicketOf || enteredTicketOf;
  state = {
    contractAddress: address, organizer, name, symbol,
    remaining: remaining.toString(), totalMinted: totalMinted.toString(), activeCount: activeCount.toString(), usedCount: usedCount.toString(),
    student: STUDENT, activeTicketOf: activeTicketOf.toString(), hasEntered, enteredTicketOf: enteredTicketOf.toString(),
    tokenId: tokenId.toString(), owner: tokenId ? await contract.ownerOf(tokenId) : null,
    ticketState: tokenId ? ["AVAILABLE", "ACTIVE", "USED"][Number(await contract.ticketState(tokenId))] : null,
  };
  verified = true;
  stored.contractAddress = address;
  save();
  $("contract-address").value = address;
  $("verification").textContent = `已核对 runtime、固定主办方与 NFT 信息：${address}`;
  render();
  return contract;
}

function receiptEvents(receipt, target) {
  return receipt.logs.filter((log) => sameAddress(log.address, target)).flatMap((log) => {
    try {
      const decoded = iface.parseLog(log);
      return decoded ? [{ name: decoded.name, args: [...decoded.args].map((value) => typeof value === "bigint" ? value.toString() : value) }] : [];
    } catch { return []; }
  });
}

async function recoverReceipts() {
  if (polling || !wallet || !artifact) return;
  polling = true;
  try {
    await context();
    if (chainId !== SEPOLIA_CHAIN_HEX) return;
    const reader = provider();
    for (const entry of stored.transactions.filter((item) => item.status === "submitted" && item.hash)) {
      const receipt = await reader.getTransactionReceipt(entry.hash);
      if (!receipt) continue;
      if (!sameAddress(receipt.from, entry.sender)) throw new Error("交易发送者与已保存记录不匹配，请检查钱包活动。");
      const transaction = await reader.getTransaction(entry.hash);
      if (!transaction || transaction.data.toLowerCase() !== entry.data.toLowerCase() || transaction.value !== 0n) throw new Error("链上交易内容与已保存请求不匹配。");
      if (entry.kind === "deploy" ? transaction.to !== null : !sameAddress(receipt.to, entry.target)) throw new Error("交易目标与已保存请求不匹配。");
      entry.status = receipt.status === 1 ? "confirmed" : "reverted";
      entry.blockNumber = receipt.blockNumber; entry.gasUsed = receipt.gasUsed.toString();
      entry.contractAddress = receipt.contractAddress || entry.target;
      entry.events = receiptEvents(receipt, entry.contractAddress);
      save(); render();
      if (entry.status === "confirmed") {
        await readContract(entry.contractAddress);
        message(`${labels[entry.kind]}已确认。交易哈希：${entry.hash}`);
      } else message(`交易已回退，没有完成${labels[entry.kind]}。${entry.hash}`);
    }
  } finally { polling = false; }
}

async function transactLocked(kind) {
  if (!storageReady) throw new Error("浏览器持久存储不可用，不能安全记录交易；已禁用发送。");
  reloadStored();
  assertCanSend(kind, stored);
  const role = kind === "deploy" ? "organizer" : "student";
  await context();
  assertTransactionContext({ chainId, account, role });
  let data = artifact.creationBytecode;
  let target;
  if (kind !== "deploy") {
    await readContract(stored.contractAddress);
    target = stored.contractAddress;
    if (kind === "return") {
      if (state.activeTicketOf === "0" || !sameAddress(state.owner, STUDENT)) throw new Error("Account 1 当前没有可退回的有效票。");
      data = iface.encodeFunctionData("returnTicket", [BigInt(state.activeTicketOf)]);
    } else {
      if (state.activeTicketOf !== "0" || state.hasEntered || state.remaining === "0") throw new Error("Account 1 当前不符合领取条件。");
      if (kind === "reclaim" && !stored.transactions.some((item) => item.kind === "return" && item.status === "confirmed")) throw new Error("请先完成并确认退票。");
      data = iface.encodeFunctionData("claim");
    }
  }
  // Recheck immediately before the wallet request. The transaction also carries
  // an explicit sender, Sepolia chain ID, and zero value.
  await context();
  assertTransactionContext({ chainId, account, role });
  reloadStored();
  assertCanSend(kind, stored);
  const entry = { kind, sender: role === "organizer" ? ORGANIZER : STUDENT, target, data, status: "awaiting-signature", requestedAt: new Date().toISOString() };
  stored.transactions.push(entry);
  save(); render();
  message(`请在 MetaMask 中确认${labels[kind]}。刷新页面不会清除本次等待标记。`);
  try {
    const transaction = { from: entry.sender, data, value: "0x0", chainId: SEPOLIA_CHAIN_HEX };
    if (target) transaction.to = target;
    const hash = await wallet.request({ method: "eth_sendTransaction", params: [transaction] });
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("钱包返回的交易哈希格式异常，请检查钱包活动。");
    entry.hash = hash; entry.status = "submitted"; entry.submittedAt = new Date().toISOString();
    save(); render();
    message(`${labels[kind]}已广播，等待链上确认。${hash}`);
  } catch (error) {
    if (error.code === 4001 || error.code === "ACTION_REJECTED") entry.status = "rejected";
    entry.error = safeError(error);
    save(); render();
    throw error;
  }
}

async function transact(kind) {
  if (!navigator.locks) throw new Error("此浏览器不支持跨标签页交易锁，请使用 Chrome 打开本地辅助页。");
  return navigator.locks.request("comp7610.sepolia.deployment-preview.send", { mode: "exclusive", ifAvailable: true }, async (lock) => {
    if (!lock) throw new Error("另一标签页正在请求钱包签名，请等待并刷新交易记录。");
    return transactLocked(kind);
  });
}

async function run(action) {
  if (busy) return;
  busy = true; render();
  try { await action(); } catch (error) { message(safeError(error)); }
  finally { busy = false; render(); }
}

$("organizer").textContent = ORGANIZER;
$("student").textContent = STUDENT;
try {
  const previous = localStorage.getItem(storageKey);
  if (previous) {
    const parsed = JSON.parse(previous);
    if (!Array.isArray(parsed.transactions)) throw new Error("交易记录格式异常");
    stored = parsed;
  }
  save();
} catch { storageReady = false; message("无法读取或写入浏览器交易记录，写操作已禁用。请保留已有记录并检查浏览器存储。"); }
$("contract-address").value = stored.contractAddress || "";
wallet = window.ethereum?.providers?.find((candidate) => candidate.isMetaMask) || window.ethereum;
if (wallet && !wallet.isMetaMask) wallet = null;

$("connect").addEventListener("click", () => run(async () => {
  if (!wallet) throw new Error("未检测到 MetaMask。请在安装扩展的 Chrome 中打开本地网址。");
  await wallet.request({ method: "eth_requestAccounts" });
  await context(); await recoverReceipts();
  if (stored.contractAddress) await readContract(stored.contractAddress);
  message("钱包已连接。请核对上方完整地址与 Sepolia 网络。");
}));
$("refresh").addEventListener("click", () => run(async () => {
  await context(); await recoverReceipts();
  if (stored.contractAddress) await readContract(stored.contractAddress);
}));
$("load").addEventListener("click", () => run(async () => {
  verified = false; state = null;
  await readContract($("contract-address").value.trim());
}));
for (const kind of ["deploy", "claim", "return", "reclaim"]) $(kind).addEventListener("click", () => run(() => transact(kind)));
$("clear-unsigned").addEventListener("click", () => {
  if (!window.confirm("仅当已在 MetaMask 活动中确认交易从未广播时继续。已广播但未取得哈希时请取消，以免重复发送。")) return;
  for (const entry of stored.transactions) if (entry.status === "awaiting-signature" && !entry.hash) entry.status = "not-broadcast-confirmed-by-user";
  save(); render(); message("无哈希等待标记已清除。没有发出任何交易。");
});
if (wallet) {
  wallet.on("accountsChanged", () => { verified = false; state = null; run(context); });
  wallet.on("chainChanged", () => { verified = false; state = null; run(context); });
}
window.addEventListener("storage", (event) => {
  if (event.key === storageKey && !busy) {
    try { reloadStored(); render(); } catch (error) { storageReady = false; message(safeError(error)); render(); }
  }
});

try {
  artifact = await (await fetch("/artifact.json")).json();
  iface = new Interface(artifact.abi);
  $("compiler").textContent = `${artifact.compiler} · optimizer ${artifact.optimizer.runs} · ${artifact.evmVersion} · 构造参数：无`;
  if (wallet) await context();
} catch (error) { message(safeError(error)); }
render();
setInterval(() => {
  if (!busy && stored.transactions.some((entry) => entry.status === "submitted")) recoverReceipts().catch((error) => message(`交易已记录，暂未完成回执核对：${safeError(error)}`));
}, 4000);
