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
const SAFE_ADDRESS = "0x24d16804218C2279bf6A4B3cB88e9c929B903409";
const DAO_ADDRESS = "0xA2101482b28E3D99ff6ced517bA41EFf4971a386";
const SAFE_API_KEY = process.env.SAFE_API_KEY;


async function main(): Promise<void> {
    let safeTransactionData = {
        "to": "0x96091688580Bc75E51EeC46Db04560123CD73127",
        "data": "0x7eff275e0000000000000000000000009e5caa79a304c41a0d91418b1005ef9074e989c30000000000000000000000007220c734653ae8ca014d4d82a84041ee4169499c",
        "value": "0",
        "operation": 0,
        "baseGas": "0",
        "gasPrice": "0",
        "gasToken": "0x0000000000000000000000000000000000000000",
        "nonce": 19,
        "refundReceiver": "0x0000000000000000000000000000000000000000",
        "safeTxGas": "0"
    }


    const rawData = {
        "signer": "0x7220c734653ae8Ca014d4D82A84041EE4169499c",
        "signature": "0x405fde30aa47fcb434d1fdfd076157bb99bb6e3011ff2020868d8f4f2f80255e2b0349a35b6a57ded5280427da8cdb24ddbe934c51d58971361ae25e31dfee281c"
    };

    const rawData2 = {
        "signer": "0xeEfb04f3A4406363b399A1c3d194d75ca81A2d1B",
        "signature": "0xc5356b2bc34be1d0e238bee40efba33b0b49a5272513c2a2d184d577c4a912dc51fe3e4d89b830a9f42e566d047f4cc1145c5fa4694646cc0183bd6716682cbf1b"
    }

    const ethSafeSignature = new EthSafeSignature(rawData.signer, rawData.signature);
    console.log(ethSafeSignature);

    const ethSafeSignature2 = new EthSafeSignature(rawData2.signer, rawData2.signature);
    console.log(ethSafeSignature2);

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
    console.log("contractSignature :", contractSignature)

    safeTx.addSignature(ethSafeSignature)
    safeTx.addSignature(ethSafeSignature2)
    safeTx.addSignature(contractSignature)
    console.log("safeTx :", safeTx)

    // console.log(safeTx.getSignature(DAO_ADDRESS!) as EthSafeSignature)

    // const transaction = await apiKit.getTransaction(
    //     safeTxHash
    // )
    // console.log("3")

    // const orginSign = await protocolKit
    //     .toSafeTransactionType(transaction)
    //     .then((safeTx) => Array.from(safeTx.signatures.values())[0])

    // console.log("orginSign :", orginSign)
    // // console.log("orginSign.length :", orginSign.data.length)

    // const orginSign2 = await protocolKit
    //     .toSafeTransactionType(transaction)
    //     .then((safeTx) => Array.from(safeTx.signatures.values())[1])
    // console.log("orginSign2 :", orginSign2)
    // // console.log("orginSign2.length :", orginSign2.data.length)

    // const orginSign3 = await protocolKit
    //     .toSafeTransactionType(transaction)
    //     .then((safeTx) => Array.from(safeTx.signatures.values())[2])
    // console.log("orginSign3 :", orginSign3)


    const signatureBytes = buildSignatureBytes([
        ethSafeSignature,
        ethSafeSignature2,
        safeTx.getSignature(DAO_ADDRESS!) as SafeSignature,
    ])

    console.log("signatureBytes :", signatureBytes)

    // const signatureResponse = await apiKit.confirmTransaction(
    //     safeTxHash,
    //     buildSignatureBytes([
    //         ethSafeSignature,
    //         ethSafeSignature2,
    //         safeTx.getSignature(DAO_ADDRESS!) as SafeSignature,
    //     ])
    // )
    // console.log("signatureResponse :", signatureResponse)

    // const safeTransaction = await protocolKit.toSafeTransactionType(transaction)
    const signature = '0x405fde30aa47fcb434d1fdfd076157bb99bb6e3011ff2020868d8f4f2f80255e2b0349a35b6a57ded5280427da8cdb24ddbe934c51d58971361ae25e31dfee281c000000000000000000000000a2101482b28e3d99ff6ced517ba41eff4971a38600000000000000000000000000000000000000000000000000000000000000c300c5356b2bc34be1d0e238bee40efba33b0b49a5272513c2a2d184d577c4a912dc51fe3e4d89b830a9f42e566d047f4cc1145c5fa4694646cc0183bd6716682cbf1b00000000000000000000000000000000000000000000000000000000000000825d72a57e565b5d05c9b0de12dab8ba5259f8636242016e587da7255bf24a2a6f0a5259eb6e86faee26e7442820d78ea6049d52df975931e2e953b10149165dea1f1b6d0977aa31da18e51f996fe2d68b6e790b3fb8719dd7649638b08e49c14d0251a77b138470e748ef201c5dd51df01714e3b9a9c672ffdba4d8c6eccd147a1a1f'
    safeTx.encodedSignatures = () => {
        return signature
    }
    console.log("safeTx2 :", safeTx)


    const data = await protocolKit.getEncodedTransaction(safeTx)

    // console.log("data :", data)

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