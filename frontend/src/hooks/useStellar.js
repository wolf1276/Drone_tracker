import { useState, useEffect, useCallback } from 'react';
import { WalletService } from '../services/wallet';
import { StellarService } from '../services/stellar';

export const useStellar = () => {
  const [address, setAddress] = useState(localStorage.getItem('wallet_address') || null);
  const [balance, setBalance] = useState("0.0");
  const [isWalletConnected, setIsWalletConnected] = useState(!!localStorage.getItem('wallet_address'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastTxHash, setLastTxHash] = useState(null);

  /**
   * Refetches balance for current address
   */
  const refreshBalance = useCallback(async () => {
    if (!address) return;
    try {
      const bal = await StellarService.getBalance(address);
      setBalance(bal);
    } catch(e) {
      console.error("Balance refresh failed", e);
    }
  }, [address]);

  /**
   * Connect wallet and store in local storage
   */
  const connect = async () => {
    setLoading(true);
    setError(null);
    try {
      const { address } = await WalletService.connect();
      setAddress(address);
      setIsWalletConnected(true);
      localStorage.setItem('wallet_address', address);
      
      // Auto-refresh balance
      const bal = await StellarService.getBalance(address);
      setBalance(bal);
      return address;
    } catch (e) {
      console.error(e);
      setError(e.message || "Failed to connect wallet.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Disconnect and clear local storage
   */
  const disconnect = () => {
    setAddress(null);
    setIsWalletConnected(false);
    setBalance("0.0");
    localStorage.removeItem('wallet_address');
  };

  /**
   * Send payment wrapper
   */
  const sendPayment = async (recipient, amount) => {
    if (!address) return;
    setLoading(true);
    setError(null);
    setLastTxHash(null);
    try {
      // 1. Construct transaction
      const xdr = await StellarService.createPaymentTransaction(address, recipient, amount);
      
      // 2. Sign with wallet
      const signedXdr = await WalletService.signTransaction(xdr, "TESTNET");
      
      // 3. Submit to Stellar
      const res = await StellarService.submitSignedTransaction(signedXdr);
      
      if (res.success) {
        setLastTxHash(res.hash);
        // Refresh balance after successful TX
        await refreshBalance();
        return res;
      } else {
        throw new Error(res.error || "Transaction Submission Failed.");
      }
    } catch(e) {
       console.error("Payment error:", e);
       setError(e.message || "An unexpected error occurred during transaction payment.");
       return { success: false, error: e.message };
    } finally {
       setLoading(false);
    }
  };

  // Auto-refresh balance on mount
  useEffect(() => {
    if (address) {
       refreshBalance();
    }
  }, [address, refreshBalance]);

  return {
    address,
    balance,
    isWalletConnected,
    loading,
    error,
    lastTxHash,
    connect,
    disconnect,
    refreshBalance,
    sendPayment,
    shortAddress: StellarService.shortAddress(address)
  };
};
