# COMP7610 Final Project DApp

English summary: a five-person course project. The page must connect a wallet, call a smart contract on the Sepolia testnet through ethers.js, and show one real transaction. Group work is due on 8 November 2026, 23:59. Start with the Chinese steps below.

这是小组自己的仓库。老师的作业 PDF 和教学示例不在这里，说明见 `docs/00-这份作业是什么.md`。

## 故事

这是小组自己定的场景，不是作业 PDF 里的原文。老师示例只有「领取一张 NFT」。我们在这上面加了座位数、转让、退票和入场核销。当前代码只有两个占位页面；新版设计安排三个业务页面，合约和网页功能都还未实现。

一个学生社团办一场免费讲座，一共 50 个座位。同学现在如果用表格报名，干部可以改名单，同一个人可以提交两次，别人只能看截图。

故事包含四个操作，分别放在活动、我的门票、主办方三个页面里：

1. **领票**（`#claim`）。同学连接钱包，有空位、当前没有有效票、这个地址未入场，才能领取。剩余座位减一，每个地址最多持有一张有效票。
2. **转让**（`#ticket` 的「我的门票」）。持有人把未核销票转给另一同学，入场资格跟着 NFT 转移，剩余座位不变。转出后可以重新领取。
3. **退票**（同一「我的门票」页面）。持有人把未核销 NFT 交回主办方，也就是部署者钱包，取消入场资格，剩余座位加一。下一次领取优先复用这张退回票；原持有人也可以重新领取。票免费，没有退款。
4. **入场**（`#door`）。部署者钱包是主办方，按票号核销当前持有人。已核销 NFT 留在同学钱包作纪念，但不能再转让、退票或重复核销，已入场地址也不能再次领取或接收票。

四个操作都是 Sepolia 上的交易，都可以在 Etherscan 打开。一个人换一个钱包再领一张，这版挡不住。票上没有图片。

> Students claim a free seminar ticket, transfer it to another student, or return it to the organizer so the seat can be claimed again. The organizer checks in the current ticket holder once.

完整规则、拟定接口和验收步骤见 [`docs/03-转让退票与票务流程.md`](docs/03-转让退票与票务流程.md)。该文件是下一步实现方案；当前源码占位和 ABI 仍是旧版，成员 2、3、5 先同步接口，再分别实现。

页面数量、钱包弹窗、按钮跳转和界面状态见 [`docs/04-页面与交互设计.md`](docs/04-页面与交互设计.md)。

## 设计与原型演示

