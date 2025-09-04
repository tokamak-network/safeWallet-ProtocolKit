import Safe, { buildContractSignature } from "@safe-global/protocol-kit"
import { SigningMethod } from "@safe-global/types-kit"
import type { Address, Hex } from "viem"
import {
  createWalletClient,
  encodeFunctionData,
  http,
  parseAbi,
  publicActions,
  testActions,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { sepolia } from "viem/chains"
import {
  abi,
  bytecode,
} from "./contracts/out/DAOCommittee.sol/DAOCommittee.json"

const deployMockDaoCommittee = async (): Promise<Address> => {
  const daoCommitteeDeployHash = await client.deployContract({
    abi,
    bytecode: bytecode.object as `0x${string}`,
    args: [],
  })
  const receipt = await client.waitForTransactionReceipt({
    hash: daoCommitteeDeployHash,
  })
  return receipt.contractAddress as `0x${string}`
}

const SAFE_PROXY_FACTORY_ADDRESS = "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67"

const keys = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
] as Hex[]
const account = privateKeyToAccount(keys[0])
const client = createWalletClient({
  account,
  chain: sepolia,
  transport: http("http://127.0.0.1:8545"),
})
  .extend(publicActions)
  .extend(testActions({ mode: "anvil" }))

const daoCommitteeAddress = await deployMockDaoCommittee()
console.log(`DAOCommittee Address : ${daoCommitteeAddress}`)
const owners = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  daoCommitteeAddress,
  "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720",
] as Address[]

const setupToL2Data = encodeFunctionData({
  abi: parseAbi(["function setupToL2(address l2Singleton)"]),
  functionName: "setupToL2",
  args: ["0x29fcB43b46531BcA003ddC8FCB67FFE91900C762"],
})

const setupData = encodeFunctionData({
  abi: parseAbi([
    "function setup(address[] owners, uint256 threshold, address to, bytes data, address fallbackHandler, address paymentToken, uint256 payment, address paymentReceiver)",
  ]),
  functionName: "setup",
  args: [
    owners,
    2n,
    "0xBD89A1CE4DDe368FFAB0eC35506eEcE0b1fFdc54",
    setupToL2Data,
    "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99",
    "0x0000000000000000000000000000000000000000",
    0n,
    owners[0],
  ],
})

const createTxHash = await client.writeContract({
  address: SAFE_PROXY_FACTORY_ADDRESS,
  abi: parseAbi([
    "function createProxyWithNonce(address _singleton, bytes memory initializer, uint256 saltNonce) external returns (address proxy)",
  ]),
  functionName: "createProxyWithNonce",
  args: ["0x41675C099F32341bf84BFc5382aF534df5C7461a", setupData, 0n],
})

const receipt = await client.waitForTransactionReceipt({ hash: createTxHash })
const safeProxyAddress = `0x${receipt.logs[2].topics[1]?.slice(26)}`
console.log(`Safe Proxy Address : ${safeProxyAddress}`)
console.log(`Safe Singleton Address : 0x${receipt.logs[2].data?.slice(26)}`)
console.log(
  `Safe Treshold : ${await client.readContract({
    address: safeProxyAddress,
    abi: parseAbi(["function getThreshold() external view returns (uint256)"]),
    functionName: "getThreshold",
  })}`
)
console.log(
  `Safe Owners : ${await client.readContract({
    address: safeProxyAddress,
    abi: parseAbi([
      "function getOwners() external view returns (address[] memory)",
    ]),
    functionName: "getOwners",
  })}`
)

await new Promise((resolve) => setTimeout(resolve, 3000))

let protocolKit = await Safe.init({
  provider: "http://127.0.0.1:8545",
  signer: keys[0],
  safeAddress: safeProxyAddress,
})

client.setBalance({
  address: safeProxyAddress,
  value: 1n,
})

let safeTx = await protocolKit.createTransaction({
  transactions: [
    {
      to: "0xf0B595d10a92A5a9BC3fFeA7e79f5d266b6035Ea",
      value: "1",
      data: "0x",
    },
  ],
})

let multiSigSigns = await protocolKit
  .connect({
    provider: "http://127.0.0.1:8545",
    signer: keys[1],
    safeAddress: daoCommitteeAddress,
  })
  .then((k) =>
    k.signTransaction(safeTx, SigningMethod.SAFE_SIGNATURE, safeProxyAddress)
  )

multiSigSigns = await protocolKit
  .connect({
    provider: "http://127.0.0.1:8545",
    signer: keys[2],
    safeAddress: daoCommitteeAddress,
  })
  .then((k) =>
    k.signTransaction(safeTx, SigningMethod.SAFE_SIGNATURE, safeProxyAddress)
  )

safeTx = await protocolKit
  .connect({
    provider: "http://127.0.0.1:8545",
    signer: keys[0],
  })
  .then(async (k) => {
    return k.signTransaction(safeTx, SigningMethod.ETH_SIGN)
  })

const contractSignature = await buildContractSignature(
  Array.from(multiSigSigns.signatures.values()),
  daoCommitteeAddress
)

safeTx.addSignature(contractSignature)
console.log(safeTx)

const tx = await protocolKit.executeTransaction(safeTx)
console.log(tx)

console.log(
  await client.waitForTransactionReceipt({
    hash: tx.hash as Hex,
  })
)