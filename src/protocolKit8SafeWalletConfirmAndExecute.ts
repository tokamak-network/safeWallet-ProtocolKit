// This script demonstrates how to sign a transaction using the Safe Protocol Kit.
// Please replace the placeholder values with your actual data.

// You need to install the following packages:
// npm install @safe-global/protocol-kit ethers dotenv

import 'dotenv/config'
import Safe, {
    buildContractSignature,
    buildSignatureBytes,
} from '@safe-global/protocol-kit'
import { SigningMethod, SafeSignature } from '@safe-global/types-kit';
import SafeApiKit from '@safe-global/api-kit'
import type { Hex } from "viem"
import { createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from 'viem/chains';

// Load environment variables
const RPC_URL = process.env.RPC_URL;
const SAFE_API_KEY = process.env.SAFE_API_KEY;
const CHILD_SIGNER1_PRIVATE_KEY = process.env.SAFE_SIGNER1_PRIVATE_KEY;
const CHILD_SIGNER3_PRIVATE_KEY = process.env.SAFE_SIGNER3_PRIVATE_KEY;
const PARENT_ADDRESS = process.env.PARENT_SAFE_ADDRESS;
const CHILD_ADDRESS = process.env.CHILD_SAFE_ADDRESS;

async function main(): Promise<void> {
    console.log("PARENT_ADDRESS : ", PARENT_ADDRESS)
    console.log("CHILD_ADDRESS : ", CHILD_ADDRESS)

    const safeTransactionData = {
        "to": "0x6E1c4a442E9B9ddA59382ee78058650F1723E0F6",
        "data": "0x",
        "value": "10000000000000000",
        "operation": 0,
        "baseGas": "0",
        "gasPrice": "0",
        "gasToken": "0x0000000000000000000000000000000000000000",
        "nonce": 4,
        "refundReceiver": "0x0000000000000000000000000000000000000000",
        "safeTxGas": "0"
    }

    const apiKit = new SafeApiKit({
        chainId: 11155111n,
        apiKey: SAFE_API_KEY
    });

    let protocolKit = await Safe.init({
        provider: RPC_URL!,
        safeAddress: PARENT_ADDRESS!,
    })


    let safeTx = await protocolKit.createTransaction({
        transactions: [
            safeTransactionData
        ],
    })

    let multiSigSigns = await protocolKit
      .connect({
        signer: CHILD_SIGNER1_PRIVATE_KEY,
        safeAddress: CHILD_ADDRESS,
      })
      .then((k) =>
        k.signTransaction(
          safeTx,
          SigningMethod.SAFE_SIGNATURE,
          PARENT_ADDRESS
        )
      )
    
    multiSigSigns = await protocolKit
      .connect({
        signer: CHILD_SIGNER3_PRIVATE_KEY,
        safeAddress: CHILD_ADDRESS,
      })
      .then((k) =>
        k.signTransaction(
          multiSigSigns,
          SigningMethod.SAFE_SIGNATURE,
          PARENT_ADDRESS
        )
      )
      console.log("multiSigSigns2", multiSigSigns)

    const contractSignature = await buildContractSignature(
        Array.from(multiSigSigns.signatures.values()),
        CHILD_ADDRESS!
    )

    safeTx.addSignature(contractSignature)

    const pendingTxs = await apiKit.getPendingTransactions(
        PARENT_ADDRESS!
    )

    const transaction = await apiKit.getTransaction(
        pendingTxs.results[0].safeTxHash
    )

    const orginSign = await protocolKit
      .toSafeTransactionType(transaction)
      .then((safeTx) => Array.from(safeTx.signatures.values())[0])

    // console.log("orginSign", orginSign)

    const safeTxHash = await protocolKit.getTransactionHash(safeTx)
    console.log("safeTxHash", safeTxHash)
    console.log("contractSignature", buildSignatureBytes([
      safeTx.getSignature(CHILD_ADDRESS!) as SafeSignature,
    ]))

    let signature = buildSignatureBytes([
      orginSign,
      safeTx.getSignature(CHILD_ADDRESS!) as SafeSignature,
    ])
    console.log("signature", signature)
    console.log("signature.length", signature.length)


    const signatureResponse = await apiKit.confirmTransaction(
      safeTxHash,
      buildSignatureBytes([
        orginSign,
        safeTx.getSignature(CHILD_ADDRESS!) as SafeSignature,
      ])
    )

    // console.log("signatureResponse", signatureResponse)
    
    // const safeTransaction = await protocolKit.toSafeTransactionType(transaction)
    // safeTransaction.encodedSignatures = () => {
    //   return signatureResponse.signature
    // }
    // const data = await protocolKit.getEncodedTransaction(safeTransaction)
    // console.log("data", data)

    // const account = privateKeyToAccount(process.env.EXECUTE_PRIVATE_KEY as Hex)
    // const client = createWalletClient({
    //   account,
    //   chain: sepolia,
    //   transport: http("https://eth-sepolia.api.onfinality.io/public"),
    // })

    // console.log("sepolia", sepolia)

    // const hash = await client.sendTransaction({
    //   to: PARENT_ADDRESS as `0x${string}`,
    //   data: data as Hex,
    // })
    // console.log(hash)
    
}



main().catch((error) => {
    console.error(error);
    process.exit(1);
});