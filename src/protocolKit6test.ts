// This script demonstrates how to sign a transaction using the Safe Protocol Kit.
// Please replace the placeholder values with your actual data.

// You need to install the following packages:
// npm install @safe-global/protocol-kit ethers dotenv

import 'dotenv/config'
import Safe, {
    EthSafeSignature,
    PredictedSafeProps,
    SafeAccountConfig,
    buildContractSignature,
    buildSignatureBytes,
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
const CHILD_SIGNER1_PRIVATE_KEY = process.env.SAFE_SIGNER1_PRIVATE_KEY;
const CHILD_SIGNER3_PRIVATE_KEY = process.env.SAFE_SIGNER3_PRIVATE_KEY;
const PARENT_ADDRESS = process.env.PARENT_SAFE_ADDRESS;
const CHILD_ADDRESS = process.env.CHILD_SAFE_ADDRESS;

if (!RPC_URL || !OWNER_PRIVATE_KEY || !OWNER_PRIVATE_KEY2 || !SAFE_ADDRESS || !DAO_ADDRESS) {
    throw new Error("Please make sure you have a .env file with RPC_URL, OWNER_PRIVATE_KEY, and SAFE_ADDRESS variables.");
}

// const provider = new ethers.JsonRpcProvider(RPC_URL);
// const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);

async function main(): Promise<void> {
    const STRING_MESSAGE = "I'm the owner of this Safe account"

    const OWNER_ADDRESS = "0x6E1c4a442E9B9ddA59382ee78058650F1723E0F6"

    let protocolKit = await Safe.init({
        provider: RPC_URL!,
        signer: OWNER_PRIVATE_KEY!,
        safeAddress: DAO_ADDRESS!
    })

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

    let transactionSafe2_3 = await protocolKit.createTransaction({
        transactions: [safeTransactionData]
    })

    // Connect OWNER_4_ADDRESS(MultiSigWallet의 Owner) and the address of SAFE_2_3_ADDRESS(MultiSigWallet)
    // let protocolKit2_3 = await Safe.init({
    let multiSigSigns = await protocolKit.connect({
        provider: RPC_URL!,
        signer: OWNER_PRIVATE_KEY!,
        safeAddress: DAO_ADDRESS!
    }).then((k) =>
        k.signTransaction(transactionSafe2_3, SigningMethod.SAFE_SIGNATURE, SAFE_ADDRESS)
    )

    multiSigSigns = await protocolKit
    .connect({
        provider: RPC_URL!,
        signer: OWNER_PRIVATE_KEY2!,
        safeAddress: DAO_ADDRESS!
    })
    .then((k) =>
        k.signTransaction(transactionSafe2_3, SigningMethod.SAFE_SIGNATURE, SAFE_ADDRESS)
    )


    // transactionSafe2_3 = await protocolKit
    //     .connect({
    //         provider: RPC_URL,
    //         signer: CHILD_SIGNER1_PRIVATE_KEY,
    //     })
    //     .then(async (k) => {
    //         return k.signTransaction(transactionSafe2_3, SigningMethod.ETH_SIGN)
    //     })

    // console.log("transactionSafe2_3 :", transactionSafe2_3)

    // const contractSignature = await buildContractSignature(
    //     Array.from(transactionSafe2_3.signatures.values()),
    //     DAO_ADDRESS!
    // )
    const contractSignature = await buildContractSignature(
        Array.from(multiSigSigns.signatures.values()),
        DAO_ADDRESS!
    )
    console.log("contractSignature :", contractSignature)
  
    // Add the signatureSafe2_3 to safeTransaction
    // After this, the safeTransaction contains the signature from OWNER_1_ADDRESS, OWNER_2_ADDRESS, SAFE_1_1_ADDRESS and SAFE_2_3_ADDRESS
    transactionSafe2_3.addSignature(contractSignature)
    console.log(transactionSafe2_3)

    const safeTransactionHash = await protocolKit.getTransactionHash(transactionSafe2_3)
    // console.log("safeTransactionHash :", safeTransactionHash)
    
    const signerSafeSig2_3 = transactionSafe2_3.getSignature(DAO_ADDRESS!) as EthSafeSignature
    // console.log("signerSafeSig2_3 :", signerSafeSig2_3)

    const apiKit = new SafeApiKit({
        chainId: 11155111n,
        apiKey: SAFE_API_KEY
    });

    const safeTxHash = "0x34148392eddee2686a39b6da312a95afdbf953bef85122e5b0c73f3b624cba8f"
    console.log('Transaction ready for confirm');

    await apiKit.confirmTransaction(
        safeTxHash,
        buildSignatureBytes([signerSafeSig2_3])
    )

    // const tx = await protocolKit.executeTransaction(transactionSafe2_3)
    // console.log(tx)
}



main().catch((error) => {
    console.error(error);
    process.exit(1);
});