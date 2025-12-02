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
const SAFE_ADDRESS = "0x873085A671aCCd68338AE41630BD056Acd4797eE";
const DAO_ADDRESS = "0xA2101482b28E3D99ff6ced517bA41EFf4971a386";
const SAFE_API_KEY = process.env.SAFE_API_KEY;


async function main(): Promise<void> {
    let safeTransactionData = {
        "to": "0xf0B595d10a92A5a9BC3fFeA7e79f5d266b6035Ea",
        "data": "0x",
        "value": "100000000000",
        "operation": 0,
        "baseGas": "0",
        "gasPrice": "0",
        "gasToken": "0x0000000000000000000000000000000000000000",
        "nonce": 0,
        "refundReceiver": "0x0000000000000000000000000000000000000000",
        "safeTxGas": "0"
    }

    const apiKit = new SafeApiKit({
        chainId: 11155111n,
        apiKey: SAFE_API_KEY,
    })

    let protocolKit = await Safe.init({
        provider: RPC_URL!,
        safeAddress: SAFE_ADDRESS,
    })

    const chainId = await protocolKit.getChainId()
    console.log('체인 ID:', chainId)

    let safeVersion = await protocolKit.getContractVersion()
    console.log("safeVersion", safeVersion)

    let safeTx = await protocolKit.createTransaction({
        transactions: [
            safeTransactionData
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
        SAFE_ADDRESS,
        safeTx.data as SafeTransactionData,
        safeVersion,
        chainId
    )

    console.log("txHashData", txHashData)

    let safeTxHash = await protocolKit.getTransactionHash(safeTx)
    console.log("safeTxHash : ", safeTxHash)

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
        DAO_ADDRESS
    )

    // console.log("contractSignature :", contractSignature)
    safeTx.addSignature(contractSignature)

    const transaction = await apiKit.getTransaction(
        safeTxHash
    )

    const orginSign = await protocolKit
        .toSafeTransactionType(transaction)
        .then((safeTx) => Array.from(safeTx.signatures.values())[0])

    // console.log("orginSign :", orginSign)
    // console.log("orginSign.length :", orginSign.data.length)

    const orginSign2 = await protocolKit
        .toSafeTransactionType(transaction)
        .then((safeTx) => Array.from(safeTx.signatures.values())[1])
    // console.log("orginSign2 :", orginSign2)
    // console.log("orginSign2.length :", orginSign2.data.length)

    // const signature = buildSignatureBytes([
    //     orginSign,
    //     orginSign2,
    //     safeTx.getSignature(DAO_ADDRESS!) as SafeSignature,
    // ])
    // console.log("signature : ", signature)

    const signatureResponse = await apiKit.confirmTransaction(
        safeTxHash,
        buildSignatureBytes([
            orginSign,
            orginSign2,
            safeTx.getSignature(DAO_ADDRESS!) as SafeSignature,
        ])
    )
    console.log("signatureResponse :", signatureResponse)

    const safeTransaction = await protocolKit.toSafeTransactionType(transaction)
    safeTransaction.encodedSignatures = () => {
        return signatureResponse.signature
    }
    console.log("safeTransaction :", safeTransaction)

    const data = await protocolKit.getEncodedTransaction(safeTransaction)

    console.log("data :", data)

    const account = privateKeyToAccount(process.env.SAFE_WALLET_OWNERKEY as Hex)
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