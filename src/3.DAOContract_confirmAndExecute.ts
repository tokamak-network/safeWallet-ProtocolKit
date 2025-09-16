import 'dotenv/config'

import SafeApiKit from "@safe-global/api-kit"
import Safe, {
  buildContractSignature,
  buildSignatureBytes,
  preimageSafeTransactionHash
} from "@safe-global/protocol-kit"
import {
  OperationType,
  SafeSignature,
  SigningMethod,
  SafeTransactionData
} from "@safe-global/types-kit"
import type { Hex } from "viem"
import { createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"


const RPC_URL = process.env.RPC_URL;
const MULTISIG_OWNER_KEY = process.env.OWNER_PRIVATE_KEY;
const MULTISIG_OWNER_KEY2 = process.env.OWNER_PRIVATE_KEY2;
const ADMIN_KEY = process.env.TRH_ADMIN_PRIVATE_KEY;
const FOUNDATION_KEY = process.env.TRH_ADMIN_PRIVATE_KEY2;
const SAFE_ADDRESS = process.env.SAFE_ADDRESS;
const DAO_ADDRESS = process.env.DAO_ADDRESS;
const SAFE_API_KEY = process.env.SAFE_API_KEY;


async function main(): Promise<void> {
    const apiKit = new SafeApiKit({
        chainId: 11155111n,
        apiKey: SAFE_API_KEY,
    })

    let protocolKit = await Safe.init({
        provider: "https://eth-sepolia.public.blastapi.io",
        safeAddress: SAFE_ADDRESS!,
    })

    const chainId = await protocolKit.getChainId()
    console.log('체인 ID:', chainId)

    let safeVersion = await protocolKit.getContractVersion()
    console.log("safeVersion", safeVersion)

    let safeTx = await protocolKit.createTransaction({
        transactions: [
          {
            to: "0xf0B595d10a92A5a9BC3fFeA7e79f5d266b6035Ea",
            value: "1000000000000000",
            data: "0x",
            operation: OperationType.Call,
          },
        ],
    })

    let multiSigSigns = await protocolKit
        .connect({
            signer: process.env.OWNER_PRIVATE_KEY as Hex,
            safeAddress: DAO_ADDRESS,
        })
        .then((k) =>
            k.signTransaction(
                safeTx,
                SigningMethod.SAFE_SIGNATURE,
                SAFE_ADDRESS
            )
        )

    const txHashData = preimageSafeTransactionHash(
        SAFE_ADDRESS!,
        safeTx.data as SafeTransactionData,
        safeVersion,
        chainId
    )

    console.log("txHashData", txHashData)

    const messageHash = await protocolKit.getSafeMessageHash(txHashData)
    console.log("messageHash", messageHash)

    let txHash = await protocolKit.getTransactionHash(safeTx)
    console.log("txHash : ", txHash)

    multiSigSigns = await protocolKit
    .connect({
        signer: process.env.OWNER_PRIVATE_KEY2 as Hex,
        safeAddress: DAO_ADDRESS,
    })
    .then((k) =>
        k.signTransaction(
            multiSigSigns,
            SigningMethod.SAFE_SIGNATURE,
            SAFE_ADDRESS
        )
    )

    const contractSignature = await buildContractSignature(
        Array.from(multiSigSigns.signatures.values()),
        DAO_ADDRESS!
    )
    console.log("contractSignature :", contractSignature)
    safeTx.addSignature(contractSignature)

    const pendingTxs = await apiKit.getPendingTransactions(
        SAFE_ADDRESS!
    )

    const transaction = await apiKit.getTransaction(
        pendingTxs.results[0].safeTxHash
    )

    const orginSign = await protocolKit
        .toSafeTransactionType(transaction)
        .then((safeTx) => Array.from(safeTx.signatures.values())[0])
    
    // const orginSign2 = await protocolKit
    //     .toSafeTransactionType(transaction)
    //     .then((safeTx) => Array.from(safeTx.signatures.values())[0])

    const safeTxHash = await protocolKit.getTransactionHash(safeTx)

    const signature = buildSignatureBytes([
        orginSign,
        safeTx.getSignature(DAO_ADDRESS!) as SafeSignature,
    ])
    console.log("signature : ", signature)
    console.log("1");
    
    const signatureResponse = await apiKit.confirmTransaction(
        safeTxHash,
        buildSignatureBytes([
            orginSign,
            safeTx.getSignature(DAO_ADDRESS!) as SafeSignature,
        ])
    )
    console.log("2");
    // const safeTransaction = await protocolKit.toSafeTransactionType(transaction)
    //     safeTransaction.encodedSignatures = () => {
    //     return signatureResponse.signature
    // }
    // const data = await protocolKit.getEncodedTransaction(safeTransaction)

    // const account = privateKeyToAccount(process.env.TRH_ADMIN_PRIVATE_KEY as Hex)
    // const client = createWalletClient({
    //     account,
    //     chain: sepolia,
    //     transport: http("https://eth-sepolia.api.onfinality.io/public"),
    // })

    // const hash = await client.sendTransaction({
    //     to: SAFE_ADDRESS as `0x${string}`,
    //     data: data as Hex,
    // })
    // console.log(hash)

}







main().catch((error) => {
    console.error(error);
    process.exit(1);
});