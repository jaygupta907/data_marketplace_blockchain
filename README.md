# 🧠 Decentralized AI Data Marketplace

This project implements a foundational decentralized data marketplace for AI training, leveraging blockchain technology (Ethereum, simulated by Ganache) for secure, transparent, and incentive-aligned data sharing.

## 🚀 Features

- **Custom ERC-20 Token (MyToken)**  
  Used for all economic interactions within the marketplace (staking, payments).

- **Decentralized Staked Review and Reputation System (DataReview.sol)**  
  - Data providers stake tokens when submitting datasets to ensure quality.  
  - Reviewers stake tokens to become eligible to review.  
  - Basic review submission and reputation updates.

- **Composable Data Bundles & Revenue-Sharing (DataBundle.sol)**  
  - Group multiple datasets into a single “bundle” (ERC-721 NFT).  
  - Automated revenue distribution to dataset contributors based on weights.

- **Off-chain Data (Conceptual)**  
  - Data stored off-chain (e.g., IPFS), while blockchain manages metadata, access rights, and payments.

- **Python Integration (web3.py)**  
  - Scripts to deploy and interact with smart contracts.

- **React UI for Real-time Visualization**  
  - Monitor ETH and MTK token balances.  
  - Submit datasets, stake as reviewer, submit reviews.  
  - Create, manage, and purchase data bundles.  
  - View reviewer reputations and real-time dataset/bundle updates.

---
## 🧱 Project Structure

```bash
blockchain_ai_marketplace/
├── contracts/
│ ├── MyToken.sol
│ ├── DataReview.sol
│ └── DataBundle.sol
├── scripts/
│ ├── deploy.py
│ └── interact.py
├── visualisation/
│ ├── marketplace_visualiser.css
│ ├── marketplace_visualiser.html
│ └── marketplace_visualiser.js
├── node_modules/
├── contract_addresses.json
├── package.json
├── visualise.py
└── README.md
```
---

## ⚙️ Prerequisites

- **Node.js & npm**  
  Download: https://nodejs.org/

- **Python 3.x & pip**  
  Download: https://www.python.org/downloads/

- **Ganache CLI**  
```bash
npm install -g ganache-cli
```

- **Solidity Compiler (solc)**  
```bash
npm install -g solc
```

- **Web3 (Python)**  
```bash
pip install web3
```

---


## 🛠️ Setup Instructions

### ✅ Step 1: Initial Project Setup

```bash
mkdir blockchain_ai_marketplace
cd blockchain_ai_marketplace
mkdir contracts
# Add MyToken.sol, DataReview.sol, DataBundle.sol
npm install @openzeppelin/contracts

mkdir scripts
# Add deploy.py and interact.py
```
###  ✅ Step 2: Compile Smart Contracts  
```bash
mkdir build
solcjs --bin --abi contracts/MyToken.sol contracts/DataReview.sol contracts/DataBundle.sol \
--include-path node_modules/ --base-path . -o build/

# Rename outputs:
mv build/contracts_MyToken_sol_MyToken.abi build/MyToken.json
mv build/contracts_MyToken_sol_MyToken.bin build/MyToken.bin
mv build/contracts_DataReview_sol_DataReview.abi build/DataReview.json
mv build/contracts_DataReview_sol_DataReview.bin build/DataReview.bin
mv build/contracts_DataBundle_sol_DataBundle.abi build/DataBundle.json
mv build/contracts_DataBundle_sol_DataBundle.bin build/DataBundle.bin
```
### ✅ Step 3: Start Ganache CLI
```bash
cd blockchain_ai_marketplace
ganache-cli
```

### ✅ Step 4: Deploy Smart Contracts (Python)
```bash
cd blockchain_ai_marketplace
python scripts/deploy.py
```
This will deploy contracts and generate contract_addresses.json.

