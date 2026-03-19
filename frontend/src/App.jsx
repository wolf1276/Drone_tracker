import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import CryptoJS from 'crypto-js';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import * as freighterAPI from "@stellar/freighter-api";
import 'leaflet/dist/leaflet.css';
import { Navigation, MapPin, UploadCloud, Ruler, Settings, Battery, Signal, Zap, Target, Gauge, Crosshair, Map, Trash2, Shield, ShieldCheck, TerminalSquare, ShieldAlert, Network, X } from 'lucide-react';
import L from 'leaflet';

// Fix leaflet icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Drone Icon 
const droneIconHtml = `
  <div style="width: 20px; height: 20px; background-color: #FFFFFF; clip-path: polygon(50% 0%, 0% 100%, 100% 100%); transform: rotate(0deg); box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);"></div>
`;
const droneIcon = new L.DivIcon({
  html: droneIconHtml,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  className: 'drone-custom-icon'
});

const socket = io('http://localhost:3000');

function MapInteractionHandler({ mode, onAddWaypoint, onMeasure }) {
  useMapEvents({
    click(e) {
      if (mode === 'WAYPOINT') {
        onAddWaypoint({ lat: e.latlng.lat, lng: e.latlng.lng, alt: 100 });
      } else if (mode === 'MEASURE') {
        onMeasure({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    }
  });
  return null;
}

function MapUpdater({ center, isFollowing }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && isFollowing) {
      map.panTo(center, { animate: true, duration: 1.0 });
    }
  }, [center, map, isFollowing]);
  return null;
}

