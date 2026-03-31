import React, { useState } from 'react';
import { Send, CheckCircle, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';

export const SendTransactionForm = ({ onSend, loading, error, lastHash }) => {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [validationError, setValidationError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError(null);

    // Basic Stellar Public Key Validation
    if (!recipient || recipient.length !== 56 || !recipient.startsWith('G')) {
      setValidationError("Invalid recipient address. Must be a 56-character Stellar public key starting with 'G'.");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setValidationError("Amount must be greater than zero.");
      return;
    }

    onSend(recipient, amount);
  };

  return (
    <div className="bg-brand-panel border border-slate-700/50 p-6 rounded-xl shadow-premium h-full flex flex-col justify-between overflow-hidden">
      <div>
        <h3 className="text-xl font-black text-white tracking-widest flex items-center gap-2 mb-6">
          <Send size={20} className="rotate-12 text-brand-blue" />
          SEND TRANSACTION
        </h3>

        <form onSubmit={handleSubmit} className="space-y-5">
           <div className="space-y-1">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Recipient Public Key</label>
             <input 
                type="text" 
                placeholder="GABC...XYZ" 
                className={`w-full bg-stellar-dark/80 border ${validationError?.includes('recipient') ? 'border-brand-red' : 'border-slate-800'} focus:border-brand-blue/50 text-white p-3 rounded-lg font-mono text-sm outline-none transition-all placeholder:text-slate-700`}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                disabled={loading}
             />
           </div>

           <div className="space-y-1">
             <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-1">Amount (XLM)</label>
             <div className="relative">
                <input 
                    type="number" 
                    step="0.0001"
                    placeholder="0.00" 
                    className={`w-full bg-stellar-dark/80 border ${validationError?.includes('Amount') ? 'border-brand-red' : 'border-slate-800'} focus:border-brand-blue/50 text-white p-3 rounded-lg font-mono text-xl outline-none transition-all placeholder:text-slate-700`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={loading}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-600">XLM</span>
             </div>
           </div>

           {validationError && (
              <div className="flex items-start gap-2 bg-brand-red/10 border border-brand-red/40 p-3 rounded-lg text-brand-red text-xs">
                 <AlertCircle size={16} className="shrink-0 mt-0.5" />
                 <span>{validationError}</span>
              </div>
           )}

           <button 
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-black tracking-widest text-sm transition-all overflow-hidden relative group ${loading ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed shadow-none' : 'bg-brand-blue text-white hover:shadow-glow-blue'}`}
           >
              {loading ? (
                <>
                   <Loader2 size={20} className="animate-spin" /> 
                   SUBMITTING...
                </>
              ) : (
                <>
                   <Send size={18} />
                   BROADCAST TRANSACTION
                </>
              )}
           </button>
        </form>
      </div>

      {/* Status Indicators */}
      <div className="mt-8 space-y-4">
          {error && (
            <div className="bg-brand-red/10 border border-brand-red/20 p-4 rounded-xl flex items-center gap-4 transition-all animate-in fade-in zoom-in duration-300">
               <div className="p-2 bg-brand-red/20 rounded-full">
                  <AlertCircle size={24} className="text-brand-red" />
               </div>
               <div className="overflow-hidden">
                  <div className="text-white text-sm font-bold uppercase tracking-widest">Transaction Failed</div>
                  <div className="text-xs text-brand-red/80 font-mono mt-0.5 break-all line-clamp-2">{error}</div>
               </div>
            </div>
          )}

          {lastHash && (
            <div className="bg-brand-green/10 border border-brand-green/20 p-4 rounded-xl flex items-center gap-4 transition-all animate-in slide-in-from-bottom-2 duration-500">
               <div className="p-2 bg-brand-green/20 rounded-full">
                  <CheckCircle size={24} className="text-brand-green" />
               </div>
               <div className="overflow-hidden flex-1">
                  <div className="text-white text-sm font-bold uppercase tracking-widest">Broadcast Success</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">TX: {lastHash}</div>
               </div>
               <a 
                 href={`https://stellar.expert/explorer/testnet/tx/${lastHash}`} 
                 target="_blank" 
                 rel="noreferrer"
                 className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                 title="View Transaction"
               >
                 <ExternalLink size={18} />
               </a>
            </div>
          )}
      </div>
    </div>
  );
};
