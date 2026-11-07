# Seminar Ticket DApp

COMP7610 Introduction to Web3 and Blockchain — Final Project

A ticketing DApp for a free campus seminar with 50 seats. Students use MetaMask to claim, transfer or return an ERC-721 ticket on Sepolia. The organizer checks in each ticket holder once. The used NFT stays in the student's wallet as a souvenir and cannot be transferred.

## Project overview

We built on the course example of claiming an NFT. We added a seat limit, ticket transfers, ticket returns, ticket reuse and one-time check-in. The frontend reads blockchain data through ethers.js. MetaMask signs transactions, and the smart contract checks the rules.

The app has three pages: Event, My ticket and Organizer check-in. All three connect to the deployed Sepolia contract. Wallet connection, transfers and returns use dialogs. The souvenir ticket is a state on My ticket, not a fourth page.

The project records include 43 passing local tests and five successful browser transactions. These transactions cover all four ticket actions. Details are listed below.

## Features

| Action | Page | Rules and result |
| --- | --- | --- |
| Claim | Event · `#claim` | A student can claim if seats are available, the wallet has no active ticket and the wallet has not checked in. The contract reuses a returned ticket first. Otherwise, it mints a new ticket. |
| Transfer | My ticket · `#ticket` | The holder can send an unused ticket to another wallet that meets the rules. The ticket ID and available seat count stay the same. The new holder gets the right to enter. The sender can claim again if they have not checked in. |
| Return | My ticket · `#ticket` | The holder can return an unused ticket to the organizer. This frees one seat. Another claim can reuse the ticket ID. Tickets are free, so there is no ETH refund. |
| Check in | Organizer check-in · `#door` | Only the wallet that deployed the contract can check in a holder by ticket ID. The holder keeps a souvenir NFT. It cannot be transferred, returned or checked in again. |

Each wallet can hold at most one active ticket. A wallet that has checked in cannot claim or receive another ticket. The organizer wallet holds returned tickets and handles check-in. It cannot claim a student ticket. The most recently returned ticket is reused first.

The seat counts follow this rule:

```text
remaining + activeCount + usedCount = 50
```

Check-in changes an active ticket into a used ticket. It does not free a seat. Standard ERC-721 transfer functions follow the same rules. The contract updates state before a receiver callback and uses reentrancy guards on the relevant functions.

## Quick start

### Requirements

- Node.js: use **22.23.2**, the version recorded in the project tests, with its bundled npm.
- Git, if cloning the repository. Alternatively, download the repository ZIP and extract it.
- A browser with MetaMask. Select the **Sepolia** network.
- A small amount of Sepolia test ETH for gas. The ticket itself is free.
- Internet access for installing dependencies and reading or sending Sepolia transactions.

### Install

Clone the repository and enter its root folder:

```bash
git clone https://github.com/tommyd1123/COMP7610-DApp.git
cd COMP7610-DApp
```

If using a ZIP or an existing checkout, open a terminal in the extracted project folder containing `package.json` instead. Install the versions recorded in `package-lock.json`:

```bash
node -v
npm ci
```

### Configure

For a new checkout, copy the environment example. Keep an existing `.env` if already configured. On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux:

```bash
cp .env.example .env
```

**Edit `.env` and replace the sample address with this deployed contract address:**

```dotenv
VITE_CONTRACT_ADDRESS=0x273d4F66420C2Bac602bdcfe4A5Bc395B1dC2dE3
```

This is the only frontend environment variable currently read by the code. It is a public **contract address**, not a wallet address or private key. Wallet signing stays in MetaMask. The app does not require an API key, database or separate backend server.

The read-only RPC URL is set in `src/chain/read.js` to `https://ethereum-sepolia-rpc.publicnode.com`; event queries begin at block `11984380`. The network and explorer are set in `src/config/contract.js`. The checked-in ABI already matches the existing deployment, so compiling Solidity is not required to start the frontend.

### Run

Start the app:

```bash
npm run dev
```

Open the address shown in the terminal, usually `http://localhost:5173`. Use Event and My ticket at the top. Use Organizer access in the footer to open the check-in page. Restart Vite after changing `.env`.

The app uses the existing contract. **You do not need to deploy it again or start the deployment helper.** Student wallets can use the ticket pages. Only the organizer wallet listed below can confirm check-in.

### Try the app

