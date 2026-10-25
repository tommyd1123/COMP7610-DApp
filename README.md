# COMP7610 Final Project DApp

English summary: a five-person course project. The page must connect a wallet, call a smart contract on the Sepolia testnet through ethers.js, and show one real transaction. Group work is due on 8 November 2026, 23:59. Start with the Chinese steps below.

这是小组自己的仓库。老师的作业 PDF 和教学示例不在这里，说明见 `docs/00-这份作业是什么.md`。

## 故事

这是小组自己定的场景，不是作业 PDF 里的原文。老师示例只有「领取一张 NFT」。我们在这上面加了座位数、转让、退票和入场核销。合约与完整 ABI 已实现，已部署到 Sepolia 并通过初始核验；网页的活动页和我的门票已接上英文界面与钱包连接。主办方检票下一步再单独提交。

一个学生社团办一场免费讲座，一共 50 个座位。同学现在如果用表格报名，干部可以改名单，同一个人可以提交两次，别人只能看截图。

故事包含四个操作，分别放在活动、我的门票、主办方三个页面里：

1. **领票**（`#claim`）。同学连接钱包，有空位、当前没有有效票、这个地址未入场，才能领取。剩余座位减一，每个地址最多持有一张有效票。
2. **转让**（`#ticket` 的「我的门票」）。持有人把未核销票转给另一同学，入场资格跟着 NFT 转移，剩余座位不变。转出后可以重新领取。
3. **退票**（同一「我的门票」页面）。持有人把未核销 NFT 交回主办方，也就是部署者钱包，取消入场资格，剩余座位加一。下一次领取优先复用这张退回票；原持有人也可以重新领取。票免费，没有退款。
4. **入场**（`#door`）。部署者钱包是主办方，按票号核销当前持有人。已核销 NFT 留在同学钱包作纪念，但不能再转让、退票或重复核销，已入场地址也不能再次领取或接收票。

四个业务操作会产生可在 Etherscan 核对的交易。部署与 Account 1 领取 → 退票 → 同票号重领验收已完成；转让、核销仍需小组网页联调演示。一个人换一个钱包再领一张，这版挡不住。票上没有图片。

> Students claim a free seminar ticket, transfer it to another student, or return it to the organizer so the seat can be claimed again. The organizer checks in the current ticket holder once.

完整规则、已实现的合约接口和验收步骤见 [`docs/03-转让退票与票务流程.md`](docs/03-转让退票与票务流程.md)。合约位于 `contracts/SeminarTickets.sol`；`src/config/contract.js` 导入编译生成的完整 ABI。成员 3、5 按新接口补充交易与查询，成员 4 接入页面。

页面数量、钱包弹窗、按钮跳转和界面状态见 [`docs/04-页面与交互设计.md`](docs/04-页面与交互设计.md)。

成员 2 的部署步骤、验收与接口交接见 [`docs/05-成员2部署与交接.md`](docs/05-成员2部署与交接.md)；英文 Design / Implementation 材料已写入 [`docs/report/成员2-合约设计与实现.md`](docs/report/成员2-合约设计与实现.md)。2026-10-24 本地验证：32 项合约、8 项部署工具和 3 项辅助页测试，共 **43 项全部通过**。

## Sepolia 部署记录

