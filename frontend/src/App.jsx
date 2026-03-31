import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import CryptoJS from 'crypto-js';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import StellarBoard from './components/stellar/StellarBoard';
import { useStellar } from './hooks/useStellar';
import 'leaflet/dist/leaflet.css';

import { Navigation, MapPin, UploadCloud, Ruler, Settings, Battery, Signal, Zap, Target, Gauge, Crosshair, Map, Trash2, Shield, ShieldCheck, TerminalSquare, ShieldAlert, Network, X, LogOut } from 'lucide-react';
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
  const [units, setUnits] = useState('METRIC'); // 'METRIC' or 'IMPERIAL'
  const [mapLayer, setMapLayer] = useState('SATELLITE'); // 'SATELLITE' or 'STREETS'
  
  const { 
    address, 
    balance, 
    isWalletConnected, 
    loading: walletLoading, 
    error: walletError, 
    lastTxHash, 
    connect: walletConnect, 
    disconnect: walletDisconnect, 
    refreshBalance, 
    sendPayment,
    shortAddress
  } = useStellar();

  // Blockchain States
  const [firmwareStatus, setFirmwareStatus] = useState(null);
  const [missionIntegrity, setMissionIntegrity] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isDroneConnected, setIsDroneConnected] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const sessionKeyRef = useRef(null);

  useEffect(() => {
    if (address) {
       fetch('http://localhost:3000/register-user', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ address })
       }).catch();
    }
  }, [address]);

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
      } catch (_e) { console.error(_e); }
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
      } catch { console.error("Unverified decrypt"); }
    });


    socket.on('waypoints', (data) => setWaypoints(data));
    
    socket.on('log', (msg) => {
      setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
    });

    return () => {
      socket.off('telemetry');
      socket.off('waypoints');
      socket.off('log');
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
    
    if (m === 'PLAN') {
      setInteractionMode('WAYPOINT');
      setIsFollowing(false);
    } else {
      setInteractionMode('NONE');
      setIsFollowing(true);
    }
  };

  const handleAddWaypoint = (wp) => {
    if (localMode !== 'PLAN' && interactionMode !== 'WAYPOINT') return;
    const newWp = { id: Date.now(), ...wp };
    setWaypoints([...waypoints, newWp]);
    setMissionIntegrity(null);
    const msg = `Added Waypoint ${waypoints.length + 1} at ${wp.lat.toFixed(4)}, ${wp.lng.toFixed(4)}`;
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const handleMeasure = (pt) => {
    setMeasurePoints([...measurePoints, [pt.lat, pt.lng]]);
  };

  const connectSecureDrone = async () => {
     if (!firmwareStatus || !firmwareStatus.hashHex) {
         alert("Synchronizing with Stellar Testnet. Please give the ledger ~5-10 seconds to generate the genesis transaction blocks, then press this again.");
         return;
     }

     try {
       const droneKey = "G_DRONE_ZK_" + Math.random().toString(36).substr(2, 6).toUpperCase();
       const fwHash = firmwareStatus.hashHex; 
       
       await fetch('http://localhost:3000/initiate-handshake', {
         method: 'POST', headers: {'Content-Type': 'application/json'},
         body: JSON.stringify({ dronePubKey: droneKey, firmwareHash: fwHash })
       });
       
       const proof = "zkp_" + btoa(fwHash + "sec").substring(0, 32);
       const resVerify = await fetch('http://localhost:3000/verify-drone', {
         method: 'POST', headers: {'Content-Type': 'application/json'},
         body: JSON.stringify({ dronePubKey: droneKey, firmwareHash: fwHash, proof })
       });
       
       if (resVerify.ok) {
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

  return (
    <div className="h-screen w-screen bg-brand-slate text-gray-200 flex flex-col overflow-hidden font-sans">
      
      <header className="h-16 bg-brand-panel border-b border-stellar-indigo/20 flex items-center justify-between px-6 z-[100] shadow-2xl shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-gradient-to-br from-brand-blue to-teal-400 rounded-lg shadow-glow-blue">
            <Navigation className="text-white" size={20} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-black text-white tracking-[0.2em] uppercase leading-none">DRONE TRACKER</h1>
            <span className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-widest">Stellar Node v4.2</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
           {isWalletConnected ? (
              <div className="flex items-center gap-4 bg-black/40 border border-white/5 px-4 py-2 rounded-xl">
                 <div className="flex flex-col items-end">
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">CONNECTED WALLET</span>
                    <span className="text-white font-mono text-xs">{shortAddress} • <span className="text-brand-blue font-bold">{balance} XLM</span></span>
                 </div>
                 <div className="w-px h-8 bg-white/5 mx-2" />
                 <button onClick={walletDisconnect} className="text-slate-500 hover:text-red-400 transition-all p-1 hover:bg-red-400/10 rounded-lg">
                    <LogOut size={18} />
                 </button>
              </div>
           ) : (
              <div className="flex flex-col items-end gap-1">
                 <button 
                   onClick={walletConnect} 
                   className="bg-white text-black text-[10px] font-black uppercase tracking-widest px-6 py-2.5 rounded-xl shadow-glow-blue hover:bg-brand-blue hover:text-white transition-all flex items-center gap-2 group"
                 >
                    {walletLoading ? "Connecting..." : "Connect Gateway"} 
                    <Zap size={12} className="group-hover:animate-pulse" />
                 </button>
                 {walletError && <span className="text-[8px] font-bold text-red-500 animate-pulse">{walletError}</span>}
              </div>
           )}
           
           <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isDroneConnected ? 'border-brand-green/30 bg-brand-green/5 text-brand-green' : 'border-slate-800 bg-black/40 text-slate-600'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isDroneConnected ? 'bg-brand-green animate-pulse' : 'bg-slate-700'}`} />
              {isDroneConnected ? 'SECURE_LINK: ARMED' : 'SECURE_LINK: OFFLINE'}
           </div>
        </div>
      </header>

      <div className="flex flex-1 relative overflow-hidden">
        
        <aside className="w-20 bg-brand-panel border-r border-slate-800/50 flex flex-col items-center py-8 gap-8 z-50 shrink-0 shadow-2xl relative">
             <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/5 to-transparent" />
             
             <button 
               onClick={() => setInteractionMode(interactionMode === 'POLYGON' ? 'NONE' : 'POLYGON')}
               className={`p-3 rounded-xl transition-all hover:scale-110 ${interactionMode === 'POLYGON' ? 'bg-white text-black shadow-glow-blue' : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10'}`} title="Draw Area"
             ><Map size={22} /></button>
             
             <button 
               onClick={() => {
                  setInteractionMode(interactionMode === 'MEASURE' ? 'NONE' : 'MEASURE');
                  if (interactionMode !== 'MEASURE') setMeasurePoints([]);
               }}
               className={`p-3 rounded-xl transition-all hover:scale-110 ${interactionMode === 'MEASURE' ? 'bg-brand-amber text-black shadow-glow-purple' : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10'}`} title="Measure Path"
             ><Ruler size={22} /></button>
             
             <button 
               onClick={() => setInteractionMode(interactionMode === 'WAYPOINT' ? 'NONE' : 'WAYPOINT')}
               className={`p-3 rounded-xl transition-all hover:scale-110 ${interactionMode === 'WAYPOINT' ? 'bg-brand-green text-black shadow-glow-blue' : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10'}`} title="Place Waypoint"
             ><MapPin size={22} /></button>
             
             <div className="w-10 h-px bg-white/5 my-2"></div>
             
             <button onClick={uploadMission} className="p-3 rounded-xl bg-white/5 text-slate-400 border border-white/5 hover:bg-brand-green/20 hover:text-brand-green transition-all" title="Upload Protocol"><UploadCloud size={22} /></button>
             
             <button 
               onClick={() => setShowSettings(!showSettings)}
               className={`p-3 rounded-xl transition-all mt-auto ${showSettings ? 'bg-white text-black' : 'bg-white/5 text-slate-400 border border-white/5 hover:bg-white/10'}`} title="Diagnostics"
             ><Settings size={22} /></button>
        </aside>

        <div className="flex-1 flex flex-col relative z-0 overflow-hidden bg-brand-slate">
           <div className="flex-1 flex flex-col relative animate-in fade-in zoom-in duration-500 h-full">
                <div className="flex-1 relative">
            <MapContainer center={[telemetry.lat, telemetry.lng]} zoom={17} zoomControl={false} className={`h-full w-full ${interactionMode !== 'NONE' || localMode === 'PLAN' ? 'cursor-crosshair' : ''}`}>
              <TileLayer 
                 key={mapLayer}
                 url={mapLayer === 'SATELLITE' 
                    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"} 
                 attribution={mapLayer === 'SATELLITE'
                    ? 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                    : '&copy; OpenStreetMap contributors'}
              />
              
              <MapInteractionHandler mode={interactionMode === 'NONE' && localMode === 'PLAN' ? 'WAYPOINT' : interactionMode} onAddWaypoint={handleAddWaypoint} onMeasure={handleMeasure} />

              <Polyline positions={path} color="#FFFFFF" weight={3} opacity={0.6} />

              {measurePoints.length > 0 && interactionMode === 'MEASURE' && (
                 <>
                   <Polyline positions={measurePoints} color="#888888" weight={2} dashArray="5, 8" />
                   {measurePoints.map((pt, i) => (
                      <Marker key={i} position={pt} icon={new L.DivIcon({ className: 'bg-brand-amber w-2 h-2 rounded-full', iconSize: [8,8] })} />
                   ))}
                 </>
              )}
              
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

              {isDroneConnected && <Marker position={[telemetry.lat, telemetry.lng]} icon={droneIcon} />}
              
              <MapUpdater center={[telemetry.lat, telemetry.lng]} isFollowing={isFollowing && isDroneConnected} />
            </MapContainer>

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
              </div>
        </div>

        <aside className="w-96 bg-brand-panel border-l border-white/5 flex flex-col z-40 shrink-0 shadow-2xl">
             <div className="p-6 border-b border-stellar-indigo/10 flex items-center justify-between">
                <div className="flex items-center bg-black/40 rounded-lg p-1 border border-white/5">
                  {['PLAN', 'LIVE'].map(m => (
                    <button 
                      key={m}
                      onClick={() => handleModeChange(m)}
                      className={`px-4 py-1 text-[10px] font-black tracking-widest rounded-md transition-all ${localMode === m ? 'bg-white text-black' : 'text-slate-500'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] font-mono text-slate-500">{new Date().toLocaleTimeString()}</div>
             </div>
             
             <div className="p-6 border-b border-white/5">
                  <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2"><Zap size={14} className="text-brand-amber"/> Command Deck</h2>
                <div className="grid grid-cols-2 gap-3">
                   <button 
                    onClick={() => { sendCommand('ARM'); setLogs(prev => [`[${new Date().toLocaleTimeString()}] PROTOCOL: ARM_TRIGGERED`, ...prev]); }}
                    disabled={!isDroneConnected || !missionIntegrity?.success}
                    className="bg-brand-red text-white py-4 rounded-xl font-black text-xs tracking-widest hover:bg-red-500 transition-all shadow-[0_10px_30px_-5px_rgba(239,68,68,0.3)] disabled:opacity-20 disabled:cursor-not-allowed group relative overflow-hidden"
                   >
                     <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                     <span className="relative">ARM_DRONE</span>
                   </button>
                   <button 
                    onClick={() => { sendCommand('DISARM'); setLogs(prev => [`[${new Date().toLocaleTimeString()}] PROTOCOL: DISARM_VOID`, ...prev]); }}
                    disabled={!isDroneConnected}
                    className="bg-slate-800 text-slate-300 py-4 rounded-xl font-black text-xs tracking-widest hover:bg-slate-700 transition-all disabled:opacity-20"
                   >
                     DISARM
                   </button>
                </div>
                <button 
                  onClick={() => { sendCommand('RTL'); setLogs(prev => [`[${new Date().toLocaleTimeString()}] PROTOCOL: RETURNING_TO_HOME`, ...prev]); }}
                  disabled={!isDroneConnected}
                  className="mt-4 w-full bg-brand-amber/10 text-brand-amber border border-brand-amber/30 hover:bg-brand-amber hover:text-black py-3 rounded-xl font-black text-xs tracking-widest transition-all disabled:opacity-20"
                >
                  RETURN TO HOME
                </button>
             </div>

             <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
                <section>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Flight Database</h2>
                    <div className="flex gap-3">
                      <button onClick={clearWaypoints} className="text-slate-600 hover:text-brand-red transition-colors" title="Purge Mission"><Trash2 size={16}/></button>
                      <span className="text-[10px] font-black text-brand-blue bg-brand-blue/10 px-3 py-1 rounded-lg border border-brand-blue/20">{waypoints.length} POINTS</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {waypoints.map((wp, i) => (
                      <div key={wp.id} className="bg-black/20 rounded-xl py-3 px-4 border border-white/5 flex justify-between items-center hover:bg-white/5 transition-all cursor-pointer group">
                         <div className="flex gap-4 items-center">
                            <span className="bg-white/5 border border-white/10 text-slate-500 w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs group-hover:bg-brand-blue group-hover:text-black transition-all font-bold">{i+1}</span>
                            <div>
                              <div className="font-mono text-white text-[11px] tracking-tight">{parseFloat(wp.lat).toFixed(6)}, {parseFloat(wp.lng).toFixed(6)}</div>
                              <div className="text-[9px] text-slate-600 uppercase tracking-[0.1em] font-bold">LATITUDE / LONGITUDE</div>
                            </div>
                         </div>
                         <div className="text-brand-green font-mono text-xs bg-brand-green/10 px-3 py-1.5 rounded-lg border border-brand-green/10">
                            <input type="number" value={wp.alt} onChange={e => {
                               const newWp = [...waypoints];
                               newWp[i].alt = parseFloat(e.target.value) || 0;
                               setWaypoints(newWp);
                               setMissionIntegrity(null);
                            }} className="bg-transparent w-8 outline-none text-right font-bold" />m
                         </div>
                      </div>
                    ))}
                    {waypoints.length === 0 && (
                      <div className="bg-black/20 border border-dashed border-white/10 rounded-2xl p-10 text-center">
                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                          <MapPin size={24} className="text-slate-700" />
                        </div>
                        <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest leading-relaxed">Awaiting Map Selection...<br/>Place Waypoints to Initialize</p>
                      </div>
                    )}
                  </div>
                </section>

                {waypoints.length > 0 && (
                   <section className="space-y-3 animate-in slide-in-from-bottom-4 duration-500">
                       {missionIntegrity?.success ? (
                             <div className="space-y-2">
                               <a href={missionIntegrity.explorerUrl} target="_blank" rel="noreferrer" className="w-full flex justify-center items-center gap-3 bg-brand-green/10 text-brand-green py-4 rounded-xl text-[10px] font-black tracking-widest border border-brand-green/30 hover:bg-brand-green hover:text-black transition-all">
                                  <ShieldCheck size={16} /> BLOCKCHAIN_VERIFIED
                               </a>
                               <div className="p-4 bg-black/40 rounded-xl border border-white/5">
                                  <div className="text-[8px] font-black text-slate-600 uppercase mb-2 tracking-[0.2em]">Cryptographic Payload Hash</div>
                                  <div className="text-[9px] font-mono text-slate-400 break-all leading-relaxed bg-black/40 p-2 rounded border border-white/5">{missionIntegrity.hashHex}</div>
                               </div>
                             </div>
                       ) : (
                             <button onClick={registerMission} disabled={isRegistering} className="w-full bg-stellar-indigo text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:shadow-glow-purple border border-white/10 flex justify-center items-center gap-3 disabled:opacity-50">
                               {isRegistering ? 'ANCHORING_DNA...' : <><Shield size={16}/> ANCHOR_INTEGRITY</>}
                             </button>
                       )}
                       <button onClick={uploadMission} disabled={!missionIntegrity?.success} className={`w-full py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex justify-center items-center gap-3 ${missionIntegrity?.success ? 'bg-white text-black hover:bg-brand-blue hover:text-white shadow-glow-blue' : 'bg-slate-800 text-slate-600 border border-white/5 cursor-not-allowed opacity-50'}`}>
                         <UploadCloud size={16}/> {missionIntegrity?.success ? 'DEPLOY_PROTOCOL' : 'AWAITING_INTEGRITY'}
                       </button>
                   </section>
                )}
                
                <section className="pt-8 border-t border-white/5">
                   <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Stellar Bridge</h2>
                      <div className="flex items-center gap-1.5">
                         <div className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-pulse" />
                         <span className="text-[8px] font-bold text-brand-blue/60 uppercase tracking-tighter">Testnet Active</span>
                      </div>
                   </div>
                   <StellarBoard 
                      address={address}
                      balance={balance}
                      isWalletConnected={isWalletConnected}
                      loading={walletLoading}
                      error={walletError}
                      lastTxHash={lastTxHash}
                      connect={walletConnect}
                      disconnect={walletDisconnect}
                      refreshBalance={refreshBalance}
                      sendPayment={sendPayment}
                   />
                </section>

             </div>
        </aside>
      </div>

      <footer className="h-16 bg-brand-panel border-t border-white/5 flex items-center px-12 z-50 shadow-2xl shrink-0 justify-between">
           <div className="flex items-center gap-12">
             <div className="flex flex-col">
                <span className="text-[8px] text-slate-600 font-black tracking-[0.3em] uppercase mb-1">Altitude</span>
                <div className="flex items-end gap-1 leading-none">
                  <span className={`font-mono font-black text-2xl ${isDroneConnected ? 'text-white' : 'text-slate-800'}`}>
                     {isDroneConnected ? (units === 'METRIC' ? telemetry.altitude.toFixed(1) : (telemetry.altitude * 3.28084).toFixed(1)) : '0.0'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-600 mb-1">{units === 'METRIC' ? 'M' : 'FT'}</span>
                </div>
             </div>

             <div className="flex flex-col">
                <span className="text-[8px] text-slate-600 font-black tracking-[0.3em] uppercase mb-1">Velocity</span>
                <div className="flex items-end gap-1 leading-none">
                  <span className={`font-mono font-black text-2xl ${isDroneConnected ? 'text-white' : 'text-slate-800'}`}>
                    {isDroneConnected ? (units === 'METRIC' ? telemetry.speed.toFixed(1) : (telemetry.speed * 2.23694).toFixed(1)) : '0.0'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-600 mb-1">{units === 'METRIC' ? 'M/S' : 'MPH'}</span>
                </div>
             </div>

             <div className="flex flex-col">
                <span className="text-[8px] text-slate-600 font-black tracking-[0.3em] uppercase mb-1">Heading</span>
                <div className="flex items-end gap-1 leading-none">
                  <span className={`font-mono font-black text-2xl ${isDroneConnected ? 'text-white' : 'text-slate-800'}`}>
                     {isDroneConnected ? telemetry.heading : '000'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-600 mb-1">°</span>
                </div>
             </div>
           </div>

           <div className="flex items-center gap-8">
              <div className="flex flex-col items-end">
                <span className="text-[8px] text-slate-600 font-black tracking-[0.3em] uppercase mb-1">Power_System</span>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-2 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                    <div className={`h-full rounded-full transition-all duration-500 ${telemetry.battery > 70 ? 'bg-brand-green' : telemetry.battery > 30 ? 'bg-brand-amber' : 'bg-brand-red'}`} style={{width: `${telemetry.battery}%`}} />
                  </div>
                  <span className="font-mono font-black text-sm text-white">{telemetry.battery.toFixed(1)}%</span>
                </div>
              </div>
           </div>
        </footer>

      {showSettings && (
         <div className="absolute inset-0 z-[4000] bg-black/80 backdrop-blur-md flex items-center justify-end p-0">
            <div className="bg-brand-panel w-full max-w-md h-full border-l border-slate-700 shadow-2xl flex flex-col transform transition-transform duration-300 ease-out">
               <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                  <h2 className="text-xl font-black text-white tracking-widest flex items-center gap-3">
                     <Settings size={22} className="text-brand-blue" /> SETTINGS & DIAGNOSTICS
                  </h2>
                  <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-full">
                     <X size={24} />
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                  
                  {/* Telemetry Units */}
                  <section>
                     <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Telemetry Units</h3>
                     <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-lg border border-slate-800">
                        <button 
                           onClick={() => setUnits('METRIC')}
                           className={`py-2 text-xs font-bold rounded transition-all ${units === 'METRIC' ? 'bg-brand-blue text-black shadow-lg shadow-brand-blue/20' : 'text-slate-400 hover:text-white'}`}
                        >METRIC (m, m/s)</button>
                        <button 
                           onClick={() => setUnits('IMPERIAL')}
                           className={`py-2 text-xs font-bold rounded transition-all ${units === 'IMPERIAL' ? 'bg-brand-blue text-black shadow-lg shadow-brand-blue/20' : 'text-slate-400 hover:text-white'}`}
                        >IMPERIAL (ft, mph)</button>
                     </div>
                  </section>

                  {/* Map Configuration */}
                  <section>
                     <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Tactical Map Layer</h3>
                     <div className="space-y-3">
                        <div 
                           onClick={() => setMapLayer('SATELLITE')}
                           className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center gap-4 ${mapLayer === 'SATELLITE' ? 'border-brand-blue bg-brand-blue/5' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}
                        >
                           <div className="w-12 h-12 rounded bg-slate-800 border border-slate-700 overflow-hidden shrink-0">
                             <img src="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/15/12410/18155" alt="Sat" className="w-full h-full object-cover" />
                           </div>
                           <div className="flex-1">
                              <div className="text-sm font-bold text-white">ESRI High-Res Satellite</div>
                              <div className="text-[10px] text-slate-500">Global multi-spectral imagery</div>
                           </div>
                           {mapLayer === 'SATELLITE' && <ShieldCheck size={18} className="text-brand-blue" />}
                        </div>

                        <div 
                           onClick={() => setMapLayer('STREETS')}
                           className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center gap-4 ${mapLayer === 'STREETS' ? 'border-brand-amber bg-brand-amber/5' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}
                        >
                           <div className="w-12 h-12 rounded bg-slate-800 border border-slate-700 overflow-hidden shrink-0">
                             <img src="https://a.tile.openstreetmap.org/15/12410/18155.png" alt="Street" className="w-full h-full object-cover grayscale opacity-50" />
                           </div>
                           <div className="flex-1">
                              <div className="text-sm font-bold text-white">OSM Vector Core</div>
                              <div className="text-[10px] text-slate-500">Fast-loading topographic layout</div>
                           </div>
                           {mapLayer === 'STREETS' && <ShieldCheck size={18} className="text-brand-amber" />}
                        </div>
                     </div>
                  </section>

                  {/* System Event Log (The previously hidden 'logs' state) */}
                  <section className="flex flex-col h-[400px]">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">System Event Log</h3>
                        <span className="text-[9px] font-mono text-brand-blue bg-brand-blue/10 px-2 py-0.5 rounded border border-brand-blue/20">{logs.length} EVENTS</span>
                     </div>
                     <div className="flex-1 bg-black border border-slate-800 rounded-lg overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-y-auto p-4 font-mono text-[10px] space-y-2 custom-scrollbar">
                           {logs.map((log, i) => {
                              const isError = log.includes('Error') || log.includes('REJECTED') || log.includes('FAILURE');
                              const isSuccess = log.includes('VERIFIED') || log.includes('Authenticated') || log.includes('Secured');
                              return (
                                 <div key={i} className={`p-2 rounded border-l-2 bg-slate-900/50 ${isError ? 'border-red-500 text-red-400' : isSuccess ? 'border-brand-green text-brand-green' : 'border-slate-700 text-slate-300'}`}>
                                    {log}
                                 </div>
                              );
                           })}
                           {logs.length === 0 && <div className="text-slate-600 italic text-center py-8">No protocol events logged in the current session.</div>}
                        </div>
                        <button 
                           onClick={() => setLogs([])}
                           className="w-full py-2 bg-slate-900 border-t border-slate-800 text-[10px] font-bold text-slate-500 hover:text-brand-red transition-colors"
                        >CLEAR EVENT LOG</button>
                     </div>
                  </section>

                  {/* Network Diagnostics */}
                  <section>
                     <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Network Diagnostics</h3>
                     <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-3">
                        <div className="flex justify-between items-center">
                           <span className="text-[10px] text-slate-500">GCS Endpoint</span>
                           <span className="text-[10px] font-mono text-white">ws://localhost:3000</span>
                        </div>
                         <div className="flex justify-between items-center">
                           <span className="text-[10px] text-slate-500">Stellar Network</span>
                           <span className="text-[10px] font-mono text-brand-green">Testnet (Protocol v20)</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                           <span className="text-[10px] text-slate-500">Status</span>
                           <span className={`text-[10px] font-bold font-mono ${isDroneConnected ? 'text-brand-green' : 'text-brand-amber'}`}>
                              {isDroneConnected ? "SESSION_ACTIVE" : "AWAITING_HANDSHAKE"}
                           </span>
                        </div>
                     </div>
                  </section>
               </div>
               
               <div className="p-6 bg-slate-900/80 border-t border-slate-700 text-[9px] text-slate-500 text-center uppercase tracking-widest">
                  GCS Terminal v4.2.0 • Build 2024.03
               </div>
            </div>
         </div>
      )}
      
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
                           <div className="text-white break-all">{address || "Unauthenticated Local Agent"}</div>
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

