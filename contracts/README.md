# 合约

负责人：成员 2。

这里放小组自己的 Solidity。文件还没建。老师的教学合约在 `docs/01-教授给的框架和代码.md`，部署步骤以老师示例仓库的 README 为准。

要对上 `src/config/contract.js` 里的函数名单：

- `claim()`：还有剩余座位、并且这个地址没领过，才发一张票
- `admit(address)`：把这个地址核销一次，第二次拒绝
- `remaining()`、`seatCap()`、`hasClaimed(address)`、`admitted(address)`：只读
- 座位上限用 `SEAT_CAP`，现在是 50

完成后请留下：

- 合约源码
- 它和教学示例的差别（哪怕只多一条规则）
- Sepolia 上的合约地址，交给组长写进 `.env` 和项目 README
- 不要把私钥、助记词放进这个目录