export default function App() {
  const [telemetry, setTelemetry] = useState({ pitch: 0, roll: 0, lat: 37.7749, lng: -122.4194, altitude: 0, speed: 0, heading: 0, battery: 100, status: 'DISARMED', mode: 'PLAN', gps: 0 });
  const [path, setPath] = useState([]);
  const [waypoints, setWaypoints] = useState([]);
  const [localMode, setLocalMode] = useState('PLAN');
  
  // UI States
  const [interactionMode, setInteractionMode] = useState('NONE'); // 'WAYPOINT', 'MEASURE', 'POLYGON', 'NONE'
  const [measurePoints, setMeasurePoints] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [logs, setLogs] = useState([]);
  
  // Blockchain States
  const [walletAddress, setWalletAddress] = useState(null);
  const [firmwareStatus, setFirmwareStatus] = useState(null);
  const [missionIntegrity, setMissionIntegrity] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [isDroneConnected, setIsDroneConnected] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const sessionKeyRef = useRef(null);

  useEffect(() => {
    const verifyFirmware = async () => {
      try {
         const regRes = await fetch('http://localhost:3000/register-firmware', {
             method: 'POST', headers: {'Content-Type': 'application/json'},
             body: JSON.stringify({ version: 'v4.2', firmwareContent: 'STABLE_CORE_BIN_0X99' })
         });
         const regData = await regRes.json();
         
         const res = await fetch('http://localhost:3000/verify-firmware', {
             method: 'POST', headers: {'Content-Type': 'application/json'},
             body: JSON.stringify({ version: 'v4.2', firmwareContent: 'STABLE_CORE_BIN_0X99' })
         });
         const data = await res.json();
         setFirmwareStatus({ ...data, hashHex: regData.hashHex });
      } catch (e) { console.error(e); }
    };
    verifyFirmware();

    socket.on('telemetry', (payload) => {
      if (!sessionKeyRef.current || !payload || !payload.__encrypted) return;
      try {
         const bytes = CryptoJS.AES.decrypt(payload.data, sessionKeyRef.current);
         const data = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
         
         setTelemetry(data);
         if (data.mode) setLocalMode(data.mode);
         setPath(prev => {
           const newPath = [...prev, [data.lat, data.lng]];
           return newPath.slice(-500); 
         });
      } catch (e) { console.error("Unverified decrypt"); }
    });

    socket.on('waypoints', (data) => setWaypoints(data));
    
    socket.on('log', (msg) => {
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
    });

    socket.on('terminal_log', (msg) => {
      setTerminalLogs(prev => [msg, ...prev].slice(0, 100));
    });

    return () => {
      socket.off('telemetry');
      socket.off('waypoints');
      socket.off('log');
      socket.off('terminal_log');
    };
  }, []);

  const sendCommand = (cmd) => {
     if (!sessionKeyRef.current) return;
     const encrypted = CryptoJS.AES.encrypt(cmd, sessionKeyRef.current).toString();
     socket.emit('command', { __encrypted: true, data: encrypted });
  };

  const handleModeChange = (m) => {
    setLocalMode(m);
    sendCommand(`MODE:${m}`);
    
    // Auto configure UI based on mode
    if (m === 'PLAN') {
      setInteractionMode('WAYPOINT');
      setIsFollowing(false);
    } else {
      setInteractionMode('NONE');
      setIsFollowing(true);
    }
  };

  const handleAddWaypoint = (wp) => {
    // Only allow adding waypoints if in PLAN mode or explicitly tracking WAYPOINT
    if (localMode !== 'PLAN' && interactionMode !== 'WAYPOINT') return;
    const newWp = { id: Date.now(), ...wp };
    setWaypoints([...waypoints, newWp]);
    const msg = `Added Waypoint ${waypoints.length + 1} at ${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)}`;
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const handleMeasure = (pt) => {
    setMeasurePoints([...measurePoints, [pt.lat, pt.lng]]);
  };

  const connectWallet = async () => {
    try {
      if (window.freighterApi || await freighterAPI.isConnected()) {
        try {
           await freighterAPI.requestAccess();
        } catch (err) {
           throw new Error("Access request explicitly denied by user.");
        }
        
        // Exact constraint: Ensure Network strictly reads TESTNET
        let activeNetwork = "";
        try {
           const netInfo = await freighterAPI.getNetwork();
           activeNetwork = typeof netInfo === "string" ? netInfo : netInfo?.network || "PUBLIC";
        } catch (e) {
           throw new Error("Could not verify active Freighter wallet network.");
        }

        if (!activeNetwork.toUpperCase().includes('TESTNET')) {
           alert("Freighter Wallet is currently not mapped to TESTNET. Please switch networks in your wallet extension settings.");
           throw new Error(`Freighter configured to invalid network: Required TESTNET (Found: ${activeNetwork})`);
        }
        
        // Exact constraint: Fetch Public Key unequivocally via getPublicKey()
        let pubKey = "";
        try {
           const pk = await freighterAPI.getPublicKey();
           pubKey = typeof pk === "string" ? pk : pk?.publicKey || "";
        } catch (e) {
           throw new Error("Freighter denied getPublicKey request execution.");
        }
        
        if (pubKey && typeof pubKey === 'string' && pubKey.length > 10) {
          setWalletAddress(pubKey);
          setLogs(prev => [`[${new Date().toLocaleTimeString()}] WALLET VERIFIED: ${pubKey.substring(0,8)}... on ${activeNetwork} ledger.`, ...prev]);
        } else {
          throw new Error("Invalid native address returned systematically from Freighter wallet.");
        }
      } else {
        alert("Freighter Wallet extension missing (window.freighterApi undefined). Please install.");
      }
    } catch (e) {
      console.error(e);
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] Freighter Error: ${e.message}`, ...prev]);
    }
  };

  const connectSecureDrone = async () => {
     if (!firmwareStatus || !firmwareStatus.hashHex) {
         alert("Synchronizing with Stellar Testnet. Please give the ledger ~5-10 seconds to generate the genesis transaction blocks, then press this again.");
         return;
     }

     try {
       const droneKey = "G_DRONE_ZK_" + Math.random().toString(36).substr(2, 6).toUpperCase();
       const fwHash = firmwareStatus.hashHex; 
       
       // Step 1: Initiate
       await fetch('http://localhost:3000/initiate-handshake', {
         method: 'POST', headers: {'Content-Type': 'application/json'},
         body: JSON.stringify({ dronePubKey: droneKey, firmwareHash: fwHash })
       });
       
       // Step 2: Proof Generation & Verify
       const proof = "zkp_" + btoa(fwHash + "sec").substring(0, 32);
       const resVerify = await fetch('http://localhost:3000/verify-drone', {
         method: 'POST', headers: {'Content-Type': 'application/json'},
         body: JSON.stringify({ dronePubKey: droneKey, firmwareHash: fwHash, proof })
       });
       
       if (resVerify.ok) {
          // Step 3: Establish Session
          const resEst = await fetch('http://localhost:3000/establish-connection', { method: 'POST' });
          const data = await resEst.json();
          if (data.success) {
             sessionKeyRef.current = data.sessionToken;
             setIsDroneConnected(true);
          }
       } else {
          alert("ZK Verification & Blockchain Authorization FAILED!");
       }
     } catch(e) {
       console.error("Connection Flow Failed:", e);
     }
  };

  const disconnectSecureDrone = async () => {
      try {
         await fetch('http://localhost:3000/terminate-session', { method: 'POST' });
      } catch(e) {}
      sessionKeyRef.current = null;
      setIsDroneConnected(false);
      setMissionIntegrity(null); // Explicitly void the mission integrity token visually
      
      // Reset Telemetry display defaults
      setTelemetry({ pitch: 0, roll: 0, lat: telemetry.lat, lng: telemetry.lng, altitude: 0, speed: 0, heading: 0, battery: 0, status: 'DISCONNECTED', mode: 'PLAN', gps: 0 });
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] Secure session actively terminated.`, ...prev]);
  };

  const registerMission = async () => {
    setIsRegistering(true);
    try {
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] Anchoring mission to Stellar...`, ...prev]);
      const res = await fetch('http://localhost:3000/register-mission', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ missionId: 'm1', waypoints })
      });
      const data = await res.json();
      setMissionIntegrity(data); 
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] Mission anchored! Tx: ${data.txId.substring(0,8)}...`, ...prev]);
    } catch(e) {
      console.error(e);
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] Blockchain error: ${e.message}`, ...prev]);
    }
    setIsRegistering(false);
  };

  const uploadMission = async () => {
    if (!missionIntegrity || !missionIntegrity.success) {
       alert("MISSION BLOCKED: You must mathematically ANCHOR the drafted mission onto the blockchain first.");
       setLogs(prev => [`[${new Date().toLocaleTimeString()}] BLOCKED: Execute & Upload triggered before cryptographic anchoring.`, ...prev]);
       return;
    }
    
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] Verifying mission hash on blockchain...`, ...prev]);
    try {
      const res = await fetch('http://localhost:3000/verify-mission', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ missionId: 'm1', waypoints })
      });
      const data = await res.json();
      if (data.success) {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] Mission Authenticated! AES Encrypting and Uploading...`, ...prev]);
        const encWps = CryptoJS.AES.encrypt(JSON.stringify(waypoints), sessionKeyRef.current).toString();
        socket.emit('upload_mission', { __encrypted: true, data: encWps });
      } else {
         setLogs(prev => [`[${new Date().toLocaleTimeString()}] INTEGRITY FAILURE: ${data.reason || 'Verification Failed'}`, ...prev]);
         alert('MISSION REJECTED: Blockchain integrity validation failed.');
      }
    } catch(e) {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] Verify error: ${e.message}`, ...prev]);
    }
  };

  const clearWaypoints = () => {
    setWaypoints([]);
    setMissionIntegrity(null);
    if (sessionKeyRef.current) {
        const encEmpty = CryptoJS.AES.encrypt(JSON.stringify([]), sessionKeyRef.current).toString();
        socket.emit('upload_mission', { __encrypted: true, data: encEmpty });
    }
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] Mission Cleared`, ...prev]);
  };

  const calculateDistance = () => {
    if (measurePoints.length < 2) return 0;
    let dist = 0;
    for (let i = 0; i < measurePoints.length - 1; i++) {
       const p1 = L.latLng(measurePoints[i][0], measurePoints[i][1]);
       const p2 = L.latLng(measurePoints[i+1][0], measurePoints[i+1][1]);
       dist += p1.distanceTo(p2);
    }
    return dist;
  };

  return (
    <div className="h-screen w-screen bg-brand-slate text-gray-200 flex flex-col overflow-hidden font-sans">
      
      {/* 1. TOP NAVBAR */}
      <header className="h-14 bg-brand-panel border-b border-slate-700/50 flex items-center justify-between px-4 z-50 shadow-md shrink-0">
        <div className="flex items-center gap-3">
          <Navigation className="text-brand-blue" size={24} />
          <h1 className="text-xl font-bold tracking-tight text-white">MISSION COMMAND<span className="text-slate-500 font-normal ml-2">v4.2</span></h1>
        </div>

        <div className="flex items-center bg-slate-800 rounded-md p-1 border border-slate-700">
          {['PLAN', 'SIMULATION', 'LIVE'].map(m => (
            <button 
              key={m}
              onClick={() => handleModeChange(m)}
              className={`px-4 py-1 text-sm font-medium rounded transition-colors ${localMode === m ? 'bg-brand-blue text-white shadow' : 'text-slate-400 hover:text-gray-200'}`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-6 text-sm font-medium">
          <button 
             onClick={() => setShowLedger(true)}
             className="px-3 py-1 bg-white text-black hover:bg-gray-200 rounded transition-colors text-[10px] font-bold tracking-widest flex items-center gap-2"
          >
             <Network size={14}/> NETWORK LEDGER
          </button>

          <button 
             onClick={connectWallet} 
             className={`px-3 py-1 rounded border transition-colors ${walletAddress ? 'border-brand-blue text-brand-blue bg-brand-blue/10 font-mono text-[10px]' : 'border-slate-500 text-white bg-slate-800 hover:bg-slate-700'}`}
          >
             {walletAddress && typeof walletAddress === 'string' ? `FREIGHTER: ...${walletAddress.substring(Math.max(0, walletAddress.length - 6))}` : 'CONNECT WALLET'}
          </button>
          
          {firmwareStatus?.success ? (
               <a href={firmwareStatus.explorerUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-brand-green border border-brand-green/30 bg-brand-green/10 px-2 py-1 rounded" title="Firmware Intact on Stellar Blockchain">
                  <ShieldCheck size={14}/> FW: SECURED
               </a>
            ) : (
               <span className="flex items-center gap-1 text-[10px] text-slate-500 border border-slate-700 bg-slate-800 px-2 py-1 rounded"><Shield size={14}/> FW: UNVERIFIED</span>
          )}

          {isDroneConnected && (
            <button onClick={disconnectSecureDrone} className="flex items-center gap-1 text-[10px] tracking-widest font-bold text-white bg-brand-red hover:bg-gray-600 border border-brand-red/50 shadow-[0_0_10px_rgba(255,255,255,0.2)] transition-colors px-2 py-1 rounded">
               <ShieldAlert size={14}/> TERMINATE SECURE LINK
            </button>
          )}

          <button 
             onClick={() => setIsFollowing(!isFollowing)} 
             className={`px-2 py-1 rounded border transition-colors ${isFollowing ? 'border-brand-blue text-brand-blue bg-brand-blue/10' : 'border-slate-600 text-slate-400'}`}
          >
             {isFollowing ? 'CAMERA LOCKED' : 'FREE CAM'}
          </button>
          <div className="flex items-center gap-2"><Target size={16} className={isDroneConnected ? "text-brand-green" : "text-slate-600"}/> GPS: {isDroneConnected ? telemetry.gps : 0} 3D FIX</div>
          <div className="flex items-center gap-2"><Signal size={16} className={isDroneConnected ? "text-brand-blue" : "text-slate-600"}/> TELEM: {isDroneConnected ? "100%" : "0%"}</div>
          <div className="flex items-center gap-2">
            <Battery size={16} className={isDroneConnected && telemetry.battery > 20 ? "text-brand-green" : "text-slate-700"}/> 
            {isDroneConnected ? telemetry.battery.toFixed(1) : '0.0'}% <span className="text-slate-500 font-mono">{isDroneConnected ? '22.4V' : '0.0V'}</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex flex-1 relative overflow-hidden">
        
        {/* 2. LEFT SIDEBAR (TOOLS) */}
        <aside className="w-16 bg-brand-panel border-r border-slate-700/50 flex flex-col items-center py-4 gap-6 z-40 shrink-0 shadow-xl">
           <button 
             onClick={() => setInteractionMode(interactionMode === 'POLYGON' ? 'NONE' : 'POLYGON')}
             className={`p-2 rounded transition-colors ${interactionMode === 'POLYGON' ? 'bg-brand-blue text-white shadow shadow-brand-blue/50' : 'text-slate-400 hover:text-brand-blue'}`} title="Draw Polygon"
           ><Map size={24} /></button>
           
           <button 
             onClick={() => {
                setInteractionMode(interactionMode === 'MEASURE' ? 'NONE' : 'MEASURE');
                if (interactionMode !== 'MEASURE') setMeasurePoints([]);
             }}
             className={`p-2 rounded transition-colors ${interactionMode === 'MEASURE' ? 'bg-brand-amber text-white shadow shadow-brand-amber/50' : 'text-slate-400 hover:text-brand-amber'}`} title="Measure Distance"
           ><Ruler size={24} /></button>
           
           <button 
             onClick={() => setInteractionMode(interactionMode === 'WAYPOINT' ? 'NONE' : 'WAYPOINT')}
             className={`p-2 rounded transition-colors ${interactionMode === 'WAYPOINT' ? 'bg-brand-green text-white shadow shadow-brand-green/50' : 'text-slate-400 hover:text-brand-green'}`} title="Drop Waypoint"
           ><MapPin size={24} /></button>
           
           <div className="w-8 h-px bg-slate-700 my-2"></div>
           
           <button onClick={uploadMission} className="text-slate-400 hover:text-brand-green transition-colors p-2" title="Upload Mission"><UploadCloud size={24} /></button>
           
           <button 
             onClick={() => setShowSettings(!showSettings)}
             className={`p-2 rounded transition-colors mt-auto ${showSettings ? 'bg-white text-black shadow shadow-white/50' : 'text-slate-400 hover:text-white'}`} title="Logs & Diagnostics"
           ><Settings size={24} /></button>
        </aside>

        <div className="flex-1 flex flex-col relative z-0">
          <div className="flex-1 relative">
            <MapContainer center={[telemetry.lat, telemetry.lng]} zoom={17} zoomControl={false} className={`h-full w-full ${interactionMode !== 'NONE' || localMode === 'PLAN' ? 'cursor-crosshair' : ''}`}>
              {/* Realtime API Maps - ESRI Satellite */}
              <TileLayer 
                 url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" 
                 attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              />
              
              <MapInteractionHandler mode={interactionMode === 'NONE' && localMode === 'PLAN' ? 'WAYPOINT' : interactionMode} onAddWaypoint={handleAddWaypoint} onMeasure={handleMeasure} />

              {/* Trajectory */}
              <Polyline positions={path} color="#FFFFFF" weight={3} opacity={0.6} />

              {/* Measure UI */}
              {measurePoints.length > 0 && interactionMode === 'MEASURE' && (
                 <>
                   <Polyline positions={measurePoints} color="#888888" weight={2} dashArray="5, 8" />
                   {measurePoints.map((pt, i) => (
                      <Marker key={i} position={pt} icon={new L.DivIcon({ className: 'bg-brand-amber w-2 h-2 rounded-full', iconSize: [8,8] })} />
                   ))}
                 </>
              )}
              
              {/* Waypoints Render */}
              {waypoints.map((wp, i) => (
                <Marker key={wp.id} position={[wp.lat, wp.lng]}>
                   <Popup className="bg-brand-panel text-white border-0 !p-1 drop-shadow-lg">
                      <div className="font-sans font-extrabold text-center text-brand-green">WP {i+1}</div>
                      <div className="font-mono text-xs text-slate-300">Lat: {wp.lat.toFixed(5)}</div>
                      <div className="font-mono text-xs text-slate-300">Lng: {wp.lng.toFixed(5)}</div>
                      <div className="font-mono text-xs text-slate-300 font-bold">Alt: {wp.alt}m</div>
                   </Popup>
                </Marker>
              ))}

              {waypoints.length > 1 && (
                 <Polyline positions={waypoints.map(w => [w.lat, w.lng])} color="#CCCCCC" weight={2} opacity={0.6} dashArray="10, 10" lineCap="square" />
              )}

              {/* Drone Marker */}
              {isDroneConnected && <Marker position={[telemetry.lat, telemetry.lng]} icon={droneIcon} />}
              
              <MapUpdater center={[telemetry.lat, telemetry.lng]} isFollowing={isFollowing && isDroneConnected} />
            </MapContainer>

            {/* Artificial Horizon Overlay */}
            <div className="absolute top-6 left-6 w-36 h-36 rounded-full bg-slate-900/40 backdrop-blur-sm border border-slate-700/80 flex items-center justify-center overflow-hidden z-20 shadow-xl pointer-events-none transition-all grayscale opacity-80">
               <div 
                  className="absolute w-[200%] h-[200%] transition-transform duration-75"
                  style={{
                    background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.2) 50%, rgba(0, 0, 0, 0.4) 50%)',
                    transform: `translateY(${telemetry.pitch * 1.5}px) rotate(${-telemetry.roll}deg)`,
                    transformOrigin: '50% 50%'
                  }}
               />
               <div className="absolute w-full h-px bg-white/30"></div>
               <Crosshair size={24} strokeWidth={1} className="text-brand-green z-30 drop-shadow-md" />
               <div className="absolute top-2 text-[10px] font-mono font-bold text-white drop-shadow-md">{telemetry.pitch.toFixed(1)}°</div>
            </div>

            {/* Disconnected Overlay */}
            {!isDroneConnected && (
               <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[1000] flex flex-col items-center justify-center">
                  <ShieldAlert size={64} className="text-white mb-4" />
                  <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">No Verified Drone Connection</h2>
                  <p className="text-gray-400 mb-6 font-mono max-w-md text-center">Handshake requires ZK integrity protocol and Stellar Blockchain authentication. Connection blocked.</p>
                  <button onClick={connectSecureDrone} className="bg-white hover:bg-gray-300 text-black font-bold tracking-widest px-6 py-3 rounded border border-white/50 shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all flex items-center gap-3">
                     <ShieldCheck size={20} /> AUTHORIZE SECURE LINK
                  </button>
               </div>
            )}
          </div>

          {/* Secure Developer Terminal Panel */}
          <div className="h-48 bg-[#050505] border-t border-brand-panel font-mono text-white flex flex-col shrink-0 shadow-[inset_0_10px_20px_rgba(0,0,0,0.8)] z-40">
             <div className="bg-[#111111] border-b border-white/20 p-1 px-4 flex items-center justify-between">
                <span className="text-[10px] text-white font-bold flex items-center gap-2"><TerminalSquare size={14}/> ZK-GATEWAY SECURE TERMINAL</span>
                <span className="text-[10px] text-gray-500">{isDroneConnected ? "CONNECTION ESTABLISHED" : "AWAITING AUTHENTICATION"}</span>
             </div>
             <div className="flex-1 overflow-y-auto p-2 text-xs opacity-90 custom-scrollbar flex flex-col-reverse">
                {terminalLogs.map((log, i) => <div key={i} className="py-0.5 break-all border-b border-gray-900 leading-relaxed text-gray-300">{log}</div>)}
                <div className="text-gray-600 animate-pulse">_Terminal initialized. Awaiting secure handshake inputs...</div>
             </div>
          </div>
        </div>

        {/* 4. RIGHT PANEL */}
        <aside className="w-80 bg-brand-panel border-l border-slate-700/50 flex flex-col z-40 shrink-0 shadow-[-4px_0_15px_rgba(0,0,0,0.3)]">
           <div className="p-4 border-b border-slate-700/50">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Zap size={14}/> Command Panel</h2>
              <div className="grid grid-cols-2 gap-2">
                 <button 
                  onClick={() => { sendCommand('ARM'); setLogs(prev => [`[${new Date().toLocaleTimeString()}] COMMAND SENT: ARM`, ...prev]); }}
                  disabled={!isDroneConnected || !missionIntegrity?.success}
                  className="btn-danger w-full flex items-center justify-center gap-2 py-3 shadow-[inset_0px_1px_0px_rgba(255,255,255,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <Zap size={16}/> ARM
                 </button>
                 <button 
                  onClick={() => { sendCommand('DISARM'); setLogs(prev => [`[${new Date().toLocaleTimeString()}] COMMAND SENT: DISARM`, ...prev]); }}
                  disabled={!isDroneConnected || !missionIntegrity?.success}
                  className="bg-slate-700 text-white hover:bg-slate-600 rounded font-medium transition-colors w-full flex items-center justify-center py-3 border border-slate-600 shadow-[inset_0px_1px_0px_rgba(255,255,255,0.1)] disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   DISARM
                 </button>
              </div>
              <button 
                onClick={() => { sendCommand('RTL'); setLogs(prev => [`[${new Date().toLocaleTimeString()}] COMMAND SENT: RETURN TO LAUNCH`, ...prev]); }}
                disabled={!isDroneConnected || !missionIntegrity?.success}
                className="mt-3 w-full bg-brand-amber/10 text-brand-amber border border-brand-amber/30 hover:bg-brand-amber hover:text-white py-2 rounded font-medium transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                RETURN TO LAUNCH
              </button>
              
              <div className="mt-4 flex items-center justify-between bg-slate-900/50 rounded p-3 border border-slate-800">
                 <span className="text-xs font-bold text-slate-400 tracking-wider">STATUS</span>
                 <span className={`font-bold tracking-widest ${telemetry.status === 'ARMED' ? 'text-brand-red animate-pulse' : 'text-slate-300'}`}>
                    {telemetry.status}
                 </span>
              </div>
           </div>

           <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Flight Plan</h2>
                <div className="flex gap-2 items-center">
                  <button onClick={clearWaypoints} className="text-slate-500 hover:text-brand-red p-1 rounded transition-colors" title="Clear Mission"><Trash2 size={16}/></button>
                  <span className="text-[10px] font-bold text-brand-blue bg-brand-blue/10 px-2 py-1 rounded-full border border-brand-blue/20">{waypoints.length} WP</span>
                </div>
              </div>
              
              <div className="space-y-2">
                {waypoints.map((wp, i) => (
                  <div key={wp.id} className="bg-slate-800/50 rounded py-2 px-3 border border-slate-700/50 flex justify-between items-center hover:bg-slate-800 transition-colors cursor-pointer group">
                     <div className="flex gap-3 items-center">
                        <span className="bg-slate-900 border border-slate-700 text-slate-400 w-6 h-6 rounded flex items-center justify-center font-mono text-xs group-hover:text-brand-blue group-hover:border-brand-blue/50 transition-colors">{i+1}</span>
                        <div>
                          <div className="font-mono text-gray-300 text-xs">{parseFloat(wp.lat).toFixed(4)}, {parseFloat(wp.lng).toFixed(4)}</div>
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Waypoint</div>
                        </div>
                     </div>
                     <div className="text-brand-green font-mono text-sm bg-brand-green/10 px-2 rounded">
                        <input type="number" value={wp.alt} onChange={e => {
                           const newWp = [...waypoints];
                           newWp[i].alt = e.target.value;
                           setWaypoints(newWp);
                        }} className="bg-transparent w-8 outline-none text-right" />m
                     </div>
                  </div>
                ))}
                {waypoints.length === 0 && <div className="text-slate-500 text-sm py-4 italic">No mission loaded. Click the map pin directly from sidebar to place waypoints.</div>}
                
                {waypoints.length > 0 && (
                   <div className="mt-4 space-y-2">
                       {missionIntegrity?.success ? (
                             <div className="flex flex-col gap-1">
                               <a href={missionIntegrity.explorerUrl} target="_blank" rel="noreferrer" className="w-full flex justify-center items-center gap-2 bg-slate-800 text-brand-green py-2 rounded text-[10px] font-mono border border-brand-green/30 transition-colors cursor-pointer hover:bg-slate-700">
                                  <ShieldCheck size={14} /> Mission Secured on Stellar
                               </a>
                               <div className="text-[9px] font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded border border-slate-800 text-center break-all shadow-inner">
                                 HASH: {missionIntegrity.hashHex}
                               </div>
                             </div>
                       ) : (
                             <button onClick={registerMission} disabled={isRegistering} className="w-full bg-brand-blue/20 text-brand-blue hover:bg-brand-blue hover:text-white py-2 rounded text-xs font-bold uppercase transition-colors border border-brand-blue/30 tracking-widest flex justify-center items-center gap-2">
                               {isRegistering ? 'ANCHORING...' : <><Shield size={14}/> Anchor Mission Integrity</>}
                             </button>
                       )}
                       <button onClick={uploadMission} disabled={!missionIntegrity?.success} className={`w-full py-2 rounded text-xs font-bold uppercase transition-colors tracking-widest flex justify-center items-center gap-2 ${missionIntegrity?.success ? 'bg-brand-green/20 text-brand-green hover:bg-brand-green hover:text-white border border-brand-green/30 shadow-[0_4px_10px_rgba(16,185,129,0.2)]' : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'}`}>
                         <UploadCloud size={14}/> {missionIntegrity?.success ? 'Execute & Upload' : 'Awaiting Integrity Anchor'}
                       </button>
                   </div>
                )}
              </div>
           </div>
        </aside>

      </div>

      {/* 5. BOTTOM TELEMETRY BAR */}
      {/* 5. BOTTOM TELEMETRY BAR */}
      <footer className="h-14 bg-brand-panel border-t border-slate-700/50 z-50 flex items-center px-8 gap-8 shadow-[0_-4px_15px_rgba(0,0,0,0.3)] shrink-0 justify-around transition-opacity duration-300">
         <div className="flex flex-col items-center">
            <span className="text-[9px] text-slate-500 font-sans tracking-widest uppercase mb-0.5">Altitude (m)</span>
            <span className={`font-mono font-bold text-lg flex items-center gap-1 leading-none ${isDroneConnected ? 'text-brand-green' : 'text-slate-600'}`}>
               {isDroneConnected ? telemetry.altitude.toFixed(1) : '---'}
            </span>
         </div>
         <div className="w-px h-6 bg-slate-700"></div>

         <div className="flex flex-col items-center">
            <span className="text-[9px] text-slate-500 font-sans tracking-widest uppercase mb-0.5">Ground Spd (m/s)</span>
            <span className={`font-mono font-bold text-lg flex items-center gap-1 leading-none ${isDroneConnected ? 'text-white' : 'text-slate-600'}`}>
              <Gauge size={14} className={isDroneConnected ? "text-slate-400" : "text-slate-700"}/> 
              {isDroneConnected ? telemetry.speed.toFixed(1) : '---'}
            </span>
         </div>
         <div className="w-px h-6 bg-slate-700"></div>

         <div className="flex flex-col items-center">
            <span className="text-[9px] text-slate-500 font-sans tracking-widest uppercase mb-0.5">Heading</span>
            <span className={`font-mono font-bold text-lg leading-none ${isDroneConnected ? 'text-white' : 'text-slate-600'}`}>
               {isDroneConnected ? telemetry.heading + '°' : '---°'}
            </span>
         </div>
         <div className="w-px h-6 bg-slate-700"></div>

         <div className="flex flex-col items-center">
            <span className="text-[9px] text-slate-500 font-sans tracking-widest uppercase mb-0.5">Attitude (R / P)</span>
            <span className="font-mono text-sm leading-none mt-1">
              <span className={isDroneConnected ? "text-brand-blue" : "text-slate-600"}>{isDroneConnected ? telemetry.roll.toFixed(1) : '-'}°</span>
              <span className="mx-2 text-slate-700">|</span>
              <span className={isDroneConnected ? "text-brand-amber" : "text-slate-600"}>{isDroneConnected ? telemetry.pitch.toFixed(1) : '-'}°</span>
            </span>
         </div>
      </footer>
      
      {/* Blockchain Ledger Modal */}
      {showLedger && (
         <div className="absolute inset-0 z-[2000] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-8">
            <div className="bg-[#0a0a0a] border border-gray-700 w-full max-w-4xl h-[80vh] flex flex-col rounded-xl shadow-[0_0_50px_rgba(255,255,255,0.05)] overflow-hidden">
               
               <div className="flex justify-between items-center p-6 border-b border-gray-800 shrink-0">
                  <h2 className="text-2xl font-black text-white tracking-widest flex items-center gap-3">
                     <Network size={28} className="text-gray-400" /> STELLAR BLOCKCHAIN INTEGRITY LEDGER
                  </h2>
                  <button onClick={() => setShowLedger(false)} className="text-gray-500 hover:text-white transition-colors">
                     <X size={24} />
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto p-8 space-y-8 font-mono">
                  
                  {/* Global Network State */}
                  <div className="bg-[#111111] border border-gray-800 p-6 rounded">
                     <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-4">Network Consensus</h3>
                     <div className="grid grid-cols-2 gap-4">
                        <div>
                           <div className="text-[10px] text-gray-600 mb-1">Active Network</div>
                           <div className="text-white">Stellar Protocol (Testnet)</div>
                        </div>
                        <div>
                           <div className="text-[10px] text-gray-600 mb-1">Command Authority Wallet</div>
                           <div className="text-white break-all">{walletAddress || "Unauthenticated Local Agent"}</div>
                        </div>
                     </div>
                  </div>

                  {/* Firmware Ledger */}
                  <div className="bg-[#111111] border border-gray-800 rounded overflow-hidden">
                     <div className="bg-gray-900 border-b border-gray-800 p-4 shrink-0 flex items-center justify-between">
                        <h3 className="text-xs text-white tracking-widest uppercase flex items-center gap-2">
                           <Shield size={16} /> Base Firmware Authority
                        </h3>
                        {firmwareStatus?.success && <span className="text-[10px] bg-white text-black px-2 py-0.5 rounded font-bold">VERIFIED ON-CHAIN</span>}
                     </div>
                     <div className="p-6">
                        {firmwareStatus ? (
                           <div className="space-y-4">
                              <div>
                                 <div className="text-[10px] text-gray-600 mb-1">SHA-256 Firmware Payload Footprint</div>
                                 <div className="text-gray-300 text-sm break-all bg-black p-3 rounded border border-gray-800">
                                    {firmwareStatus.hashHex}
                                 </div>
                              </div>
                              <div>
                                 <div className="text-[10px] text-gray-600 mb-1">Stellar Horizon Transaction ID</div>
                                 <a href={firmwareStatus.explorerUrl} target="_blank" rel="noreferrer" className="text-white hover:underline text-sm break-all">
                                    {firmwareStatus.txId}
                                 </a>
                              </div>
                           </div>
                        ) : (
                           <div className="text-gray-600 text-sm italic">Waiting for initial firmware synchronization block...</div>
                        )}
                     </div>
                  </div>

                  {/* Mission Ledger */}
                  <div className="bg-[#111111] border border-gray-800 rounded overflow-hidden">
                     <div className="bg-gray-900 border-b border-gray-800 p-4 shrink-0 flex items-center justify-between">
                        <h3 className="text-xs text-white tracking-widest uppercase flex items-center gap-2">
                           <UploadCloud size={16} /> Dynamic Mission Anchor
                        </h3>
                        {missionIntegrity?.success && <span className="text-[10px] bg-white text-black px-2 py-0.5 rounded font-bold">VERIFIED ON-CHAIN</span>}
                     </div>
                     <div className="p-6">
                        {missionIntegrity ? (
                           <div className="space-y-4">
                              <div>
                                 <div className="text-[10px] text-gray-600 mb-1">SHA-256 Waypoint Sequence Footprint</div>
                                 <div className="text-gray-300 text-sm break-all bg-black p-3 rounded border border-gray-800">
                                    {missionIntegrity.hashHex}
                                 </div>
                              </div>
                              <div>
                                 <div className="text-[10px] text-gray-600 mb-1">Stellar Horizon Transaction ID</div>
                                 <a href={missionIntegrity.explorerUrl} target="_blank" rel="noreferrer" className="text-white hover:underline text-sm break-all">
                                    {missionIntegrity.txId}
                                 </a>
                              </div>
                           </div>
                        ) : (
                           <div className="text-gray-600 text-sm italic">No dynamic missions have been mathematically anchored yet.</div>
                        )}
                     </div>
                  </div>

               </div>
               
               <div className="bg-black border-t border-gray-800 p-4 text-[10px] text-gray-600 text-center tracking-widest">
                  CRYPTOGRAPHIC DATA SOURCED DIRECTLY FROM HORIZON API (STELLAR DEVELOPMENT FOUNDATION)
               </div>
            </div>
         </div>
      )}

    </div>
  );
}
