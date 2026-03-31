# 🚁 Stellar Drone Tracker dApp v4.2

[![Stellar dApp CI](https://github.com/Adrija-Saha2006/Drone_tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Adrija-Saha2006/Drone_tracker/actions)
[![Stellar Network](https://img.shields.io/badge/Network-Stellar_Testnet-9C4AED?logo=stellar)](https://www.stellar.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](https://opensource.org/licenses/MIT)

A production-grade Ground Control Station (GCS) and Stellar dApp integration. This project combines military-grade drone telemetry tracking with advanced blockchain-based payment and integrity systems.

## 📺 Demo
- **Live Demo:** [Placeholder for Live Link]
- **Walkthrough Video:** [Placeholder for Demo Video]

## ✨ Key Features

### 1. 💼 Advanced Wallet Integration
- **Freighter Connectivity**: Native support for the Stellar Freighter wallet.
- **Auto-Detection**: Intelligently detects if the wallet is installed and handles network switching to **TESTNET**.
- **State Management**: Persistent session handling using local state and `localStorage`.

### 2. 📊 Real-time Balance Handling
- **XLM Tracking**: Live fetching of XLM balances on the Stellar Testnet.
- **Formatted Display**: Balances are clearly displayed with 4-decimal precision.
- **Smart Refresh**: Automatic balance synchronization after every successful transaction.

### 3. 💸 Secure Transaction Flow
- **Broadcast Payments**: Send XLM to any Stellar address with a single click.
- **Input Validation**: Strict client-side validation for Stellar Public Keys (56-char check) and amounts.
- **State-Aware UI**: Multi-stage loaders (Idle → Signing → Submitting → Success/Failure).
- **Direct Explorer Links**: One-click access to **StellarExpert** to verify transaction hashes.

### 4. 🛰️ Drone Mission Command
- **ZK-Handshake**: Zero-Knowledge proof simulation for hardware authorization.
- **Mission Integrity**: Secure flight path waypoints by anchoring their SHA-256 hashes to the blockchain.
- **Tactical Maps**: ESRI Satellite imagery with real-time telemetry overlays.

## 🛠️ Tech Stack

- **Frontend**: React (Vite), Tailwind CSS
- **Blockchain**: Stellar SDK (`stellar-sdk`), Freighter API
- **State/Hooks**: Custom React Hooks (`useStellar`)
- **Testing**: Vitest, React Testing Library
- **Icons**: Lucide React
- **DevOps**: GitHub Actions (CI/CD)

## 🚀 Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Freighter Wallet](https://www.freighter.app/) extension installed

### 1. Clone & Install
```bash
git clone https://github.com/Adrija-Saha2006/Drone_tracker.git
cd Drone_tracker/frontend
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Navigate to `http://localhost:5173`

### 3. Running Tests
We maintain 100% logic coverage for critical Stellar features.
```bash
npm run test
```

## 📖 How to Use

### Connecting Wallet
1. Open the **STELLAR dAPP** tab in the main navigation.
2. Click **Connect Freighter Wallet**.
3. Approve the request in your browser extension.
4. Ensure your wallet is set to the **Testnet**.

### Sending a Transaction
1. Once connected, your XLM balance will appear in the **Wallet Card**.
2. Enter a recipient public key (starting with `G...`).
3. Enter the amount of XLM to send.
4. Click **Broadcast Transaction**.
5. The status panel will show your transaction hash upon success.

## 📡 CI/CD Pipeline
Our GitHub Actions workflow automatically:
1. Installs all project dependencies.
2. Runs the ESLint suite for code quality.
3. Executes the Vitest test suite.
4. Builds the production-ready bundle.

---
*Built with ❤️ for the Stellar Blockchain ecosystem.*
