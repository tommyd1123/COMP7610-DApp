# COMP7610 Final Project DApp

English summary: a five-person course project. The page must connect a wallet, call a smart contract on the Sepolia testnet through ethers.js, and show one real transaction. Group work is due on 8 November 2026, 23:59. Start with the Chinese steps below.

这是小组自己的仓库。老师的作业 PDF 和教学示例不在这里，说明见 `docs/00-这份作业是什么.md`。

## 故事

这是小组自己定的场景，不是作业 PDF 里的原文。老师示例只有「领取一张 NFT」。我们在这上面加了座位数和入场核销。合约和两个页面都还没写完，下面是要做成的故事。

一个学生社团办一场免费讲座，一共 50 个座位。同学现在如果用表格报名，干部可以改名单，同一个人可以提交两次，别人只能看截图。

故事分成两段，对应两个页面：

1. **领票**（`#claim`）。同学连接自己的钱包，领取一张入场 NFT。还有空位才能领，领完剩余座位减一，座位满了就拒绝。同一个地址不能领第二次。
2. **入场**（`#door`）。工作人员用另一个钱包，填入同学的地址，核销一次。合约记下已入场，第二次核销会失败。

两笔都是 Sepolia 上的交易，都可以在 Etherscan 打开。一个人换一个钱包再领一张，这版挡不住。票上没有图片。

> A student claims one free seminar seat while seats remain. Staff later check that student in once. Anyone can verify both transactions on Etherscan.

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
| `src/config/contract.js` | 成员 1、2 | 合约地址、ABI、座位上限 50、链 ID |
| `src/wallet/ethereum.js` | 成员 3 | 连接钱包、领票、入场核销。三个函数都会抛出「还没实现」 |
| `src/chain/read.js` | 成员 5 | 剩余座位、是否领过、是否已入场。只读，还没实现 |
| `src/pages/ClaimPage.jsx` | 成员 4 | 领票页框架 |
| `src/pages/DoorPage.jsx` | 成员 4 | 入场页框架 |
| `src/App.jsx` | 成员 4 | 只负责在两个页面之间切换 |
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

你会看到顶部两个链接：Claim a seat 和 Door。页面里只有标题和一句「留给成员 4」。这是框架，不是做完的功能。等成员 2 在 Sepolia 部署之后，把地址写进 `.env` 的 `VITE_CONTRACT_ADDRESS`，然后停掉 `npm run dev` 再开一次。Vite 只在启动时读取 `.env`。

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

- 两个页面、钱包函数、只读查询、合约源码都还是空位，按 `docs/02-五人分工与报告.md` 各自去写。
- 还没有部署到 Sepolia 的合约地址，也还没有演示用的交易哈希。
- 报告正文还没写，大纲在 `docs/report/大纲.md`。

终稿截止：2026-11-08 23:59。小组交视频、报告 PDF 和本仓库。每个人另外在 Moodle 交 Peer assignment 04。
