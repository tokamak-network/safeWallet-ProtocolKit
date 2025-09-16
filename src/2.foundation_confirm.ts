import 'dotenv/config'

import Safe from "@safe-global/protocol-kit"
import SafeApiKit from "@safe-global/api-kit"
import { OperationType } from "@safe-global/types-kit"
import type { Hex } from "viem"
import { privateKeyToAccount } from "viem/accounts"


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
        apiKey: process.env.SAFE_API_KEY,
    })

    let protocolKit = await Safe.init({
        provider: "https://eth-sepolia.public.blastapi.io",
        signer: FOUNDATION_KEY!,
        safeAddress: SAFE_ADDRESS!,
    })

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

    const safeTxHash = await protocolKit.getTransactionHash(safeTx)
    const signature = await protocolKit.signHash(safeTxHash)

    const signatureResponse = await apiKit.confirmTransaction(
        safeTxHash,
        signature.data
    )
    console.log("signatureResponse :", signatureResponse)
}







main().catch((error) => {
    console.error(error);
    process.exit(1);
});