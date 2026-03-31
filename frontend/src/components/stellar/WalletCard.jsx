import React from 'react';
import { Wallet, LogOut, RefreshCw, ExternalLink } from 'lucide-react';

export const WalletCard = ({ address, balance, onDisconnect, onRefresh, loading }) => {
  const shortAddress = address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : '';

  return (
    <div className="bg-brand-panel border border-slate-700 p-6 rounded-xl shadow-premium">
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-blue/10 rounded-lg">
            <Wallet className="text-brand-blue" size={24} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-none">Wallet Address</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-white text-lg">{shortAddress || 'G---...---'}</span>
              <a 
                href={`https://stellar.expert/explorer/testnet/account/${address}`} 
                target="_blank" 
                rel="noreferrer"
                className="text-slate-500 hover:text-brand-blue transition-colors"
                title="View on Stellar Expert"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </div>
        <button 
          onClick={onDisconnect}
          className="text-slate-500 hover:text-brand-red p-2 hover:bg-brand-red/10 rounded-lg transition-colors group"
          title="Disconnect wallet"
        >
          <LogOut size={20} className="group-hover:rotate-12 transition-transform" />
        </button>
      </div>

      <div className="bg-stellar-dark/50 border border-slate-800 rounded-xl p-5 flex justify-between items-center relative overflow-hidden group">
         <div className="absolute inset-0 bg-blue-500/5 transition-opacity opacity-0 group-hover:opacity-100 animate-pulse pointer-events-none" />
         <div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">XLM Balance (Testnet)</span>
            <div className="text-3xl font-black text-white mt-1 font-mono tracking-tight flex items-center gap-2">
               {balance} <span className="text-sm font-bold text-slate-500">XLM</span>
            </div>
         </div>
         <button 
           onClick={onRefresh}
           disabled={loading}
           aria-label="refresh"
           className={`p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all border border-slate-700 ${loading ? 'animate-spin' : 'hover:shadow-glow-blue'}`}
         >

           <RefreshCw size={18} />
         </button>
      </div>
      
      <div className="mt-4 flex gap-2">
         <span className="text-[9px] font-bold text-brand-green bg-brand-green/10 px-2 py-1 rounded border border-brand-green/20">TESTNET ACTIVE</span>
         <span className="text-[9px] font-bold text-brand-blue bg-brand-blue/10 px-2 py-1 rounded border border-brand-blue/20">FREIGHTER CONNECTED</span>
      </div>
    </div>
  );
};