[Figma 黑白灰设计稿](https://www.figma.com/design/heOrdlDjJbrbyY5WagefQH/COMP7610-%C2%B7-Seminar-Tickets-%C2%B7-Monochrome?node-id=0-1&t=IKL0Dn3s5v6NEcxV-1)

设计包含三个页面：活动领票、我的门票、主办方检票。连接钱包使用共用弹窗；转让和退票在「我的门票」里完成。完整闭环是连接钱包 → 领票 → 持有、转让或退票 → 主办方检票 → 保留已核销纪念 NFT。退票释放名额，原票可再次领取。

- [62 秒原型操作录屏](docs/demo/DAPP-原型操作演示.mp4)
- 核心截图：[活动领票](docs/demo/01-活动领票.png)、[我的门票](docs/demo/02-我的门票.png)、[主办方检票](docs/demo/03-主办方检票.png)
- [已核销纪念票状态](docs/demo/04-已核销纪念票.png)（属于「我的门票」，不是第四个页面）
- [发给组员的精简说明](docs/demo/发给组员的说明.txt)

![三个核心页面总览](docs/demo/三个核心页面总览.png)

截图和录屏展示 Figma 原型的模拟交互，数值和地址是演示数据；链上交易、前端和合约功能仍待实现。

## 你现在只要做这三件事

1. 按下面的命令把页面框架在自己电脑上打开，点顶部两个链接确认有领票页和入场页。
2. 读 `docs/02-五人分工与报告.md`，看自己的目录。函数体是空的，由对应的人来写。
3. 组长把五个人的姓名填进分工表。

## 技术栈

| 层 | 选用 | 版本 |
| --- | --- | --- |
| 运行环境 | Node.js | 20.19 或更高，或者 22.12 或更高。本机已验证 20.19.6 |
| 包管理 | npm | 随 Node 自带 |
| 前端 | React | 19.2 |
| 构建 | Vite | 8.3 |
| 连链 | ethers | 6.17 |
| 合约 | Solidity | 0.8.30。库用 OpenZeppelin Contracts 5.6.1，和老师示例一致 |
| 部署合约 | Remix | 浏览器打开即可，本仓库没有 Hardhat |
| 钱包 | MetaMask | 浏览器扩展，小组已经安装 |
| 网络 | Sepolia | 链 ID `11155111`（十六进制 `0xaa36a7`） |
| 核对交易 | Etherscan | <https://sepolia.etherscan.io> |

前端框架老师允许 React、Vue 或纯 JS。本仓库已经是 React，小组沿用即可。

## 目录

| 路径 | 谁改 | 里面是什么 |
| --- | --- | --- |
| `contracts/` | 成员 2 | 合约。现在只有要写的函数名单，Solidity 还没写 |
| `src/config/contract.js` | 成员 1、2 | 合约地址、ABI、座位上限 50、链 ID；ABI 待按 `docs/03` 更新 |
| `src/wallet/ethereum.js` | 成员 3 | 当前连接、领票、核销三个函数未实现；还需加转让和退票 |
| `src/chain/read.js` | 成员 5 | 当前查询未实现；需改为有效票号、当前所有者、票状态、是否入场和剩余座位 |
| `src/pages/ClaimPage.jsx` | 成员 4 | 现有领票页框架；新版活动与领票页 |
| `src/pages/TicketPage.jsx`（待新建） | 成员 4 | 我的门票、转让、退票和纪念票状态 |
| `src/pages/DoorPage.jsx` | 成员 4 | 入场页框架；待按票号查询和核销 |
| `src/App.jsx` | 成员 4 | 当前切换两个页面；待增加 `#ticket`，共享钱包状态与弹窗 |
| `docs/` | 全组读，成员 5 收报告 | 作业要求、老师给的代码、分工、报告草稿 |
| `.env` | 每人自己本地有一份 | 不提交。从 `.env.example` 复制 |

## 在自己电脑上打开页面

在仓库根目录执行：

```bash
node -v
npm install
cp .env.example .env
npm run dev
```

终端会打印本地地址，一般是 `http://localhost:5173`。用已经装好 MetaMask 的浏览器打开。打开页面前，在扩展里把网络选成 Sepolia。

当前代码会显示顶部两个链接：Claim a seat 和 Door。页面里只有标题和一句「留给成员 4」；设计稿中的 My ticket 尚未接入代码。等成员 2 在 Sepolia 部署之后，把地址写进 `.env` 的 `VITE_CONTRACT_ADDRESS`，然后停掉 `npm run dev` 再开一次。Vite 只在启动时读取 `.env`。

其他命令：

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 本地开发，改代码会自动刷新 |
| `npm run build` | 生成 `dist/`，这是打包结果，不要提交 |
| `npm run preview` | 本地查看打包结果 |
| `npm run lint` | 跑 Oxlint |

## 合约地址怎么来

1. 成员 2 用 Remix 把合约部署到 Sepolia，不要选 Remix VM。
2. 复制部署出来的合约地址，不是自己的钱包地址，也不是交易哈希。
3. 写进本地 `.env`。这个地址可以公开，写进 README。私钥和助记词不能写进仓库、`.env` 或视频。

老师示例的逐步截图式说明在他的仓库里：<https://github.com/jzjzzzzzzz/nft-ticket-dapp>。

## 还没做完的事

- 现有两个页面、钱包函数、只读查询、合约源码都还是空位；新版还需新增我的门票页面与全局钱包弹窗，按 `docs/02` 和 `docs/04` 分工实现。
- 2026-10-08 新增的转让、退票、退票复用和按票号核销目前仅完成规划，详见 `docs/03-转让退票与票务流程.md`。
- 还没有部署到 Sepolia 的合约地址，也还没有演示用的交易哈希。
- 报告正文还没写，大纲在 `docs/report/大纲.md`。

终稿截止：2026-11-08 23:59。小组交视频、报告 PDF 和本仓库。每个人另外交 Peer assignment，具体入口和题目以 Moodle 为准。
