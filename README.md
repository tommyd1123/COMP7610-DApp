# COMP7610 Final Project DApp

English summary: a five-person course project. The page must connect a wallet, call a smart contract on the Sepolia testnet through ethers.js, and show one real transaction. Group work is due on 8 November 2026, 23:59. Start with the Chinese steps below.

这是小组自己的仓库。老师的作业 PDF 和教学示例不在这里，说明见 `docs/00-这份作业是什么.md`。

## 你现在只要做这三件事

1. 按下面的命令把页面在自己电脑上打开。
2. 读 `docs/00-这份作业是什么.md`、`docs/01-教授给的框架和代码.md`、`docs/02-五人分工与报告.md`。
3. 组长把五个人的姓名填进分工表，本周开会定下一句产品介绍，写进 `docs/report/大纲.md`。

点「Link MetaMask Wallet」会显示「钱包连接还没实现」。这是正常的，那一块留给成员 3。

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
| 钱包 | MetaMask | 浏览器扩展 |
| 网络 | Sepolia | 链 ID `11155111`（十六进制 `0xaa36a7`） |
| 核对交易 | Etherscan | <https://sepolia.etherscan.io> |

前端框架老师允许 React、Vue 或纯 JS。本仓库已经是 React，小组沿用即可。

## 目录

| 路径 | 谁改 | 里面是什么 |
| --- | --- | --- |
| `contracts/` | 成员 2 | 合约。现在只有说明，源码还没写 |
| `src/config/contract.js` | 成员 1、2 | 合约地址、ABI、链 ID |
| `src/wallet/ethereum.js` | 成员 3 | 连接钱包、切网络、发交易 |
| `src/chain/read.js` | 成员 5 | 只读查询，不发交易 |
| `src/App.jsx`、`src/ui/` | 成员 4 | 页面 |
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

终端会打印本地地址，一般是 `http://localhost:5173`。用装了 MetaMask 的 Chrome 或 Firefox 打开。

你应该看到一张卡片，上面有黄色提示：还没有填写合约地址。这是对的。等成员 2 在 Sepolia 部署之后，把地址写进 `.env` 的 `VITE_CONTRACT_ADDRESS`，然后停掉 `npm run dev` 再开一次。Vite 只在启动时读取 `.env`。

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

- 产品的一句话还没定。当前页面文字只是老师教程的领票界面。
- 钱包连接和铸造还没写，点按钮会提示负责人。
- 还没有部署到 Sepolia 的合约地址，也还没有演示用的交易哈希。
- 报告五章还是空的，见 `docs/report/大纲.md`。

终稿截止：2026-11-08 23:59。小组交视频、报告 PDF 和本仓库。每个人另外在 Moodle 交 Peer assignment 04。
