// This script demonstrates how to sign a transaction using the Safe Protocol Kit.
// Please replace the placeholder values with your actual data.

// You need to install the following packages:
// npm install @safe-global/protocol-kit ethers dotenv

import 'dotenv/config'
import Safe, {
    buildContractSignature,
    buildSignatureBytes,
    preimageSafeTransactionHash
} from '@safe-global/protocol-kit'
import {
    OperationType,
    SafeSignature,
    SigningMethod,
    SafeTransactionData
  } from "@safe-global/types-kit"
import SafeApiKit from '@safe-global/api-kit'
import type { Hex } from "viem"
import { createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"

// Load environment variables
const RPC_URL = process.env.RPC_URL;
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
const OWNER_PRIVATE_KEY2 = process.env.OWNER_PRIVATE_KEY2;
const SAFE_ADDRESS = process.env.SAFE_ADDRESS;
const DAO_ADDRESS = process.env.DAO_ADDRESS;
const SAFE_API_KEY = process.env.SAFE_API_KEY;

async function main(): Promise<void> {
    // 3. Safe 트랜잭션 데이터 생성
    const safeTransactionData = {
      "to": "0xf0B595d10a92A5a9BC3fFeA7e79f5d266b6035Ea",
      "data": "0x",
      "value": "1000000000000000",
      "operation": 0,
      "baseGas": "0",
      "gasPrice": "0",
      "gasToken": "0x0000000000000000000000000000000000000000",
      "nonce": 5,
      "refundReceiver": "0x0000000000000000000000000000000000000000",
      "safeTxGas": "0"
    }

    const apiKit = new SafeApiKit({
      chainId: 11155111n,
      apiKey: SAFE_API_KEY
    });

    let protocolKit = await Safe.init({
      provider: RPC_URL!,
      safeAddress: SAFE_ADDRESS!,
    })
    
    // console.log("protocolKit1", protocolKit)

    let safeTx = await protocolKit.createTransaction({
      transactions: [
          safeTransactionData
      ],
    })

    let protocolKit2 = await protocolKit.connect({
      signer: process.env.OWNER_PRIVATE_KEY,
      safeAddress: DAO_ADDRESS,
    })

    let chainId = await protocolKit2.getChainId()
    console.log('체인 ID:', chainId)

    let safeVersion = await protocolKit2.getContractVersion()
    console.log("safeVersion", safeVersion)

    const txHashData = preimageSafeTransactionHash(
      SAFE_ADDRESS!,
      safeTx.data as SafeTransactionData,
      safeVersion,
      chainId
    )

    console.log("txHashData", txHashData)

    // console.log("safeTx1", safeTx)

    // console.log(SigningMethod)

    let multiSigSigns = await protocolKit
      .connect({
        signer: OWNER_PRIVATE_KEY,
        safeAddress: DAO_ADDRESS,
      })
      .then((k) =>
        k.signTransaction(
          safeTx,
          SigningMethod.SAFE_SIGNATURE,
          SAFE_ADDRESS
        )
      )
    // console.log("multiSigSigns1", multiSigSigns)

    multiSigSigns = await protocolKit
      .connect({
        signer: OWNER_PRIVATE_KEY2,
        safeAddress: DAO_ADDRESS,
      })
      .then((k) =>
        k.signTransaction(
          multiSigSigns,
          SigningMethod.SAFE_SIGNATURE,
          SAFE_ADDRESS
        )
      )
      // console.log("multiSigSigns2", multiSigSigns)
    
    const contractSignature = await buildContractSignature(
      Array.from(multiSigSigns.signatures.values()),
      DAO_ADDRESS!
    )
    // console.log("contractSignature", contractSignature)
    // const contractSig = buildSignatureBytes([contractSignature])
    
    safeTx.addSignature(contractSignature)
    // console.log("safeTx2", safeTx)
    
    const pendingTxs = await apiKit.getPendingTransactions(
      SAFE_ADDRESS!
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

    // const beforeTx = await apiKit.getTransaction(safeTxHash)
    // console.log("beforeTx", beforeTx)

    let sumSignature = buildSignatureBytes([
      orginSign,
      safeTx.getSignature(DAO_ADDRESS!) as SafeSignature,
    ])
    console.log("sumSignature", sumSignature)
    console.log("sumSignature.length", sumSignature.length)

    

    let makeSignature = "0x000000000000000000000000A2101482b28E3D99ff6ced517bA41EFf4971a386000000000000000000000000000000000000000000000000000000000000008200c5eca5424f426c2e4817cae6fd86ae57c97d757ee49e609c669065edf9dee6e75b4a2e842d67284b50f4b3024264eb70b38145c31528c8d330d92bad4409aea71b00000000000000000000000000000000000000000000000000000000000000827c884a93d367f70eed1edc95ee6b9e0b96fe7f4caf03b7a190e7786aab63be2d302a5d3b534277789465c7b917ba4206ea6c6a5f21e6487c17c2aa118dd6bc2a209e77e9dd73703da05391e6d303891802c4ae677f8e3582d2d27de52391b0bac11d81497fcf36d63b42fcab38cd7d8712aebda9f663f4b21b6f409316b4bf323b1f"


    const signatureResponse = await apiKit.confirmTransaction(
      safeTxHash,
      sumSignature
    )
    // const signatureResponse = await apiKit.confirmTransaction(
    //   safeTxHash,
    //   contractSig
    // )
    console.log("signatureResponse", signatureResponse)

    const safeTransaction = await protocolKit.toSafeTransactionType(transaction)
    safeTransaction.encodedSignatures = () => {
      return signatureResponse.signature
    }
    const data = await protocolKit.getEncodedTransaction(safeTransaction)

    const account = privateKeyToAccount(process.env.EXECUTE_PRIVATE_KEY as Hex)
    const client = createWalletClient({
      account,
      chain: sepolia,
      transport: http("https://eth-sepolia.api.onfinality.io/public"),
    })

    const hash = await client.sendTransaction({
      to: SAFE_ADDRESS as `0x${string}`,
      data: data as Hex,
    })
    console.log(hash)

}



main().catch((error) => {
    console.error(error);
    process.exit(1);
});