1. Open Event (`#claim`). The available-seat count should load from the contract. The shared contract already contains earlier test transactions, so the count may be lower than 50.
2. Connect a student wallet on Sepolia. It must have test ETH for gas, no active ticket and no previous check-in. Claim a ticket, confirm in MetaMask and wait for the receipt. Open My ticket (`#ticket`) to see the ticket ID and owner.
3. To test a transfer, use a second eligible student wallet as the recipient. Click the connected address in the header and choose **Switch account** to select the receiving account through MetaMask. Confirm that My ticket shows the same ticket ID for the new holder.
4. To test a return, use the current holder's wallet and choose **Return to organizer** on an active ticket. After confirmation, one seat becomes available. A later claim can reuse the returned ticket.
5. To test check-in on an active ticket, connect the **actual organizer wallet** (`0x5bA8D6f1dCDb101D6a4EF905788CEBC048b2b133`), open Organizer access (`#door`), look up the ticket ID and confirm check-in. The holder then sees a souvenir ticket. Check-in is permanent for that wallet and ticket; test transfer and return before checking in.

A reviewer can use their own student wallets. Knowing the organizer's public address does not grant permission to check in tickets; this step requires the team member who controls that wallet. To review all roles independently, deploy a separate instance using the [contract guide](contracts/README.md#remix-备用部署步骤), configure its address, and update `FROM_BLOCK` in `src/chain/read.js` to its deployment block. The new deployer becomes that instance's organizer.

### Build and preview

After configuring `.env`, run these commands in order:

```bash
npm run build
npm run preview
```

Open the preview URL printed by Vite, normally `http://localhost:4173`. Keep the terminal running; press `Ctrl+C` to stop either server. Vite embeds the contract address at build time, so changing `.env` requires a new build before previewing or hosting `dist/`. The preview server is for checking the production build locally.

### Troubleshooting

| Symptom | What to check |
| --- | --- |
| Installation or Vite reports an unsupported Node version | Check `node -v`, select Node.js 22.23.2 and run `npm ci` again from the folder containing `package.json`. |
| Invalid contract address, blank page or seat count does not load | Replace the placeholder in the root `.env` with the deployed address above. Restart the development server, or rebuild before using preview. |
| MetaMask is unavailable | Install and unlock the extension in the same browser profile that opens the app, then reload the page. |
| Wrong-network message | Select Sepolia in MetaMask (chain ID `11155111`) and reload if needed. |
| A transaction cannot pay for gas | Fund the sending wallet with Sepolia test ETH. Free admission does not remove the network gas fee. |
| The app shows the wrong account | Click the connected address, choose **Switch account**, and select the intended account in MetaMask. |
| Claim, transfer or check-in is disabled or rejected | Check ticket ownership, available seats, whether the wallet already holds a ticket or has checked in, and whether check-in uses the organizer wallet. |
| Reads or activity links fail despite correct configuration | Check access to the public RPC. If it is unavailable or limits event queries, replace the URL in `src/chain/read.js` with a working Sepolia RPC and restart or rebuild. There is no RPC environment variable in this version. |

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the app's development server. |
| `npm run build` | Build the app into `dist/`. |
| `npm run preview` | Preview the built app. |
| `npm run lint` | Check the source with Oxlint. |
| `npm run compile:contract` | Compile Solidity and update the contract files and frontend ABI. This does not deploy the contract. |
| `npm run test:contract` | Run local contract tests. |
| `npm run test:deployment` | Test the deployment preparation and checking tools. |
| `npm run test:deployment-preview` | Test the deployment helper. |
| `npm run prepare:deployment` | Create the standard compiler input, ABI, deployment bytecode and check files. This sends no transaction. |
| `npm run verify:deployment -- --help` | Show the options for the read-only deployment checks. |
| `npm run preview:deployment` | Start the optional deployment and testing helper. |

## Technology and code

The exact package versions are in `package-lock.json`.

| Part | Tools and versions |
| --- | --- |
| Frontend | React / React DOM 19.3.0 |
| Build | Vite 8.3.0 |
| Blockchain connection | ethers 6.17.0 |
| Contract | Solidity / solc 0.8.30; OpenZeppelin Contracts 5.6.1 |
| Local tests | Hardhat 2.28.6 for the local network; Node.js `node:test` for tests |
| Compiler settings | Optimizer enabled, 200 runs; EVM Cancun |
| Wallet and network | MetaMask; Sepolia, chain ID `11155111` (`0xaa36a7`) |

