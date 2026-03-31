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
      // Connect and get public key
      const { publicKey } = await freighter.requestAccess();
      
      // Verify network is Testnet (requirement)
      const network = await freighter.getNetwork();
      if (!network.toUpperCase().includes("TESTNET")) {
        // We shouldn't throw here if we want users to switch, but we'll warn later
        console.warn("Wallet connected to", network, "- please switch to TESTNET");
      }

      return {
        address: publicKey,
        network: network.toUpperCase()
      };
    } catch (error) {
      console.error("Wallet connection error:", error);
      throw error;
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
