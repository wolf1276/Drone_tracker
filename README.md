# 🚁 Stellar Drone Tracker dApp v4.2

[![Stellar dApp CI](https://github.com/wolf1276/Drone_tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/wolf1276/Drone_tracker/actions)
[![Stellar Network](https://img.shields.io/badge/Network-Stellar_Testnet-9C4AED?logo=stellar)](https://www.stellar.org/)
[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-000000?logo=vercel)](https://drone-tracker-alpha.vercel.app/)

A production-grade Mission Control Center and Stellar dApp integration. This project combines real-time drone telemetry tracking with advanced blockchain-based payment and mission anchoring systems.

---

## 📺 Live Production Environment
- **Live dApp:** [https://drone-tracker-alpha.vercel.app/](https://drone-tracker-alpha.vercel.app/)
- **Network:** Stellar Testnet
- **Status:** 🟢 MVP Fully Functional

---

## ✨ Unified Dashboard Experience

Our v4.2 update unifies the Drone Mission Command and the Stellar dApp into a single, cohesive dashboard.

![Unified Dashboard](file:///Users/ahir/.gemini/antigravity/brain/0a255421-ab7e-4bd4-8573-ac0142ac3415/unified_dashboard_stellar_node_active_1774978083858.png)

### Core Features:
- **Real-time Telemetry**: Stream encrypted drone data directly to the Mission Command.
- **Cryptographic Anchoring**: Mathematically lock drone missions onto the Stellar ledger for 100% data integrity.
- **Unified Stellar Bridge**: Connect Freighter wallet, check balances, and send XLM payments without leaving the cockpit.
- **ZK-Handshake**: Secure drone-to-base authorization using Zero-Knowledge Proof simulations.

---

## 🧪 Automated Quality Assurance
We maintain rigorous testing for all Stellar-native features. Our Vitest suite currently reports **7/7 Passing Tests**.

### Test Report Summary:
| # | Test Case Description | Status |
|---|---|---|
| 1 | Wallet connection UI: Displays address & balance | ✅ PASS |
| 2 | Balance fetch: Real-time refresh connectivity | ✅ PASS |
| 3 | Transaction submission: Data validation & signature trigger | ✅ PASS |
| 4 | Payment Success: Transaction hash & ledger link display | ✅ PASS |
| 5 | Payment Error: Descriptive on-chain failure handling | ✅ PASS |
| 6 | Address Formatting: Short-hand cryptographic ID logic | ✅ PASS |
| 7 | Global Unconnected State: Context-aware bridging prompts | ✅ PASS |

---

## 🚀 Getting Started

### 1. Installation
```bash
git clone https://github.com/wolf1276/Drone_tracker.git
cd Drone_tracker
npm install
```

### 2. Run Locally
```bash
# Start Backend
npm run backend:dev

# Start Frontend
npm run dev
```

### 3. Deploy to Vercel
Push your changes to the `main` branch, and the integrated Vercel pipeline will automatically build and deploy the production-ready dApp.

---

## 📁 Repository Structure
- `frontend/`: React + Vite + Tailwind dashboard.
- `backend/`: Node.js + Socket.io gateway for telemetry.
- `contracts//: Planned Soroban smart contracts for on-chain mission logic.

---
*Built for the Stellar ecosystem. Powering the future of secure autonomous flight.*
