# 合约

负责人：成员 2。

`SeminarTickets.sol` 已实现小组的票务规则，完整 ABI 位于 `src/config/SeminarTickets.abi.json`，由 `src/config/contract.js` 导入。**已部署 Sepolia，领取 → 退票 → 同票号重领及最终链上核验均完成。** 钱包、只读查询和页面仍由成员 3、5、4 接入。这是直接部署的普通合约，没有代理升级机制。

完整业务规则见 [`../docs/03-转让退票与票务流程.md`](../docs/03-转让退票与票务流程.md)。老师示例只限制每个地址领取一次；本合约增加容量 50、转让后资格同步、退票复用、主办方核销、纪念票冻结和链上查询。

成员 2 的可执行部署、链上核验与证据清单见 [`docs/05-成员2部署与交接.md`](../docs/05-成员2部署与交接.md)，英文报告材料见 [`docs/report/成员2-合约设计与实现.md`](../docs/report/成员2-合约设计与实现.md)。姓名 / UID 留空；主办方 `0x5bA8D6f1dCDb101D6a4EF905788CEBC048b2b133` 已与 `organizer()` 核对。

本次通过本地部署辅助页与 MetaMask 创建合约 [0x273d4F66420C2Bac602bdcfe4A5Bc395B1dC2dE3](https://sepolia.etherscan.io/address/0x273d4F66420C2Bac602bdcfe4A5Bc395B1dC2dE3)，[部署交易](https://sepolia.etherscan.io/tx/0xab973e92f52498745b6add116d73b5ea1901cd94df05d649f6027e17303bd6d9)在区块 `11984380` 成功。初始核验区块为 `11984383`，代码、元数据及初始计数匹配。Account 1 的三笔业务交易与逐区块状态见[生命周期证据](../docs/evidence/sepolia-lifecycle.json)；[最终核验](../docs/evidence/sepolia-final.json)通过，票号 1 为有效票，余票 49，已铸造 1。

## 已实现的行为

- `claim()`：有空位、没有有效票且未入场的非主办方地址领取；优先复用退票，再铸造新票。
- `transferTicket(address,uint256)`：当前持有人把有效票转给另一合资格同学；拒绝自己、零地址、合约自身和主办方地址。
- `returnTicket(uint256)`：当前持有人把有效 NFT 退回部署者钱包，释放一个名额，票号进入退票池。
- `admit(uint256)`：仅部署者 / 主办方按票号核销当前持有人；清空有效票号，记录入场及纪念票号，NFT 冻结并留在持有人钱包。
- 所有标准 ERC-721 转移入口，包括获授权地址的转移，也执行资格、票状态和座位规则。标准转移直接转给主办方按退票处理；主办方库存只能经 `claim()` 再发放。

每个地址最多持有一张有效票；转出或退票后可以重新领取，已入场地址不能再次领票或收票。票号从 1 开始，`activeTicketOf` 或 `enteredTicketOf` 返回 0 表示没有相应票。不能用永久的 `hasClaimed` 或 NFT 总余额判断领取资格。

总铸造量不超过 50，退票复用原票，多张退票按后退先领顺序复用。始终保持 `remaining() + activeCount() + usedCount() == seatCap() == 50`；核销不释放座位。

业务事件是 `TicketClaimed(account, tokenId, reused)`、`TicketTransferred(from, to, tokenId)`、`TicketReturned(account, tokenId)` 和 `TicketAdmitted(account, tokenId)`。领取事件的 `reused` 表示是否复用退票；ERC-721 的 `Transfer` 事件记录实际 NFT 所有权变化。

## 本地编译与测试

在仓库根目录安装依赖后运行：

```bash
npm install
npm run compile:contract
npm run test:contract
```

编译使用 solc **0.8.30**、OpenZeppelin Contracts **5.6.1**，优化器开启、`runs = 200`、`evmVersion = cancun`。编译命令会更新 `src/config/SeminarTickets.abi.json`，合约修改后应重新生成，不手写 ABI。Hardhat 2 仅用于本地测试网络；这些命令不连接 MetaMask、不使用 Sepolia ETH，也不会部署到 Sepolia。

2026-10-24 在 Node.js 22.23.2 下重跑验证：合约编译成功，`test/SeminarTickets.test.mjs` 的 **32 项测试全部通过**。前端 lint 与构建也已通过。测试覆盖生命周期、权限、50 席上限、退票复用、事件、授权转移、错误参数回滚，以及接收方拒收和重入时的状态一致性。`test/fixtures/` 中的合约只用于测试，不需要部署到 Sepolia。

测试结果不能替代 Sepolia 部署后的实际钱包与页面联调。

另外 8 项部署工具测试和 3 项辅助页测试通过；连同合约测试共 43 项。

部署准备可运行 `npm run prepare:deployment`，生成 `artifacts/deployment/` 中的自包含编译输入、ABI、字节码和清单。部署完成后运行 `npm run verify:deployment -- --help` 查看只读核验参数；具体命令见 [部署与交接清单](../docs/05-成员2部署与交接.md)。这两个命令都不签名或发送部署交易。

## Remix 备用部署步骤

本次实际部署使用 `npm run preview:deployment` 启动的本地辅助页与 MetaMask，操作见 [docs/05](../docs/05-成员2部署与交接.md)。以下保留为重新部署时可用的 Remix 步骤，接入现有合约无需再部署。

1. 在 Remix 工作区新建 `SeminarTickets.sol`，复制本仓库的同名源码。保留源码中带 `@5.6.1` 的 OpenZeppelin 导入路径，Remix 会按固定版本解析依赖，不要改为未指定版本的路径。
2. 在 Solidity Compiler 中选择 **0.8.30**，开启优化器并设 **200 runs**，EVM Version 设为 **Cancun**，再编译。编译设置与本地一致。
3. MetaMask 切到 **Sepolia**（chain ID `11155111`），使用准备好的主办方钱包，并确保有测试 ETH 支付 gas。部署者地址会永久成为 `organizer()`。
4. 在 Deploy & Run Transactions 中选择连接 MetaMask 的注入钱包环境，确认网络为 Sepolia，选择 `SeminarTickets`。构造函数没有参数，发送金额为 0；点击 Deploy，在 MetaMask 确认并等待交易成功。
5. 复制部署出的**合约地址**，不要复制钱包地址或交易哈希。先读取 `organizer()`、`seatCap()`、`remaining()`，确认主办方正确、总容量和初始余票均为 50。
6. 将地址填入本地 `.env` 的 `VITE_CONTRACT_ADDRESS`，重启 Vite。把公开合约地址与部署交易链接交给组长记录在 README；私钥和助记词不写进仓库、`.env` 或视频。
7. 用不同同学钱包按 `docs/03` 完成领取、转让、退票复用和核销，记录成功交易哈希及实际状态变化，供网页联调、报告和英文演示使用。

Remix VM 和 Hardhat 本地网络只能做本地验证，它们的地址不能作为本项目的 Sepolia 合约地址。修改源码后需重新编译、重新部署并更新配置；本合约不能原地升级。

## 交给成员 3、4、5 的接口

| 负责模块 | 接口与注意事项 |
| --- | --- |
| 钱包与交易（3） | `claim()`、`transferTicket(to, tokenId)`、`returnTicket(tokenId)`、`admit(tokenId)`；四种操作等待回执后刷新状态。转让到主办方要走退票按钮，不能调用专用 `transferTicket`。 |
| 只读状态（5） | `organizer()`、`remaining()`、`seatCap()`、`activeTicketOf(account)`、`hasEntered(account)`、`enteredTicketOf(account)`、`ticketState(tokenId)`、`ownerOf(tokenId)`；统计还可读 `totalMinted()`、`activeCount()`、`usedCount()`。 |
| 页面（4） | 状态 `0 = AVAILABLE`、`1 = ACTIVE`、`2 = USED`。有效票号为 0 时继续查 `enteredTicketOf` 找回纪念票；不存在的票号查询会回退。票号与计数在 ethers v6 中是 `bigint`。 |

成员 3、5 使用 `src/config/contract.js` 中的统一配置和 ABI。旧 `admit(address)`、`hasClaimed(address)`、`admitted(address)` 已不适用；部署地址使用上方已核实的 Sepolia 地址。
