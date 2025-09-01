// This script demonstrates how to sign a transaction using the Safe Protocol Kit.
// Please replace the placeholder values with your actual data.

// You need to install the following packages:
// npm install @safe-global/protocol-kit ethers dotenv

import 'dotenv/config'
import { ProtocolKit } from '@safe-global/protocol-kit'
import { ethers } from 'ethers'

// Load environment variables
const RPC_URL = process.env.RPC_URL;
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
const SAFE_ADDRESS = process.env.SAFE_ADDRESS;

if (!RPC_URL || !OWNER_PRIVATE_KEY || !SAFE_ADDRESS) {
  throw new Error("Please make sure you have a .env file with RPC_URL, OWNER_PRIVATE_KEY, and SAFE_ADDRESS variables.");
}

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);

async function main() {
  // Create a ProtocolKit instance
  const protocolKit = await ProtocolKit.create({
    ethAdapter: new ethers.adapters.EthersAdapter({
      ethers,
      signerOrProvider: wallet
    }),
    safeAddress: SAFE_ADDRESS
  });

  // Create a transaction object
  const safeTransactionData = {
    to: '0x6E1c4a442E9B9ddA59382ee78058650F1723E0F6',
    data: '0x',
    value: '10000000000000000', // 0.01 ETH
    operation: 0, // CALL
  };

  // Create a new transaction object
  let transaction = await protocolKit.createTransaction({
    transactions: [safeTransactionData]
  });

  // Sign the transaction
  const signedTransaction = await protocolKit.signTransaction(
    transaction
  );

  console.log('Signed Transaction:', signedTransaction);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});