- 合约：[0x273d4F66420C2Bac602bdcfe4A5Bc395B1dC2dE3](https://sepolia.etherscan.io/address/0x273d4F66420C2Bac602bdcfe4A5Bc395B1dC2dE3)
- 主办方：`0x5bA8D6f1dCDb101D6a4EF905788CEBC048b2b133`，已与 `organizer()` 核对。
- [部署交易](https://sepolia.etherscan.io/tx/0xab973e92f52498745b6add116d73b5ea1901cd94df05d649f6027e17303bd6d9)：区块 `11984380`，回执成功。
- 实际通过本地部署辅助页与 MetaMask 部署；固定区块 `11984383` 核验通过，运行时代码、创建字节码、元数据均匹配，初始余票 50、已铸造 0。Account 1 三笔业务交易均成功，票号 1 被复用，余票 49 → 50 → 49；[完整证据](docs/evidence/sepolia-lifecycle.json)与[最终核验](docs/evidence/sepolia-final.json)已保存。

## 设计与原型演示

[Figma 黑白灰设计稿](https://www.figma.com/design/heOrdlDjJbrbyY5WagefQH/COMP7610-%C2%B7-Seminar-Tickets-%C2%B7-Monochrome?node-id=0-1&t=IKL0Dn3s5v6NEcxV-1)

设计包含三个页面：活动领票、我的门票、主办方检票。连接钱包使用共用弹窗；转让和退票在「我的门票」里完成。完整闭环是连接钱包 → 领票 → 持有、转让或退票 → 主办方检票 → 保留已核销纪念 NFT。退票释放名额，原票可再次领取。

- [62 秒原型操作录屏](docs/demo/DAPP-原型操作演示.mp4)
- 核心截图：[活动领票](docs/demo/01-活动领票.png)、[我的门票](docs/demo/02-我的门票.png)、[主办方检票](docs/demo/03-主办方检票.png)
- [已核销纪念票状态](docs/demo/04-已核销纪念票.png)（属于「我的门票」，不是第四个页面）
- [发给组员的精简说明](docs/demo/发给组员的说明.txt)

![三个核心页面总览](docs/demo/三个核心页面总览.png)

截图和录屏展示 Figma 原型的模拟交互，数值和地址是演示数据；它们不是运行中的 DApp。合约已部署 Sepolia；本地部署辅助页用于成员 2 验收，正式前端仍待实现。

## 你现在只要做这三件事

1. 按下面的命令把页面框架在自己电脑上打开，点 Event、My ticket 和页脚 Organizer access，确认三个页面都能打开。
2. 读 `docs/02-五人分工与报告.md`，看自己的目录。合约已实现，钱包、查询和页面仍由对应成员补全；合约本地验证和部署说明见 `contracts/README.md`。
3. 组长把五个人的姓名填进分工表。

## 技术栈

| 层 | 选用 | 版本 |
| --- | --- | --- |
| 运行环境 | Node.js | 20.19 或更高，或者 22.12 或更高。本次本地验证使用 22.23.2 |
| 包管理 | npm | 随 Node 自带 |
| 前端 | React | 19.2 |
| 构建 | Vite | 8.3 |
| 连链 | ethers | 6.17 |
| 合约 | Solidity | 0.8.30。库用 OpenZeppelin Contracts 5.6.1，和老师示例一致 |
| 合约本地验证 | solc + Hardhat 2 | solc 0.8.30 编译；Hardhat 只提供本地测试网络 |
| 部署合约 | 本地部署辅助页 + MetaMask | 本次实际方式；optimizer 200、EVM Cancun，Remix 步骤保留作备用 |
| 钱包 | MetaMask | 浏览器扩展，小组已经安装 |
| 网络 | Sepolia | 链 ID `11155111`（十六进制 `0xaa36a7`） |
| 核对交易 | Etherscan | <https://sepolia.etherscan.io> |

前端框架老师允许 React、Vue 或纯 JS。本仓库已经是 React，小组沿用即可。

## 目录

| 路径 | 谁改 | 里面是什么 |
| --- | --- | --- |
| `contracts/` | 成员 2 | `SeminarTickets.sol`：领取、转让、退票复用、核销及只读接口；已部署 Sepolia |
| `src/config/contract.js` | 成员 1、2 | 合约地址、座位上限 50、链 ID；导入 `SeminarTickets.abi.json` 的完整 ABI |
| `src/wallet/ethereum.js` | 成员 3 | 当前连接、领票、核销三个函数未实现；还需加转让和退票 |
| `src/chain/read.js` | 成员 5 | 当前查询未实现；需接入有效票号、纪念票号、当前所有者、票状态、是否入场和剩余座位 |
| `src/pages/ClaimPage.jsx` | 成员 4 | 现有领票页框架；新版活动与领票页 |
| `src/pages/TicketPage.jsx` | 成员 4 | 我的门票、转让、退票和纪念票状态 |
| `src/pages/DoorPage.jsx` | 成员 4 | 入场页框架；待按票号查询和核销 |
| `src/App.jsx` | 成员 4 | 三个页面路由：`#claim`、`#ticket`、`#door`，以及共用钱包弹窗 |
| `docs/` | 全组读，成员 5 收报告 | 作业要求、老师给的代码、分工、报告草稿 |
| `.env` | 每人自己本地有一份 | 不提交。从 `.env.example` 复制 |

## 可选辅助网页（部署与测试示例）

`scripts/deployment-preview/` 是成员 2 为部署和验收编写的本地辅助网页，由 `scripts/deployment-preview.mjs` 启动。它演示 MetaMask 连接、部署、领取、退票和重新领取，并展示交易记录；本次已用它完成 Sepolia 部署与验收。

**该工具不属于正式前端交接范围，也不代表成员 3、4、5 的页面、钱包和查询任务已经完成。** 正式 DApp 在 `src/` 中开发。组员接入时使用已部署的合约地址、完整 ABI 和交接文档即可，无需运行辅助页或重新部署合约；可以参考其中的调用代码。

需要查看辅助页时运行 `npm run preview:deployment`，再用装有 MetaMask 的浏览器打开 `http://127.0.0.1:4174`。工具目前限定本次验收的 Account 2 和 Account 1，写操作会通过钱包提交真实的 Sepolia 测试网交易，并非模拟数据。关闭辅助页或终端不影响已部署的合约。

## 在自己电脑上打开页面

在仓库根目录执行：

```bash
node -v
npm install
cp .env.example .env
npm run dev
```

终端会打印本地地址，一般是 `http://localhost:5173`。用已经装好 MetaMask 的浏览器打开。打开页面前，在扩展里把网络选成 Sepolia。

当前页面是英文界面：顶部 Event（`#claim`）、My ticket（`#ticket`），页脚 Organizer access（`#door`）。把上方已部署的合约地址写进 `.env` 的 `VITE_CONTRACT_ADDRESS`，然后停掉 `npm run dev` 再开一次。Vite 只在启动时读取 `.env`。

其他命令：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地开发，改代码会自动刷新 |
| `npm run build` | 生成 `dist/`，这是打包结果，不要提交 |
| `npm run preview` | 本地查看打包结果 |
| `npm run lint` | 跑 Oxlint |
| `npm run compile:contract` | 编译合约并更新前端完整 ABI；不部署到测试网 |
| `npm run test:contract` | 在本地网络验证合约规则；不需要 MetaMask 或测试网 ETH |
| `npm run prepare:deployment` | 生成自包含标准编译输入、ABI、部署字节码及校验清单；不发送交易 |
| `npm run verify:deployment -- --help` | 查看 Sepolia 部署只读验收参数；核对代码、主办方和票务状态 |
| `npm run test:deployment` | 在本地网络验证部署工具的匹配及拒绝错误输入行为 |
| `npm run preview:deployment` | 打开本地 MetaMask 部署与领票 / 退票验收工具，默认 `http://127.0.0.1:4174` |
| `npm run test:deployment-preview` | 验证辅助页的账户、网络及重复发送保护 |

## 合约地址怎么来

1. 本次已用本地辅助页与 MetaMask 部署。成员接入时直接使用上方公开地址；重新部署步骤及 Remix 备用方式见 [`docs/05`](docs/05-成员2部署与交接.md)。
2. 复制部署出来的合约地址，不是自己的钱包地址，也不是交易哈希。
3. 写进本地 `.env`。这个地址可以公开，写进 README。私钥和助记词不能写进仓库、`.env` 或视频。

老师示例的逐步截图式说明在他的仓库里：<https://github.com/jzjzzzzzzz/nft-ticket-dapp>。

## 还没做完的事

- 活动页和我的门票已接上钱包弹窗。主办方检票下一步单独提交。转让、核销仍需要对应钱包在 Sepolia 上联调。
- 合约已实现领取、转让、退票复用和按票号核销，前端需要接入新 ABI；纪念票刷新查询使用 `enteredTicketOf(address)`，详见 `docs/03-转让退票与票务流程.md`。
- 成员 2 的部署、领票 → 退票 → 重领及最终链上核验已完成；正式网页的转让、核销和完整演示还需联调。
- 成员 2 的合约报告材料已补部署、三笔业务交易及最终状态证据；其他章节仍按 `docs/report/大纲.md` 汇总。

终稿截止：2026-11-08 23:59。小组交视频、报告 PDF 和本仓库。每个人另外交 Peer assignment，具体入口和题目以 Moodle 为准。
