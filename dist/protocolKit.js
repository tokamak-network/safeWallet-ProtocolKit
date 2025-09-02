// This script demonstrates how to sign a transaction using the Safe Protocol Kit.
// Please replace the placeholder values with your actual data.
// You need to install the following packages:
// npm install @safe-global/protocol-kit ethers dotenv
import 'dotenv/config';
import Safe, { buildContractSignature } from '@safe-global/protocol-kit';
import { SigningMethod } from '@safe-global/types-kit';
// Load environment variables
const RPC_URL = process.env.RPC_URL;
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
const OWNER_PRIVATE_KEY2 = process.env.OWNER_PRIVATE_KEY2;
const SAFE_ADDRESS = process.env.SAFE_ADDRESS;
const DAO_ADDRESS = process.env.DAO_ADDRESS;
const MULTISIG_ADDRESS = process.env.MULTISIG_ADDRESS;
const SAFE_API_KEY = process.env.SAFE_API_KEY;
if (!RPC_URL || !OWNER_PRIVATE_KEY || !OWNER_PRIVATE_KEY2 || !SAFE_ADDRESS || !DAO_ADDRESS) {
    throw new Error("Please make sure you have a .env file with RPC_URL, OWNER_PRIVATE_KEY, and SAFE_ADDRESS variables.");
}
// const provider = new ethers.JsonRpcProvider(RPC_URL);
// const wallet = new ethers.Wallet(OWNER_PRIVATE_KEY, provider);
async function main() {
    const safeAccountConfig = {
        owners: ['0xA2101482b28E3D99ff6ced517bA41EFf4971a386', '0x6E1c4a442E9B9ddA59382ee78058650F1723E0F6', '0x3bFda92Fa3bC0AB080Cac3775147B6318b1C5115'],
        threshold: 2
        // More optional properties
    };
    const predictedSafe = {
        safeAccountConfig
        // More optional properties
    };
    let protocolKit = await Safe.init({
        provider: RPC_URL,
        signer: OWNER_PRIVATE_KEY,
        predictedSafe
    });
    // Create a transaction object
    const safeTransactionData = {
        "to": "0x6E1c4a442E9B9ddA59382ee78058650F1723E0F6",
        "data": "0x",
        "value": "10000000000000000",
        "operation": 0,
        "baseGas": "0",
        "gasPrice": "0",
        "gasToken": "0x0000000000000000000000000000000000000000",
        "nonce": 0,
        "refundReceiver": "0x0000000000000000000000000000000000000000",
        "safeTxGas": "0"
    };
    // // Create a new transaction object
    // let transactionSafe2_3 = await protocolKit.createTransaction({
    //     transactions: [safeTransactionData]
    // });
    // // Connect with second signer
    // protocolKit = await protocolKit.connect({
    //     provider: RPC_URL!,
    //     signer: OWNER_PRIVATE_KEY2!
    // });
    // // Sign with second owner
    // transactionSafe2_3 = await protocolKit.signTransaction(transactionSafe2_3);
    // console.log('Signed Transaction:', transactionSafe2_3);
    // MultiSigWallet용 별도 트랜잭션 객체 생성 (DAOContract의 서명 대상 해시 기반)
    let multiSigTransaction = await protocolKit.createTransaction({
        transactions: [safeTransactionData] // Safe Wallet의 동일한 데이터 사용
    });
    // DAOOwner1 연결 및 서명 (MultiSigWallet 연결)
    protocolKit = await protocolKit.connect({
        provider: RPC_URL,
        signer: OWNER_PRIVATE_KEY,
        safeAddress: MULTISIG_ADDRESS // MultiSigWallet 주소
    });
    multiSigTransaction = await protocolKit.signTransaction(multiSigTransaction, SigningMethod.SAFE_SIGNATURE, // MultiSigWallet이 Safe라면
    SAFE_ADDRESS // 부모 Safe Wallet 주소 지정
    );
    // DAOOwner2 연결 및 서명
    protocolKit = await protocolKit.connect({
        provider: RPC_URL,
        signer: OWNER_PRIVATE_KEY2
    });
    multiSigTransaction = await protocolKit.signTransaction(multiSigTransaction, SigningMethod.SAFE_SIGNATURE, SAFE_ADDRESS);
    const daoContractSignature = await buildContractSignature(Array.from(multiSigTransaction.signatures.values()), // MultiSigWallet의 2개 서명 배열
    DAO_ADDRESS // DAOContract 주소 (EIP-1271 구현체)
    );
    multiSigTransaction.addSignature(daoContractSignature);
    // const STRING_MESSAGE = "nonceZero is okay"
    // let safeMessage = protocolKit.createMessage(STRING_MESSAGE)
    // // Connect with first signer
    // protocolKit = await protocolKit.connect({
    //     provider: RPC_URL,
    //     signer: OWNER_PRIVATE_KEY
    // })
    // safeMessage = await protocolKit.signMessage(
    //     safeMessage,
    //     SigningMethod.ETH_SIGN  // 또는 ETH_SIGN_TYPED_DATA_V4
    // );
    // // Connect with second signer
    // protocolKit = await protocolKit.connect({
    //     provider: RPC_URL,
    //     signer: OWNER_PRIVATE_KEY2
    // })
    // safeMessage = await protocolKit.signMessage(
    //     safeMessage,
    //     SigningMethod.ETH_SIGN  // 또는 ETH_SIGN_TYPED_DATA_V4
    // );
    // console.log(safeMessage)
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=protocolKit.js.map