Read-only calls use `JsonRpcProvider` and a public Sepolia RPC. They do not need a wallet signature. Write calls use `BrowserProvider` to get a signer. MetaMask asks the user to confirm each transaction. The wallet module waits for the transaction receipt, then returns the transaction hash.

The frontend shows messages for the wrong network, rejected requests, duplicate claims and check-in by a student wallet. The organizer page keeps the successful check-in hash and Etherscan link. If the next state read fails, the success result stays visible and the user is asked to look up the ticket again.

| Path | Contents |
| --- | --- |
| `contracts/SeminarTickets.sol` | Claim, transfer, return, reuse, check-in, seat limits and wallet rules. |
| `src/config/contract.js` | Contract address from `.env`, chain ID, ABI and explorer link settings. |
| `src/config/SeminarTickets.abi.json` | Full compiled ABI, including events and custom errors. |
| `src/wallet/ethereum.js` | Wallet connection, network switching and the four ticket transactions. |
| `src/chain/read.js` | Reads for seats, active tickets, souvenir tickets, owners, ticket states and activity. |
| `src/pages/ClaimPage.jsx` | Event details, available seats and claiming. |
| `src/pages/TicketPage.jsx` | Current ticket, transfer, return and souvenir state. |
| `src/pages/DoorPage.jsx` | Ticket lookup, organizer check-in and successful transaction links. |
| `src/ui/` | Shared session state, status messages, address formatting and error messages. |
| `src/App.jsx` | Hash routing for the three pages and the shared wallet dialog. |
| `test/` | Tests for the contract, deployment tools and deployment helper. |
| `scripts/` | Compilation, deployment preparation, read-only checks and helper tools. |
| `docs/evidence/` | Early deployment records and the claim, return and reclaim of ticket #1. |
| `docs/demo/` | Early design screenshots and a simulated prototype video. |

## Test results

The project records show **43 passing local tests** from 2026-10-24. Some contract cases run against several ERC-721 transfer functions.

| Test suite | Passed | Main checks |
| --- | ---: | --- |
| `test/SeminarTickets.test.mjs` | 32 | Seat limits, ticket reuse, permissions, standard transfers, receiver callbacks, reentrancy and rollback on failure. |
| `test/DeploymentTools.test.mjs` | 8 | Compiler and deployment output, code and state matching, and rejection of invalid input. |
| `test/DeploymentPreview.test.mjs` | 3 | Account and network limits, repeated-send protection and local HTTP server limits. |
| **Total** | **43** | |

To run the checks:

```bash
npm run test:contract
npm run test:deployment
npm run test:deployment-preview
npm run build
npm run lint
```

The local tests do not need MetaMask or Sepolia ETH. The earlier report records a successful production build. Lint had no errors and three React warnings. The build also reported a JavaScript chunk larger than 500 kB. Local tests check contract rules. The browser records below show the user flow.

The browser screenshots show successful runs of the four ticket actions. The check-in success link and English error messages were added later. Those screenshots do not show browser tests of every later message. See `src/pages/` and `src/ui/` for the code.

## Sepolia deployment and transaction records

### Deployment

