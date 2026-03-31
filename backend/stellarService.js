require('dotenv').config();
const StellarSdk = require('stellar-sdk');
const crypto = require('crypto');
const axios = require('axios');

// Configure Horizon Server
const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
const networkPassphrase = StellarSdk.Networks.TESTNET;

// Wallet setup
let sourceKeypair;

if (process.env.STELLAR_PRIVATE_KEY) {
  sourceKeypair = StellarSdk.Keypair.fromSecret(process.env.STELLAR_PRIVATE_KEY);
  console.log('Stellar Wallet Loaded from .env. Public:', sourceKeypair.publicKey());
} else {
  // Generate random keypair for hackathon if no .env is provided
  sourceKeypair = StellarSdk.Keypair.random();
  console.log('No STELLAR_PRIVATE_KEY found in .env. Generated temporary Session keypair:');
  console.log('Public:', sourceKeypair.publicKey());
  console.log('Secret:', sourceKeypair.secret());
}

// Auto-fund testing account
async function fundAccountIfEmpty() {
    for (let i = 0; i < 5; i++) {
        try {
            await server.loadAccount(sourceKeypair.publicKey());
            console.log("Stellar Account active and ready.");
            return true;
        } catch (e) {
            console.log(`[Stellar] Account not found (attempt ${i+1}/5). Funding via Friendbot...`);
            try {
                await axios.get(`https://friendbot.stellar.org?addr=${encodeURIComponent(sourceKeypair.publicKey())}`);
                console.log("Stellar Account funding request sent!");
                // Wait for Friendbot to process
                await new Promise(r => setTimeout(r, 4000));
            } catch(err) {
                console.error("Friendbot request failed", err.message);
            }
        }
    }
    return false;
}

// Global initialization promise
const initPromise = fundAccountIfEmpty();

// Wait wrapper for services
async function ensureInitialized() {
    await initPromise;
}


// Hash computer (SHA256 -> hex string)
function computeHash(dataString) {
  return crypto.createHash('sha256').update(dataString).digest('hex');
}

// Submits the SHA256 hex as a Memo in a transaction
async function registerHashOnBlockchain(hashHex) {
  let transaction; 
  try {
    await ensureInitialized();
    const account = await server.loadAccount(sourceKeypair.publicKey());

    
    // Memo.hash accepts a 32-byte hex string! Ideal for SHA256.
    const memo = StellarSdk.Memo.hash(hashHex);

    transaction = new StellarSdk.TransactionBuilder(account, {
      fee: await server.fetchBaseFee(),
      networkPassphrase
    })
      // Small payment to self to anchor the hash memo
      .addOperation(StellarSdk.Operation.payment({
        destination: sourceKeypair.publicKey(),
        asset: StellarSdk.Asset.native(),
        amount: '0.0000001'
      }))
      .addMemo(memo)
      .setTimeout(30)
      .build();

    transaction.sign(sourceKeypair);
    const response = await server.submitTransaction(transaction);
    return response.hash;
  } catch (error) {
    if (error?.response?.status === 504 && transaction) {
       console.log("Transaction submission timed out. Checking if tx confirmed...");
       const txHash = transaction.hash().toString('hex');
       // Poll for success
       for (let i = 0; i < 5; i++) {
          await new Promise(r => setTimeout(r, 2000));
          try {
             await server.transactions().transaction(txHash).call();
             console.log("Transaction found on-chain after timeout!");
             return txHash;
          } catch(e) {}
       }
    }
    console.error("Error submitting to Stellar:", error?.response?.data || error.message);
    throw new Error('Failed to register on blockchain');
  }
}

// Queries Horizon for the transaction and verifies memo matches expected hash
async function verifyHashOnBlockchain(txId, expectedHashHex) {
  try {
    await ensureInitialized();
    const tx = await server.transactions().transaction(txId).call();
    if (tx.memo_type === 'hash') {
      const memoBuffer = Buffer.from(tx.memo, 'base64');
      const memoHex = memoBuffer.toString('hex');
      return memoHex === expectedHashHex;
    }
    return false;
  } catch(e) {
    console.error("Blockchain verification failed:", e.message);
    return false;
  }
}

// Searches recent transactions for a matching payload hash securely
async function searchHashInAccount(hashHex) {
  try {
    await ensureInitialized();
    const accountId = sourceKeypair.publicKey();
    const txPage = await server.transactions().forAccount(accountId).order('desc').limit(150).call();
    for (const tx of txPage.records) {
      if (tx.memo_type === 'hash') {
        const memoBuffer = Buffer.from(tx.memo, 'base64');
        const memoHex = memoBuffer.toString('hex');
        if (memoHex === hashHex) {
           return { success: true, txId: tx.id, hashHex: memoHex, timestamp: tx.created_at };
        }
      }
    }
    return { success: false, reason: "Hash footprint not found in recent ledger anchors." };
  } catch(e) { return { success: false, reason: e.message }; }
}

async function verifyTxId(txId) {
  try {
    const tx = await server.transactions().transaction(txId).call();
    if (tx && tx.memo_type === 'hash') {
       const memHex = Buffer.from(tx.memo, 'base64').toString('hex');
       return { success: true, txId: tx.id, hashHex: memHex, timestamp: tx.created_at };
    }
    return { success: false, reason: "TxID contains no hash memo anchor." };
  } catch(e) { return { success: false }; }
}

module.exports = {
  computeHash,
  registerHashOnBlockchain,
  verifyHashOnBlockchain,
  searchHashInAccount,
  verifyTxId
};
