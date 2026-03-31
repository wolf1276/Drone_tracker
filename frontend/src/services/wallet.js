import * as freighter from "@stellar/freighter-api";

export const WalletService = {
  /**
   * Check if Freighter is installed
   */
  async isInstalled() {
    return await freighter.isConnected();
  },

  /**
   * Request wallet access (get public key)
   */
  async connect() {
    if (!(await this.isInstalled())) {
      throw new Error("Freighter wallet not found. Please install the extension.");
    }

    try {
      // Connect and get public key (compatible with both older object and newer string API versions)
      const accessResult = await freighter.requestAccess();
      const publicKey = typeof accessResult === 'string' ? accessResult : accessResult?.publicKey;
      
      if (!publicKey) {
          throw new Error("Could not retrieve public key. Please ensure the wallet is unlocked and access is granted.");
      }

      // Verify network is Testnet (requirement)
      let network = "UNKNOWN";
      try {
          network = await freighter.getNetwork() || "UNKNOWN";
      } catch (ne) {
          console.warn("Could not retrieve network from Freighter", ne);
      }

      return {
        address: publicKey,
        network: network.toUpperCase()
      };
    } catch (error) {
      console.error("Critical: Wallet connection sequence failed:", error);
      throw (typeof error === 'string' ? new Error(error) : error);
    }
  },

  /**
   * Disconnect local state tracking (wallet itself doesn't have a disconnect API)
   */
  async disconnect() {
    // Freighter doesn't provide a direct disconnect, 
    // so we just clear our internal state in the app.
    return true;
  },

  /**
   * Sign a transaction with Freighter
   */
  async signTransaction(xdr, network = "TESTNET") {
    try {
      const signedXdr = await freighter.signTransaction(xdr, { network });
      return signedXdr;
    } catch (error) {
       console.error("Signing error:", error);
       throw error;
    }
  }
};