- Contract: [0x273d4F66420C2Bac602bdcfe4A5Bc395B1dC2dE3](https://sepolia.etherscan.io/address/0x273d4F66420C2Bac602bdcfe4A5Bc395B1dC2dE3)
- Organizer: `0x5bA8D6f1dCDb101D6a4EF905788CEBC048b2b133`
- [Deployment transaction](https://sepolia.etherscan.io/tx/0xab973e92f52498745b6add116d73b5ea1901cd94df05d649f6027e17303bd6d9): block `11984380`, successful receipt.
- Deployment method: the local deployment helper and MetaMask.
- [Initial checks](docs/evidence/sepolia-initial.json): at block `11984383`, 50 seats were available and no tickets had been minted.
- [Final checks for the early ticket test](docs/evidence/sepolia-final.json): at block `11984520`, the checks compared runtime code, creation bytecode, metadata, organizer and state. This is an early snapshot, not the current live state.

Checking bytecode at a fixed block is different from publishing verified source code on Etherscan.

### Reusing a returned NFT

The [full ticket test record](docs/evidence/sepolia-lifecycle.json) contains three successful transactions for ticket #1.

| Action | Ticket | Available seats | Total minted | Transaction |
| --- | --- | ---: | ---: | --- |
| Claim | #1 | 49 | 1 | [Etherscan](https://sepolia.etherscan.io/tx/0x25c0d688a5e34c4332bc641a3f9a91430d7fc109f370892bf7820f7a53797175) |
| Return | #1 | 50 | 1 | [Etherscan](https://sepolia.etherscan.io/tx/0xf3937e97ac65e42508ab7b48c6ef64477b47a567963a7eca4f6eecb419d02fac) |
| Claim again | #1 | 49 | 1 | [Etherscan](https://sepolia.etherscan.io/tx/0x82e7900c5f5ea40b203d0b615091b8e16f0906d163663028b54f37a5e6717386) |

### Browser tests of the main app

Wang Yukai provided the operation record using these wallets. Student A and Student B are test roles, not team member names.

| Role | Address |
| --- | --- |
| Student A | `0xC9C2bE877D01Dc7a58bf3768c7da29E60f882bfd` |
| Student B | `0xD7C38095FB3967Ca44A70AF423B82Eb31a0ce9Be` |
| Organizer | `0x5bA8D6f1dCDb101D6a4EF905788CEBC048b2b133` |

Five successful transactions cover claim, transfer, check-in and return. Appendix B of the group report contains the frontend and Etherscan screenshots.

| Step | Action | Recorded result | Block | Transaction |
| --- | --- | --- | --- | --- |
| 1 | A claims #3 | The contract sends an existing ticket from the organizer to A. It does not mint a new ticket. | 12020310 | [Etherscan](https://sepolia.etherscan.io/tx/0x17664386a55ae84c48df826538dc8e320672477d016b6224ebb49e83c62b144f) |
| 2 | A transfers #3 to B | The ticket ID stays the same. B's page shows an active ticket. | 12020322 | [Etherscan](https://sepolia.etherscan.io/tx/0xc9b4eb09c4410757e838cc15c4116124d958cbc03f8bc7de8a946f2fcb1c905e) |
| 3 | Organizer checks in #3 | B keeps a souvenir NFT. Transfer and return buttons are disabled. | 12020333 | [Etherscan](https://sepolia.etherscan.io/tx/0x82b90e47aa75d7ce545a5c2f2269310aebe5e5ec56816a9f31dd71c7131647ee) |
| 4 | A claims #4 | A new ticket is minted to A from the zero address. | 12020349 | [Etherscan](https://sepolia.etherscan.io/tx/0x09832ef69fb01a7cba0fb1d618bf63abdf368a074241798c8a932139148f46a6) |
| 5 | A returns #4 | The NFT goes back to the organizer. | 12020353 | [Etherscan](https://sepolia.etherscan.io/tx/0x88a8ea30f3e430c9e436226b3c05c5ec984809071c4eaae7bb010d56ee782ec0) |

Ticket #3 was already used, so it could not be returned. A claimed #4 to test the return action. The #3/#4 browser tests and the earlier #1 reuse test are separate test sessions.

## Design prototype and deployment helper

### Early interface design

- [Figma design](https://www.figma.com/design/heOrdlDjJbrbyY5WagefQH/COMP7610-%C2%B7-Seminar-Tickets-%C2%B7-Monochrome?node-id=0-1&t=IKL0Dn3s5v6NEcxV-1)
- [Prototype video](docs/demo/DAPP-%E5%8E%9F%E5%9E%8B%E6%93%8D%E4%BD%9C%E6%BC%94%E7%A4%BA.mp4)
- [Event](docs/demo/01-%E6%B4%BB%E5%8A%A8%E9%A2%86%E7%A5%A8.png), [My ticket](docs/demo/02-%E6%88%91%E7%9A%84%E9%97%A8%E7%A5%A8.png), [Organizer check-in](docs/demo/03-%E4%B8%BB%E5%8A%9E%E6%96%B9%E6%A3%80%E7%A5%A8.png), [Souvenir ticket](docs/demo/04-%E5%B7%B2%E6%A0%B8%E9%94%80%E7%BA%AA%E5%BF%B5%E7%A5%A8.png)

![Early design of the three main pages](docs/demo/%E4%B8%89%E4%B8%AA%E6%A0%B8%E5%BF%83%E9%A1%B5%E9%9D%A2%E6%80%BB%E8%A7%88.png)

The images and video in `docs/demo/` show a Figma simulation. Their numbers and addresses are sample data, not proof of real blockchain transactions. The main app is in `src/`. Its browser transaction records are listed above.

### Optional deployment helper

`scripts/deployment-preview/` supports deployment and the claim, return and reclaim tests. Start it with `npm run preview:deployment`. Its default address is `http://127.0.0.1:4174`. It is separate from the main app started by `npm run dev`.

The helper only supports the accounts set for the deployment tests. It is not a general page for any wallet. Its write actions send Sepolia transactions through MetaMask. Use the main app for normal use and review.

See the [deployment and handover guide](docs/05-%E6%88%90%E5%91%982%E9%83%A8%E7%BD%B2%E4%B8%8E%E4%BA%A4%E6%8E%A5.md) for details.

## Known limits

- The rules apply per wallet address, not per person. One person can use several wallets. The organizer still checks who attends in person.
- The organizer address and 50-seat limit are fixed. There is no emergency pause, organizer change, event cancellation or contract upgrade.
- The frontend shows the event date and location. The contract does not close claims or check-in based on the event time.
- The frontend needs a working wallet and public RPC. Read-only calls use a fixed Sepolia RPC. Event queries start at the deployment block.
- The NFT has no artwork or per-ticket metadata. The souvenir state is stored on-chain, but wallets may not show a collectible image.
- After a transfer or return, the sender may see the no-ticket page. The Etherscan links above still show the transaction result.

## Team contributions

All five members discussed the background, seminar idea, 50-seat limit, wallet rules and full ticket flow. We then split the code, browser tests, interface updates and report work. The background and flow were a shared design. The table lists each member's main work and output.

| Member | UID | Main role | Work and output |
| --- | --- | --- | --- |
| Dong Yiyang | 3036842698 | Smart contract and deployment | Built claim, transfer, return, reuse and one-time check-in. Added wallet and seat rules, the full ABI, local tests and deployment tools. Deployed and checked the contract on Sepolia. Output: `contracts/`, `test/`, `scripts/`, `docs/evidence/`; [contract delivery commit](https://github.com/tommyd1123/COMP7610-DApp/commit/9e9e8f6). |
| Lu Shijie | 3036841228 | Frontend and integration | Built the ticket-flow prototype and the three app pages. Added the shared wallet dialog and session state. Connected blockchain reads and the four write actions. Added loading, no-ticket and souvenir states. Output: `src/App.jsx`, `src/pages/`, `src/ui/`, `src/wallet/ethereum.js`, `src/chain/read.js`; [prototype and flow](https://github.com/tommyd1123/COMP7610-DApp/commit/b915711), [wallet and ticket integration](https://github.com/tommyd1123/COMP7610-DApp/commit/b6d208a), [organizer page](https://github.com/tommyd1123/COMP7610-DApp/commit/2661b4d). |
| Wang Yukai | 3033113371 | Wallet operations and testing | Prepared the Student A, Student B and Organizer wallets on Sepolia. Ran claim, transfer, check-in and return in the main app. Checked each transaction on Etherscan. Saved hashes, steps and screenshots in a Word record. Output: the five transactions above and the operation and receipt screenshots in Appendix B of the group report. |
| Zhang Yidan | 3036841668 | Interface results and error messages | Added the Etherscan link after check-in. Added English messages and disabled states for MetaMask rejection, wrong network, duplicate claims and student wallets on the organizer page. Kept the existing layout. Changes are in `src/pages/` and `src/ui/`; [interface update](https://github.com/tommyd1123/COMP7610-DApp/commit/18e385e), [follow-up changes](https://github.com/tommyd1123/COMP7610-DApp/commit/877035d). |
| Zhang Ke | 3036866280 | Technical documentation and report coordination | Integrated the project background, system design and test results into the final report. Cross-checked descriptions against the code and transaction records, organized evidence appendices, and updated the README with implemented features and setup instructions. Output: the final report and revised README. |

### Later work and handover

1. After deployment, frontend integration and browser tests used the same Sepolia contract. Normal use and later tests did not need a new deployment.
2. The wallet tests covered all four ticket actions in the main app. The agreed scope for fixing wallet calls was `src/wallet/ethereum.js`. Ticket #3 was already used, so #4 was claimed for the return test.
3. The interface updates changed result messages and button states in `src/pages/` and `src/ui/`. The three-page layout stayed the same.
4. The report combined the code details, transactions and screenshots. It described the built features, recorded successful actions and later interface messages that still need browser checks.

Contributions include shared design, code, browser testing and report work. Git commits show code changes. The operation records and final report also show work that is not recorded in commits.
