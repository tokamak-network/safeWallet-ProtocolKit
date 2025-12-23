import 'dotenv/config'

import SafeApiKit from "@safe-global/api-kit"
import Safe, {
    buildContractSignature,
    buildSignatureBytes,
    preimageSafeTransactionHash,
    EthSafeSignature
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
const SAFE_ADDRESS = "0x2FA87C9845411cC45Aa47fDA41a2e6b2421a61Bd";
const DAO_ADDRESS = "0xA2101482b28E3D99ff6ced517bA41EFf4971a386";
const SAFE_API_KEY = process.env.SAFE_API_KEY;


async function main(): Promise<void> {
    let safeTransactionData = {
        "to": "0x1Db4C4a6cb1C86f6D266A9D4D520da5E0ADD2668",
        "data": "0x7eff275e000000000000000000000000277a690e99c4197d07c29ed57090441dcb384b300000000000000000000000007220c734653ae8ca014d4d82a84041ee4169499c",
        "value": "0",
        "operation": 0,
        "baseGas": "0",
        "gasPrice": "0",
        "gasToken": "0x0000000000000000000000000000000000000000",
        "nonce": 19,
        "refundReceiver": "0x0000000000000000000000000000000000000000",
        "safeTxGas": "0"
    }

    let txHash = "0x1068a0ed4ccb47014493b58923bdf2794c92599df99fff7f5bac56285a4be2a2"


    // const rawData = {
    //     "signer": "0x7220c734653ae8Ca014d4D82A84041EE4169499c",
    //     "signature": "0xd11c5c69676709634d486393745320fe59985522eadf55a3dce32ade77a93d910188bd3da2c92d01f172bdb73e014eafb4008cea604c44b424f372db5a5146331c"
    // };

    // const rawData2 = {
    //     "signer": "0xeEfb04f3A4406363b399A1c3d194d75ca81A2d1B",
    //     "signature": "0x582b84d4684f87eacf827e08d8b2ca28465912d01e6a7ec18e896c021155ed5b37f90d585c2ad63f52a6f007f42a9505091863ec445c623fb248f9471e98cfcc1c"
    // }

    // const ethSafeSignature = new EthSafeSignature(rawData.signer, rawData.signature);
    // console.log(ethSafeSignature);

    // const ethSafeSignature2 = new EthSafeSignature(rawData2.signer, rawData2.signature);
    // console.log(ethSafeSignature2);

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
    console.log("get safeTxHash : ", safeTxHash)
    console.log("real safeTxHash : ", txHash)

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
    console.log("contractSignature :", contractSignature)

    // safeTx.addSignature(ethSafeSignature)
    // safeTx.addSignature(ethSafeSignature2)
    safeTx.addSignature(contractSignature)
    // console.log("safeTx :", safeTx)

    // console.log(safeTx.getSignature(DAO_ADDRESS!) as EthSafeSignature)

    // console.log("1")
    const transaction = await apiKit.getTransaction(
        safeTxHash
    )
    // console.log("2")

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

    // const orginSign3 = await protocolKit
    //     .toSafeTransactionType(transaction)
    //     .then((safeTx) => Array.from(safeTx.signatures.values())[2])
    // console.log("orginSign3 :", orginSign3)


    // const signatureBytes = buildSignatureBytes([
    //     ethSafeSignature,
    //     ethSafeSignature2,
    //     safeTx.getSignature(DAO_ADDRESS!) as SafeSignature,
    // ])

    // console.log("signatureBytes :", signatureBytes)

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