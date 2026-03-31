import { 
  requestAccess, 
  getNetwork, 
  signTransaction, 
  isConnected 
} from "@stellar/freighter-api";

export const WalletService = {
  /**
   * Check if Freighter is installed
   */
  async isInstalled() {
    try {
      return await isConnected();
    } catch (e) {
      console.warn("Freighter detection failed:", e);
      return false;
    }
  },

  /**
   * Request wallet access (get public key)
   */
  async connect() {
    try {
      // 1. Direct Access Request (most reliable for triggering prompt)
      // v6+ returns the public key as a string directly
      const publicKey = await requestAccess();
      
      if (!publicKey) {
          throw new Error("Access denied or no public key returned.");
      }

      // 2. Get Network Info (v6+)
      let networkValue = "TESTNET";
      try {
          const res = await getNetwork();
          // Ensure we extract a string even if the API returns an object or different type
          networkValue = typeof res === 'string' ? res : (res?.network || String(res) || "TESTNET");
      } catch (e) {
          console.warn("Using default network TESTNET", e);
      }

      const networkName = String(networkValue || "TESTNET").toUpperCase();

      return {
        address: publicKey,
        network: networkName
      };
    } catch (error) {
      const msg = typeof error === 'string' ? error : (error?.message || "Unknown Wallet Error");
      console.error("Wallet connection failed:", msg);
      
      // Provide more helpful error messages
      if (msg.includes("User declined")) {
        throw new Error("Connection request declined by user.");
      }
      if (msg.includes("not found") || msg.includes("is not defined")) {
        throw new Error("Freighter not detected. Please install and unlock.");
      }
      
      throw new Error(msg || "Failed to link Freighter Gateway.");
    }
  },

  /**
   * Disconnect local state tracking
   */
  async disconnect() {
    return true;
  },

  /**
   * Sign a transaction with Freighter
   */
  async signTransaction(xdr, network = "TESTNET") {
    try {
      return await signTransaction(xdr, { network });
    } catch (error) {
       console.error("Signing failed:", error);
       throw error;
    }
  }
};
