const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const cors = require('cors');
const CryptoJS = require('crypto-js');

const { computeHash, registerHashOnBlockchain, verifyHashOnBlockchain } = require('./stellarService');
const { validateZkProof } = require('./zkVerificationService');

const app = express();
app.use(cors());
app.use(express.json()); // Essential for JSON body payload parsing

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const PORT = 3000;
let isArmed = false;
let mode = 'PLAN'; // PLAN, LIVE, SIMULATION

// Database Mock
const db = {
  missions: {},
  firmwares: {}
};

// Global Connection Gate State
let activeDroneSession = null;
let connectionVerified = false; // Systemic verification boolean logic flag
let simulationInterval = null;
let missionAnchored = false;
let activeMissionTx = null;

// Terminal Log Emitter
function emitLog(msg) {
  io.emit('terminal_log', `[${new Date().toLocaleTimeString()}] ${msg}`);
  console.log(msg);
}

// -- ZK SECURE HANDSHAKE ENDPOINTS -- //

app.post('/initiate-handshake', (req, res) => {
   const { dronePubKey, firmwareHash } = req.body;
   emitLog(`[ZK-GATE] Handshake initiated by Drone ID: ${dronePubKey.substring(0,8)}...`);
   emitLog(`[ZK-GATE] Declared Firmware Hash: ${firmwareHash}`);
   res.json({ success: true, challenge: 'CHAL_9832X' });
});

app.post('/verify-drone', async (req, res) => {
   const { dronePubKey, firmwareHash, proof } = req.body;
   emitLog(`[ZK-GATE] Verifying ZK Proof of Knowledge...`);
   
   const isZkValid = await validateZkProof(proof, firmwareHash, dronePubKey);
   if (!isZkValid) {
       emitLog(`[ZK-GATE] REJECTED: ZK Proof invalid or forged.`);
       return res.status(401).json({ success: false, reason: "ZK Proof invalid" });
   }
   emitLog(`[ZK-GATE] ZK Proof Validated! Checking firmware structural integrity...`);

   emitLog(`[STELLAR] Querying Horizon for Firmware Hash authorization...`);
   const record = Object.values(db.firmwares).find(f => f.hashHex === firmwareHash);
   if (!record) {
       emitLog(`[STELLAR] REJECTED: Firmware Hash not authorized (unregistered).`);
       return res.status(401).json({ success: false, reason: "Firmware unauthorized" });
   }

   const isOnChain = await verifyHashOnBlockchain(record.txId, firmwareHash);
   if (!isOnChain) {
       emitLog(`[STELLAR] REJECTED: Firmware Hash mismatch on Stellar ledger! Tampering detected.`);
       return res.status(401).json({ success: false, reason: "Blockchain Verification failed" });
   }

   emitLog(`[STELLAR] Firmware Authenticity Verified on-chain (Tx: ${record.txId.substring(0,8)}...)`);
   res.json({ success: true });
});

app.post('/establish-connection', (req, res) => {
    emitLog(`[ZK-GATE] Handshake complete. Generating ephemeral session token...`);
    activeDroneSession = 'SESSION_' + Math.random().toString(36).substr(2, 9) + Date.now();
    connectionVerified = true;
    emitLog(`[SYS] Connection Established (connectionVerified = true). Unlocking telemetry capabilities and encrypting stream using AES-256 Symmetric Key.`);
    
    if (!simulationInterval) {
        startSimulation();
    }
    
    res.json({ success: true, sessionToken: activeDroneSession });
});

app.post('/terminate-session', (req, res) => {
    emitLog(`[ZK-GATE] Session Termination Requested. Halting simulator & purging crypto keys...`);
    if (simulationInterval) {
       clearInterval(simulationInterval);
       simulationInterval = null;
    }
    activeDroneSession = null;
    connectionVerified = false;
    missionAnchored = false;
    activeMissionTx = null;
    emitLog(`[SYS] Session completely wiped. connectionVerified boolean reset to false. Returning to Zero-Trust state.`);
    res.json({ success: true });
});

// -- BLOCKCHAIN INTEGRITY ENDPOINTS -- //

