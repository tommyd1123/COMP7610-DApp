// 负责人：成员 4。领票页和入场页需要显示状态、交易链接时再用这个组件。
import { SEPOLIA_EXPLORER_URL } from "../config/contract.js";
import { shortAddress } from "./format.js";

export function Status({ hintText, transactionId }) {
  return (
    <>
      {hintText && <p className="status">Status: {hintText}</p>}
      {transactionId && (
        <a
          className="tx"
          href={`${SEPOLIA_EXPLORER_URL}/tx/${transactionId}`}
          target="_blank"
          rel="noreferrer"
        >
          View transaction: {shortAddress(transactionId)}
        </a>
      )}
    </>
  );
}
