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

    const safeAccountConfig: SafeAccountConfig = {
        owners: ['0x1a51Fe6968f9517Db75e080e0436081C80c13291', '0x55E324C36799bD4CfBf515f9013E2E899EaD8B7f', '0x195c1D13fC588C0b1Ca8A78dd5771E0eE5A2EAe4'],
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

    // 3. Safe 트랜잭션 데이터 생성
    const safeTransactionData = {
        "to": "0xf0B595d10a92A5a9BC3fFeA7e79f5d266b6035Ea",
        "data": "0x",
        "value": "100000000000000000",
        "operation": 0,
        "baseGas": "0",
        "gasPrice": "0",
        "gasToken": "0x0000000000000000000000000000000000000000",
        "nonce": 2,
        "refundReceiver": "0x0000000000000000000000000000000000000000",
        "safeTxGas": "0"
      }

    let transactionSafe2_3 = await protocolKit.createTransaction({
        transactions: [safeTransactionData]
    })

    // Connect OWNER_4_ADDRESS(MultiSigWallet의 Owner) and the address of SAFE_2_3_ADDRESS(MultiSigWallet)
    // let protocolKit2_3 = await Safe.init({
    protocolKit = await protocolKit.connect({
        provider: RPC_URL!,
        signer: CHILD_SIGNER1_PRIVATE_KEY!,
        safeAddress: CHILD_ADDRESS!
    })


    // Sign the transactionSafe2_3 with OWNER_4_ADDRESS
    // After this, the transactionSafe2_3 contains the signature from OWNER_4_ADDRESS
    // Parent Safe Address => SafeWalletAddress
    // SAFE_ADDRESS is SAFE_3_4_ADDRESS
    transactionSafe2_3 = await protocolKit.signTransaction(
        transactionSafe2_3,
        SigningMethod.SAFE_SIGNATURE,
        PARENT_ADDRESS // Parent Safe address
    )
    
    // Connect OWNER_5_ADDRESS(MultiSigWallet의 Owner2)
    protocolKit = await protocolKit.connect({
        provider: RPC_URL,
        signer: CHILD_SIGNER3_PRIVATE_KEY
    })
  
    // Sign the transactionSafe2_3 with OWNER_5_ADDRESS
    // After this, the transactionSafe2_3 contains the signature from OWNER_5_ADDRESS
    // SAFE_ADDRESS is SAFE_3_4_ADDRESS
    transactionSafe2_3 = await protocolKit.signTransaction(
        transactionSafe2_3,
        SigningMethod.SAFE_SIGNATURE,
        PARENT_ADDRESS // Parent Safe address
    )

    // Build the contract signature of SAFE_2_3_ADDRESS
    const signatureSafe2_3 = await buildContractSignature(
        Array.from(transactionSafe2_3.signatures.values()),
        CHILD_ADDRESS!
    )
    // console.log("signatureSafe2_3 : ", signatureSafe2_3);
  
    // Add the signatureSafe2_3 to safeTransaction
    // After this, the safeTransaction contains the signature from OWNER_1_ADDRESS, OWNER_2_ADDRESS, SAFE_1_1_ADDRESS and SAFE_2_3_ADDRESS
    transactionSafe2_3.addSignature(signatureSafe2_3)

    const safeTransactionHash = await protocolKit.getTransactionHash(transactionSafe2_3)
    const signature = await protocolKit.signHash(safeTransactionHash)
    
    const signerSafeSig2_3 = transactionSafe2_3.getSignature(CHILD_ADDRESS!) as EthSafeSignature

    const apiKit = new SafeApiKit({
        chainId: 11155111n,
        apiKey: SAFE_API_KEY
    });
    const safeTxHash = "0xbcdaae91b50b094b5933b08a522b51e5c170a57ab26f418b292591f2c8ba9168"
    // // Get the transactions
    // const signedTransaction = await apiKit.getTransaction(safeTransactionHash)
    // console.log("signedTransaction :", signedTransaction)


    // API 사용하지 않고 로컬에서만 처리
    console.log('Transaction hash:', safeTransactionHash);
    console.log('Signatures:', transactionSafe2_3.signatures);
    console.log('signerSafeSig2_3:', signerSafeSig2_3);
    console.log('Transaction ready for execution');

    await apiKit.confirmTransaction(
        safeTxHash,
        buildSignatureBytes([signerSafeSig2_3])
    )
    // await apiKit.confirmTransaction(
    //     safeTransactionHash,
    //     signature.data
    // )
  

    // ------------------------------------------------------

    // // Connect OWNER_4_ADDRESS and the address of SAFE_2_3_ADDRESS
    // protocolKit = await protocolKit.connect({
    //     provider: RPC_URL,
    //     signer: OWNER_PRIVATE_KEY,
    //     safeAddress: MULTISIG_ADDRESS
    // })
    
    // // Sign the transactionSafe2_3 with OWNER_4_ADDRESS
    // // After this, the transactionSafe2_3 contains the signature from OWNER_4_ADDRESS
    // safeTransaction = await protocolKit.signTransaction(
    //     safeTransaction,
    //     SigningMethod.SAFE_SIGNATURE,
    //     SAFE_ADDRESS // Parent Safe address
    // )

    // // Connect OWNER_5_ADDRESS
    // protocolKit = await protocolKit.connect({
    //     provider: RPC_URL,
    //     signer: OWNER_PRIVATE_KEY2
    // })
    
    // // Sign the transactionSafe2_3 with OWNER_5_ADDRESS
    // // After this, the transactionSafe2_3 contains the signature from OWNER_5_ADDRESS
    // safeTransaction = await protocolKit.signTransaction(
    //     safeTransaction,
    //     SigningMethod.SAFE_SIGNATURE,
    //     SAFE_ADDRESS // Parent Safe address
    // )
    
    // // Build the contract signature of SAFE_2_3_ADDRESS
    // const signatureSafe2_3 = await buildContractSignature(
    //     Array.from(safeTransaction.signatures.values()),
    //     MULTISIG_ADDRESS!
    // )
    // console.log("signatureSafe2_3:", signatureSafe2_3)
    
    // // Add the signatureSafe2_3 to safeTransaction
    // // After this, the safeTransaction contains the signature from OWNER_1_ADDRESS, OWNER_2_ADDRESS, SAFE_1_1_ADDRESS and SAFE_2_3_ADDRESS
    // safeTransaction.addSignature(signatureSafe2_3)

    // const safeTransactionHash = await protocolKit.getTransactionHash(safeTransaction)


    // const apiKit = new SafeApiKit({
    //     chainId: 11155111n,
    //     apiKey: SAFE_API_KEY
    // });

    // // Confirm the transaction from OWNER_2_ADDRESS
    // await apiKit.confirmTransaction(
    //     safeTransactionHash,
    //     buildSignatureBytes([signatureSafe2_3!])
    //  )
    
}



main().catch((error) => {
    console.error(error);
    process.exit(1);
});