app.post('/register-mission', async (req, res) => {
  try {
    const { missionId, waypoints } = req.body;
    const missionString = JSON.stringify(waypoints);
    const hashHex = computeHash(missionString);
    
    console.log(`[STELLAR] Registering mission ${missionId} integrity...`);
    const txId = await registerHashOnBlockchain(hashHex);
    
    // Store ONLY hash and transaction ID, keeping exact mission logic off-chain
    db.missions[missionId] = {
      hashHex,
      txId,
      timestamp: Date.now()
    };
    
    missionAnchored = true;
    activeMissionTx = txId;
    emitLog(`[STELLAR] Mission explicitly anchored to network ledger. Hardware flight boundaries unlocked.`);
    
    res.json({ success: true, missionId, hashHex, txId });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/verify-mission', async (req, res) => {
  try {
    const { missionId, waypoints } = req.body;
    const missionString = JSON.stringify(waypoints);
    const localHash = computeHash(missionString);
    
    const record = db.missions[missionId];
    if (!record) return res.status(404).json({ error: "Mission not recorded in integrity database." });
    
    if (record.hashHex !== localHash) {
      return res.json({ success: false, reason: "Hash mismatch! Payload tampered locally." });
    }
    
    const isValidOnChain = await verifyHashOnBlockchain(record.txId, localHash);
    
    res.json({ 
      success: isValidOnChain, 
      txId: record.txId, 
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${record.txId}` 
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/register-firmware', async (req, res) => {
  try {
    const { version, firmwareContent } = req.body;
    const hashHex = computeHash(firmwareContent);
    const txId = await registerHashOnBlockchain(hashHex);
    db.firmwares[version] = { hashHex, txId };
    res.json({ success: true, version, hashHex, txId });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/verify-firmware', async (req, res) => {
  try {
    const { version, firmwareContent } = req.body;
    const localHash = computeHash(firmwareContent);
    const record = db.firmwares[version];
    if (!record) return res.status(404).json({ error: "Firmware not registered." });
    
    const isValidOnChain = await verifyHashOnBlockchain(record.txId, localHash);
    res.json({ 
      success: isValidOnChain && (record.hashHex === localHash), 
      txId: record.txId,
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${record.txId}`
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// -- SIMULATION & WEBSOCKET ENGINE -- //

// Simulated data state
let lat = 37.7749;
let lng = -122.4194;
let time = 0;
let waypoints = [
  { id: 1, lat: 37.7750, lng: -122.4180, alt: 100 },
  { id: 2, lat: 37.7760, lng: -122.4170, alt: 120 }
];

console.log("Initializing Professional Drone Backend...");

// Simulation fallback
function startSimulation() {
  if (simulationInterval) clearInterval(simulationInterval);
  simulationInterval = setInterval(() => {
    const pitch = Math.sin(time / 5.0) * 15.0;
    const roll = Math.cos(time / 4.0) * 20.0;
    const altitude = 120.5 + Math.sin(time / 10.0) * 5.0; 
    const speed = isArmed ? 15.2 + Math.sin(time / 3.0) * 2 : 0.0; 
    const heading = (time * 2) % 360; 
    const battery = Math.max(0, 100 - (time / 100.0)); 

    if (isArmed) {
      lat += (Math.cos(heading * Math.PI / 180) * 0.00005);
      lng += (Math.sin(heading * Math.PI / 180) * 0.00005);
    }

    const simData = {
      pitch: parseFloat(pitch.toFixed(2)),
      roll: parseFloat(roll.toFixed(2)),
      altitude: parseFloat(altitude.toFixed(1)),
      speed: parseFloat(speed.toFixed(1)),
      heading: parseInt(heading),
      battery: parseFloat(battery.toFixed(1)),
      lat: parseFloat(lat.toFixed(6)),
      lng: parseFloat(lng.toFixed(6)),
      status: isArmed ? "ARMED" : "DISARMED",
      mode: mode,
      gps: 12 // satellites
    };

    if (activeDroneSession) {
       const simDataStr = JSON.stringify(simData);
       const encryptedPayload = CryptoJS.AES.encrypt(simDataStr, activeDroneSession).toString();
       io.emit('telemetry', { __encrypted: true, data: encryptedPayload });
    }
    time++;
  }, 100); // 10Hz
}

// We initially DO NOT start the simulation until handshake completes.
// startSimulation();

// Websocket logic
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.emit('waypoints', waypoints);

  socket.on('command', (payload) => {
    if (!connectionVerified || !activeDroneSession || !missionAnchored || !payload || !payload.__encrypted) {
      emitLog(`[SYS] BLOCKED: Command rejected. Global connectionVerified OR missionAnchored constraint evaluated to FALSE.`);
      return;
    }

    try {
      const bytes = CryptoJS.AES.decrypt(payload.data, activeDroneSession);
      const cmd = bytes.toString(CryptoJS.enc.Utf8);

      if (cmd === 'ARM' || cmd === 'DISARM') {
        isArmed = (cmd === 'ARM');
        emitLog(`[SYS] System ${isArmed ? 'ARMED' : 'DISARMED'}`);
      } else if (cmd === 'RTL') {
        emitLog(`[SYS] Executing Return To Launch (RTL)`);
      } else if (cmd.startsWith('MODE:')) {
        mode = cmd.split(':')[1];
        emitLog(`[SYS] Flight mode changed to ${mode}`);
      }
    } catch(e) {
       emitLog(`[SYS] BLOCKED: AES Decryption Failed on incoming Command.`);
    }
  });

  socket.on('upload_mission', (payload) => {
    if (!connectionVerified || !activeDroneSession || !missionAnchored || !payload || !payload.__encrypted) {
      emitLog(`[SYS] BLOCKED: Mission upload rejected. Secure connection OR mission anchor verification missing.`);
      return;
    }
    try {
       const bytes = CryptoJS.AES.decrypt(payload.data, activeDroneSession);
       const wps = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
       
       // Prompt requisite: Synchronously call Horizon API to re-verify hash validity physically on-chain before injecting trajectories
       const hashHex = computeHash(JSON.stringify(wps));
       verifyHashOnBlockchain(activeMissionTx, hashHex).then(isOnChain => {
           if(!isOnChain) {
               emitLog(`[STELLAR] CRITICAL REJECT: Unanchored physical coordinate offset detected. Payload systematically dropped.`);
               return;
           }
           waypoints = wps;
           emitLog(`[SYS] Received rigorous on-chain verified & AES encrypted geometric pathing vectors (${wps.length} nodes).`);
       }).catch(e => {
           emitLog(`[STELLAR] Validation connectivity failure querying testnet ledger.`);
       });
       
    } catch(e) {
       emitLog(`[SYS] BLOCKED: AES Decryption Failed on incoming Mission Payload.`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (io.engine.clientsCount === 0) {
       clearInterval(simulationInterval);
       simulationInterval = null;
       activeDroneSession = null;
       missionAnchored = false;
       activeMissionTx = null;
       console.log('All clients disconnected. Pausing telemetry simulation and invalidating session.');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
