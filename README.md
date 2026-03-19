# Stellar-Secured Mission Command Dashboard

_A high-end, military-grade monochrome mission planner prioritizing absolute zero-trust validation before unlocking hardware telemetry or data channels. Built for robust drone fleet coordination using cryptographic Zero-Knowledge verification and the Stellar Blockchain._

---

## 🚀 Priority Objective
Most consumer and enterprise drone operation systems implicitly trust the radio link without rigorous mathematical cryptographic footprinting. This application introduces a **Zero-Trust Handshake Protocol**, ensuring that:
1. The drone is physically broadcasting a verified identity.
2. The drone runs **unmodified, blockchain-anchored firmware**.
3. All command instructions are **AES-256 symmetrically encrypted** and stored securely against the **Stellar Testnet Ledger** before execution.

If any of these constraints fail dynamically during connection, the backend permanently drops payloads and the frontend completely disables mapping and tracking tools mathematically.

---

## ✨ Core Features

### 🛡️ Zero-Knowledge Intrinsic Handshake
The dashboard strictly boots into a **Lockout Shield** state. To begin flying, the application triggers a simulated cryptographic Proof-of-Knowledge handshake that transmits an encrypted firmware payload hash to the backend. The backend must mathematically validate the proof before an ephemeral session token unlocks the Socket connection.

### ⛓️ Stellar Blockchain Verification 
Instead of trusting the local handshake, the backend actively dials the **Stellar Horizon API**. The firmware footprint must possess a verified transaction on the ledger (anchored securely via memo traces). Mission pathing data (Waypoints, Altitudes) is subsequently hashed via SHA-256 and anchored to the ledger prior to physical execution.

### 🔐 AES-256 Stream Entropy
Once the ledger unlocks the telemetry port, the backend simulator establishes an ephemeral asymmetric key array and enforces strict `crypto-js` AES wrapping on **all WebSockets payloads**. The frontend decryption must succeed to render altitude, attitude (Pitch/Roll), GPS, and speed.

### 💼 Integrated Command Authority (Freighter API)
Operators dynamically sign into the platform leveraging native integration with the `@stellar/freighter-api` browser wallet, ensuring every dynamic flight path anchoring and session launch is natively traceable to an authorized public key.

### 📊 Precision Black & White Dashboard UI
The front end operates via React and TailwindCSS within a highly customized monochromatic layout to maximize contrast and situational awareness. Features include measuring tools, map boundary drawing, dynamic artificial horizon HUDs, and an embedded developer terminal streaming secure protocol logs locally.

### 📘 Judges' Ledger Modal
A native **"NETWORK LEDGER"** overlay button that exposes the explicit cryptographic hashing running under the hood. It elegantly fetches active `TxID` blocks connected to your connected Freighter wallet, ensuring judges or auditors can visibly trace your integrity footprints on StellarExpert directly from the browser window.

### 🔎 Integrity Verification Panel
A built-in **"VERIFY PAYLOAD"** terminal allowing operators or auditors to paste raw Mission Vector JSONs, raw SHA-256 strings, or generic Stellar Transaction IDs. The local backend parses the strings, dynamically cross-references the active Testnet Ledger natively via `stellar-sdk`, and returns a strict visual `VERIFIED` or `REJECTED` boundary, completely eliminating reliance strictly on external block explorers.

---

## 🛠️ Technology Stack
* **Frontend UI:** React + Vite, TailwindCSS (Strict Monochrome Scheme), Lucide-React 
* **Cartography:** React-Leaflet + ESRI Live Satellite Feeds + Custom SVG overlays
* **Backend:** Node.js, Express, Socket.io
* **Cryptography:** CryptoJS (AES-256 Symmetric Payloads), Simulated ZK Constraints
* **Blockchain Infrastructure:** Stellar SDK, Horizon Testnet, Freighter Wallet

---

## 💻 Installation & Local Execution

### 1. Repository Setup
Clone the repository and enter the directory hierarchy.
```bash
git clone https://github.com/your-repo/Drone_tracker.git
cd Drone_tracker
```

### 2. Backend Boot sequence
The backend acts as the authentication oracle and hardware physics simulator.
```bash
cd backend
npm install
node server.js
```
*(Runs on `http://localhost:3000`)*

### 3. Frontend Compilation
Launch the Mission Command dashboard.
```bash
cd ../frontend
npm install
npm run dev
```
*(Runs on `http://localhost:5173`)*

---

## 🎮 Hands-on Walkthrough Flow

1. **Access the Gated UI:** Navigate to `http://localhost:5173`. You will instantly hit the Disconnected Verification overlay. The embedded SECURE TERMINAL will log that the socket is awaiting keys.
2. **Sync the Ledger:** Wait roughly 5 seconds; the backend will quietly anchor the simulated `STABLE_CORE_BIN_0X99` firmware onto the Stellar Testnet. The `FW: UNVERIFIED` badge top right will flip to **`FW: SECURED`**.
3. **Prove Identity:** Click the massive **AUTHORIZE SECURE LINK** button. Watch the terminal blast through the ZK validation matrices and Horizon verification queries. The AES Session key establishes, clearing the overlay.
4. **Command the Drone:** The system is now unlocked. You can see real-time Attitude and Artificial Horizon simulation running natively underneath AES encryption.
5. **Anchor a Mission:** Use the Map pins to drop flight points. Click **Anchor Mission Integrity** in the Flight panel to write the SHA-256 hashes onto Stellar. The drone hardware logic (ARM/DISARM) remains totally locked down until this mathematical chain evaluates.
6. **Execute:** Once anchored successfully, the **Execute & Upload** button becomes natively executable.
7. **Verify Cryptography Natively:** Click **VERIFY PAYLOAD** to open the embedded Mathematical Evaluator. Paste your payload JSON, generated Hash footprint, or TxID directly into the panel to force the backend to locally prove its explicit existence on-chain.
8. **View the Receipts:** Click **NETWORK Ledger** in the top navigation at any time to trace testnet transaction ID parity across all interactions.
9. **Terminate Base:** Instantly shred the AES-256 token matrices and halt all backend node loops globally by clicking the red `TERMINATE SECURE LINK` panic button.

---

*Architected internally strictly enforcing high-fidelity cryptographic Zero-Trust operations via the Stellar blockchain.*
