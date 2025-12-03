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
const SAFE_ADDRESS = "0xbae2Dd3e3B03952C4a6793da7fCE035418d8241F";
const DAO_ADDRESS = "0xA2101482b28E3D99ff6ced517bA41EFf4971a386";
const SAFE_API_KEY = process.env.SAFE_API_KEY;


async function main(): Promise<void> {

    let safeTransactionData = {
        "to": "0xab59cCb04588C95CEa44206868f90a943BcD1e0c",
        "data": "0x7eff275e000000000000000000000000330d4f93b7aef878fe97529896793fab47c1d4df0000000000000000000000007220c734653ae8ca014d4d82a84041ee4169499c",
        "value": "0",
        "operation": 0,
        "baseGas": "0",
        "gasPrice": "0",
        "gasToken": "0x0000000000000000000000000000000000000000",
        "nonce": 19,
        "refundReceiver": "0x0000000000000000000000000000000000000000",
        "safeTxGas": "0"
    }

    const apiKit = new SafeApiKit({
        chainId: 11155111n,
        apiKey: SAFE_API_KEY,
    })

    let protocolKit = await Safe.init({
        provider: RPC_URL!,
        safeAddress: SAFE_ADDRESS!,
    })

    let safeTx = await protocolKit.createTransaction({
        transactions: [
            safeTransactionData
        ],
    })
    console.log("safeTx : ", safeTx)

    const chainId = await protocolKit.getChainId()
    console.log('체인 ID:', chainId)

    let safeVersion = await protocolKit.getContractVersion()
    console.log("safeVersion", safeVersion)

    let safeTxHash = await protocolKit.getTransactionHash(safeTx)
    console.log("safeTxHash : ", safeTxHash)

    let multiSigSigns = await protocolKit
        .connect({
            signer: process.env.OWNER_PRIVATE_KEY,
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

    // console.log("contractSignature :", contractSignature)
    safeTx.addSignature(contractSignature)

    let safeTxHash2 = "0x764e688dc9a5c471ba7a5d07845e630cae726aa1f2a563d220da634dab1f4e6f"
    const transaction = await apiKit.getTransaction(
        safeTxHash2
    )

    const orginSign = await protocolKit
        .toSafeTransactionType(transaction)
        .then((safeTx) => Array.from(safeTx.signatures.values())[0])

    console.log("orginSign :", orginSign)
    // console.log("orginSign.length :", orginSign.data.length)

    const orginSign2 = await protocolKit
        .toSafeTransactionType(transaction)
        .then((safeTx) => Array.from(safeTx.signatures.values())[1])
    console.log("orginSign2 :", orginSign2)
    // console.log("orginSign2.length :", orginSign2.data.length)

    const orginSign3 = await protocolKit
        .toSafeTransactionType(transaction)
        .then((safeTx) => Array.from(safeTx.signatures.values())[2])
    console.log("orginSign3 :", orginSign3)

    const signature = buildSignatureBytes([
        orginSign,
        orginSign3,
        safeTx.getSignature(DAO_ADDRESS!) as SafeSignature,
    ])
    // console.log("signature : ", signature)

    const signatureResponse = await apiKit.confirmTransaction(
        safeTxHash2,
        buildSignatureBytes([
            orginSign,
            orginSign3,
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

    const account = privateKeyToAccount(process.env.TRH_ADMIN_PRIVATE_KEY2 as Hex)
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