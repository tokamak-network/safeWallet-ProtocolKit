// This script demonstrates how to sign a transaction using the Safe Protocol Kit.
// Please replace the placeholder values with your actual data.

// You need to install the following packages:
// npm install @safe-global/protocol-kit ethers dotenv

import 'dotenv/config'
import Safe, {
    PredictedSafeProps,
    SafeAccountConfig,
    buildContractSignature,
    buildSignatureBytes
} from '@safe-global/protocol-kit'
import { SigningMethod } from '@safe-global/types-kit';
import SafeApiKit from '@safe-global/api-kit'
import { ethers } from 'ethers'

// Load environment variables
const RPC_URL = process.env.RPC_URL;
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
const OWNER_PRIVATE_KEY2 = process.env.OWNER_PRIVATE_KEY2;
const SAFE_ADDRESS = process.env.SAFE_ADDRESS;
const DAO_ADDRESS = process.env.DAO_ADDRESS;
const MULTISIG_ADDRESS = process.env.MULTISIG_ADDRESS;
const SAFE_API_KEY = process.env.SAFE_API_KEY;

if (!RPC_URL || !OWNER_PRIVATE_KEY || !OWNER_PRIVATE_KEY2 || !SAFE_ADDRESS || !DAO_ADDRESS) {
    throw new Error("Please make sure you have a .env file with RPC_URL, OWNER_PRIVATE_KEY, and SAFE_ADDRESS variables.");
}

// const provider = new ethers.JsonRpcProvider(RPC_URL);
// const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);

async function main(): Promise<void> {
    const safeAccountConfig: SafeAccountConfig = {
        owners: ['0xA2101482b28E3D99ff6ced517bA41EFf4971a386', '0x6E1c4a442E9B9ddA59382ee78058650F1723E0F6', '0x3bFda92Fa3bC0AB080Cac3775147B6318b1C5115'],
        threshold: 2
        // More optional properties
    }

    const predictedSafe: PredictedSafeProps = {
        safeAccountConfig
        // More optional properties
    }

    let protocolKit = await Safe.init({
        provider: RPC_URL!,
        signer: OWNER_PRIVATE_KEY!,
        predictedSafe
    })

    // 2. 메인 Safe 인스턴스 생성 (DAOContract가 소유자인 Safe)
    const mainSafeKit = await Safe.init({
        provider: RPC_URL!,
        signer: OWNER_PRIVATE_KEY!,
        safeAddress: SAFE_ADDRESS!
    });


    // 3. Safe 트랜잭션 데이터 생성
    const safeTransactionData = {
        "to": "0xf0B595d10a92A5a9BC3fFeA7e79f5d266b6035Ea",
        "data": "0x",
        "value": "20000000000000000",
        "operation": 0,
        "baseGas": "0",
        "gasPrice": "0",
        "gasToken": "0x0000000000000000000000000000000000000000",
        "nonce": 0,
        "refundReceiver": "0x0000000000000000000000000000000000000000",
        "safeTxGas": "0"
    }

    const safeTransaction = await mainSafeKit.createTransaction({
        transactions: [safeTransactionData]
    });

    // 4. Safe 트랜잭션 해시 생성
    // 트랜잭션 해시 생성
    const txHash = await mainSafeKit.getTransactionHash(safeTransaction);
    console.log("Safe Transaction Hash:", txHash);

    
}

async function createSignature(signer: SignerWithAddress, hash: string): Promise<string> {
    // Sign the raw hash bytes directly (not as a message)
    const hashBytes = ethers.utils.arrayify(hash);
    const flatSig = await signer.signMessage(hashBytes);
    return flatSig;
  }

  async function createMultipleSignatures(
    signers: SignerWithAddress[],
    hash: string
  ): Promise<string> {
    const signatures = await Promise.all(
      signers.map(signer => createSignature(signer, hash))
    );
    return ethers.utils.hexConcat(signatures);
  }

main().catch((error) => {
    console.error(error);
    process.exit(1);
});