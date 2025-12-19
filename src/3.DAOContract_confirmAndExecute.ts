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
const SAFE_ADDRESS = process.env.SAFE_WALLET_ADDRESS;
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
            to: "0x56dc8f22F6Fa3142E0aBdD4c7b6219B2CEa7bD78",
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

    // console.log("txHashData", txHashData)

    const messageHash = await protocolKit.getSafeMessageHash(txHashData)
    // console.log("messageHash", messageHash)

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
        DAO_ADDRESS!
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

    // let signA = "81d53d0ef4c689e72fe2c8706b6b0ece19a76b8fae614d1b73f4cac1191f3d7f5b6d0eca479b70bc4c5313c601645366be8a6f6cce809e05fe7133678ebed88220"
    // let signB = "a3dcf979b5e40b49ca6eabf3920526c24918593d547fa1fba03aa115f7414d1d44ca5a9127f2694f355fb336d1c4d54f3399f7621b484277eb80ffb1e1a7e54520"
    // console.log("signA.length :", signA.length)
    // console.log("signB.length :", signB.length)

    const signature = buildSignatureBytes([
        orginSign,
        orginSign2,
        safeTx.getSignature(DAO_ADDRESS!) as SafeSignature,
    ])
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

    const account = privateKeyToAccount(process.env.TRH_ADMIN_PRIVATE_KEY as Hex)
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