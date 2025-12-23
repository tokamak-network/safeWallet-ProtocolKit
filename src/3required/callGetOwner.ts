import { createPublicClient, http, Address } from 'viem'
import { sepolia } from 'viem/chains'

const CONTRACT_ADDRESS = '0x277a690e99C4197d07c29eD57090441Dcb384b30' as Address

const abi = [
    {
        inputs: [],
        name: 'getOwner',
        outputs: [
            {
                internalType: 'address',
                name: '',
                type: 'address',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
] as const

async function main() {
    const publicClient = createPublicClient({
        chain: sepolia,
        transport: http('https://eth-sepolia.api.onfinality.io/public'),
    })

    try {
        const owner = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: abi,
            functionName: 'getOwner',
        })

        console.log('Contract Address:', CONTRACT_ADDRESS)
        console.log('Owner Address:', owner)
    } catch (error) {
        console.error('Error calling getOwner:', error)
    }
}

main()
