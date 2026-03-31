import * as StellarSdk from 'stellar-sdk';

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const server = new StellarSdk.Horizon.Server(HORIZON_URL);

export const StellarService = {
  /**
   * Fetch XLM balance for a given public key on Testnet
   * @param {string} address 
   */
  async getBalance(address) {
    if (!address) return "0.0";
    try {
      const account = await server.loadAccount(address);
      const balance = account.balances.find((b) => b.asset_type === "native");
      return balance ? parseFloat(balance.balance).toFixed(4) : "0.0000";
    } catch (e) {
      if (e?.response?.status === 404) {
        console.warn("Account not found. It might not be funded on Testnet yet.");
        return "Not Funded (0.0)";
      }
      console.error("Balance fetch failed", e);
      return "Error";
    }
  },

  /**
   * Formats a public key for shorter display (e.g., GABC...XYZ)
   * @param {string} address 
   */
  shortAddress(address) {
    if (!address || typeof address !== 'string') return "";
    try {
      return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
    } catch (e) {
      console.warn("shortAddress failed for", address, e);
      return String(address).substring(0, 8);
    }
  },

  /**
   * Send a payment transaction on Stellar Testnet
   * @param {string} senderAddr - The public key of the current wallet
   * @param {string} recipientAddr - Recipient's public key
   * @param {string} amount - Amount in XLM
   * @param {function} sign - A callback function that calls the wallet to sign the XDR
   */
  async createPaymentTransaction(senderAddr, recipientAddr, amount) {
    try {
      // 1. Load sender account to get current sequence number
      const senderAccount = await server.loadAccount(senderAddr);
      
      // 2. Fetch network fee and build tx
      const fee = await server.fetchBaseFee();

      const transaction = new StellarSdk.TransactionBuilder(senderAccount, {
        fee: fee,
        networkPassphrase: StellarSdk.Networks.TESTNET
      })
      .addOperation(StellarSdk.Operation.payment({
        destination: recipientAddr,
        asset: StellarSdk.Asset.native(),
        amount: amount.toString()
      }))
      .setTimeout(30)
      .build();

      // Return the XDR string for wallet signing
      return transaction.toXDR();
    } catch (error) {
      console.error("Transaction construction failed", error);
      throw error;
    }
  },

  /**
   * Submit a signed XDR to the Horizon server (Testnet)
   * @param {string} signedXdr 
   */
  async submitSignedTransaction(signedXdr) {
    try {
      const transaction = new StellarSdk.Transaction(signedXdr, StellarSdk.Networks.TESTNET);
      const response = await server.submitTransaction(transaction);
      return { 
        success: true, 
        hash: response.hash,
        ledger: response.ledger,
        explorerUrl: `https://stellar.expert/explorer/testnet/tx/${response.hash}`
      };
    } catch (error) {
       console.error("Submission failed", error?.response?.data || error);
       const resultCodes = error?.response?.data?.extras?.result_codes;
       let errorMsg = "Transaction failed on-chain.";
       if (resultCodes?.operations?.includes("op_underfunded")) {
         errorMsg = "Insufficient XLM balance for this payment.";
       }
       return { success: false, error: errorMsg, details: error?.response?.data };
    }
  }
};
