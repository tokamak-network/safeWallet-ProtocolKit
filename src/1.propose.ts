import 'dotenv/config'

import Safe from "@safe-global/protocol-kit"
import SafeApiKit from "@safe-global/api-kit"
import { OperationType } from "@safe-global/types-kit"
import type { Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"


const RPC_URL = process.env.RPC_URL;
const SAFE_ADDRESS = process.env.SAFE_WALLET_ADDRESS;
const SAFE_API_KEY = process.env.SAFE_API_KEY;


async function main(): Promise<void> {
    const apiKit = new SafeApiKit({
        chainId: 11155111n,
        apiKey: SAFE_API_KEY,
    })

    let protocolKit = await Safe.init({
        provider: "https://eth-sepolia.public.blastapi.io",
        signer: process.env.TRH_ADMIN_PRIVATE_KEY as Hex,
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
    
    const account = privateKeyToAccount(process.env.TRH_ADMIN_PRIVATE_KEY as Hex)
    const safeTxHash = await protocolKit.getTransactionHash(safeTx)
    const signature = await protocolKit.signHash(safeTxHash)
    await apiKit.proposeTransaction({
      safeAddress: SAFE_ADDRESS!,
      safeTransactionData: safeTx.data,
      safeTxHash,
      senderAddress: account.address,
      senderSignature: signature.data,
    })
    
    const transaction = await apiKit.getTransaction(safeTxHash)
    console.log(transaction)


}







main().catch((error) => {
    console.error(error);
    process.exit(1);
});