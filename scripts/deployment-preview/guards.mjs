export const SEPOLIA_CHAIN_HEX = "0xaa36a7";
export const ORGANIZER = "0x5bA8D6f1dCDb101D6a4EF905788CEBC048b2b133";
export const STUDENT = "0x03578111161a6FE000E844d3cBD2EA0F5108D7B9";

export function sameAddress(first, second) {
  return typeof first === "string" && typeof second === "string" && first.toLowerCase() === second.toLowerCase();
}

export function assertTransactionContext({ chainId, account, role }) {
  if (typeof chainId !== "string" || BigInt(chainId) !== 11155111n) throw new Error("请先在 MetaMask 切换到 Sepolia（11155111）。");
  if (role !== "organizer" && role !== "student") throw new Error("未知操作角色。");
  const expected = role === "organizer" ? ORGANIZER : STUDENT;
  if (!sameAddress(account, expected)) throw new Error(`请先在 MetaMask 切换到批准的${role === "organizer" ? "主办方 Account 2" : "学生 Account 1"}：${expected}`);
}

export function isPending(entry) {
  return entry.status === "awaiting-signature" || entry.status === "submitted";
}

export function assertCanSend(kind, stored) {
  if (stored.transactions.some(isPending)) throw new Error("已有签名或交易等待完成。请先检查钱包并刷新交易回执，避免重复发送。");
  if (kind === "deploy" && (stored.contractAddress || stored.transactions.some((entry) => entry.kind === "deploy" && entry.status === "confirmed"))) {
    throw new Error("已有合约地址或成功部署记录，已阻止重复部署。");
  }
}

function stripMetadata(hex) {
  if (!/^0x[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) throw new Error("合约字节码格式错误。");
  const length = Number.parseInt(hex.slice(-4), 16);
  const end = hex.length - (length + 2) * 2;
  if (length < 1 || end <= 2) throw new Error("合约 metadata 格式错误。");
  const first = Number.parseInt(hex.slice(end, end + 2), 16);
  if (first < 0xa0 || first > 0xb7) throw new Error("合约 metadata 不是 CBOR map。");
  return { code: hex.slice(0, end).toLowerCase(), length };
}

export function assertRuntimeMatches(code, artifact) {
  if (code === "0x") throw new Error("该地址没有合约代码。");
  let expected = artifact.runtimeBytecodeTemplate;
  const ids = Object.keys(artifact.immutableReferences);
  if (ids.length !== 1 || ids[0] !== artifact.organizerImmutableId) throw new Error("编译产物 immutable 引用异常。");
  const encodedAddress = ORGANIZER.slice(2).toLowerCase().padStart(64, "0");
  for (const reference of artifact.immutableReferences[artifact.organizerImmutableId]) {
    if (reference.length !== 32 || reference.start * 2 + 66 > expected.length) throw new Error("organizer immutable 位置异常。");
    const start = 2 + reference.start * 2;
    expected = `${expected.slice(0, start)}${encodedAddress}${expected.slice(start + 64)}`;
  }
  const actualBody = stripMetadata(code);
  const expectedBody = stripMetadata(expected);
  if (actualBody.length !== expectedBody.length || actualBody.code !== expectedBody.code) {
    throw new Error("该合约的 runtime 或固定主办方与本地编译结果不匹配，不能发送业务交易。");
  }
}
