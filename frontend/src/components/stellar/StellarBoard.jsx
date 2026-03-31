import { WalletCard } from './WalletCard';
import { SendTransactionForm } from './SendTransactionForm';
import { Zap, ShieldCheck, Globe, Star } from 'lucide-react';

export default function StellarBoard({ 
  address, 
  balance, 
  isWalletConnected, 
  loading, 
  error, 
  lastTxHash, 
  connect, 
  disconnect, 
  refreshBalance, 
  sendPayment 
}) {

  if (!isWalletConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-brand-panel rounded-2xl border border-slate-700/40 relative overflow-hidden group">
         {/* Animated Background Gradients */}
         <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/20 transition-all duration-1000" />
         <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2 group-hover:bg-purple-500/20 transition-all duration-1000" />
         
         <div className="relative z-10 w-full max-w-sm">
            <div className="mx-auto w-24 h-24 bg-white/5 rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl mb-8 group-hover:scale-105 transition-transform">
               <Star size={48} className="text-brand-blue fill-brand-blue/20" />
            </div>
            
            <h2 className="text-3xl font-black text-white tracking-tighter mb-4">
              LAUNCH STELLAR <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-blue to-teal-400">dAPP</span>
            </h2>
            <p className="text-slate-400 text-sm mb-10 leading-relaxed max-w-sm mx-auto">
              Connect your Freighter wallet to interact with the Stellar Network. Send XLM payments with lightning speed and ultra-low fees.
            </p>
            
            <button 
              onClick={connect}
              disabled={loading}
              className="w-full bg-white text-black font-black uppercase tracking-widest text-xs py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-brand-blue hover:text-white transition-all shadow-[0_20px_50px_-10px_rgba(255,255,255,0.2)] hover:shadow-glow-blue active:scale-95 disabled:opacity-50"
            >
               {loading ? "ESTABLISHING..." : "CONNECT FREIGHTER"}
               <Zap size={16} />
            </button>

            <div className="mt-8 flex items-center justify-center gap-6 opacity-30">
               <div className="flex items-center gap-2"><Globe size={14}/> TESTNET</div>
               <div className="flex items-center gap-2"><ShieldCheck size={14}/> ENCRYPTED</div>
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-700">
      <div className="space-y-6 lg:col-span-1">
         <WalletCard 
            address={address} 
            balance={balance} 
            onDisconnect={disconnect} 
            onRefresh={refreshBalance} 
            loading={loading}
         />
         
         {/* Network Info Panel */}
         <div className="bg-brand-panel border border-slate-800 p-5 rounded-xl shadow-premium">
            <div className="flex items-center gap-3 mb-4">
               <Globe className="text-brand-green" size={18} />
               <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Network Status</h3>
            </div>
            <div className="space-y-3">
               <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Active Network</span>
                  <span className="text-brand-green font-bold">TESTNET</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Protocol Version</span>
                  <span className="text-white font-mono">v20</span>
               </div>
               <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Horizon Endpoint</span>
                  <span className="text-slate-400 text-[10px] truncate max-w-[120px]">horizon-testnet.stellar.org</span>
               </div>
            </div>
         </div>
      </div>
      
      <div className="lg:col-span-2">
         <SendTransactionForm 
            onSend={sendPayment}
            loading={loading}
            error={error}
            lastHash={lastTxHash}
         />
      </div>
    </div>
  );
}
