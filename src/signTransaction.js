import 'dotenv/config'
import Safe, { buildContractSignature } from '@safe-global/protocol-kit'
import SafeApiKit from '@safe-global/api-kit'

import { ethers } from 'ethers'

// Load environment variables
const RPC_URL = process.env.RPC_URL;
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY;
const OWNER_PRIVATE_KEY2 = process.env.OWNER_PRIVATE_KEY2;
const SAFE_ADDRESS = process.env.SAFE_ADDRESS;
const DAO_ADDRESS = process.env.DAO_ADDRESS;
const MULTISIG_ADDRESS = process.env.MULTISIG_ADDRESS;
const SAFE_API_KEY = process.env.SAFE_API_KEY;

// const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

if (!RPC_URL || !OWNER_PRIVATE_KEY || !OWNER_PRIVATE_KEY2 || !SAFE_ADDRESS || !MULTISIG_ADDRESS || !SAFE_API_KEY) {
  throw new Error("Please make sure you have a .env file with RPC_URL, OWNER_PRIVATE_KEY, and SAFE_ADDRESS variables.");
}

async function main() {
  const OWNER_ADDRESS = "0xf0B595d10a92A5a9BC3fFeA7e79f5d266b6035Ea"
  const OWNER_ADDRESS2 = "0x757DE9c340c556b56f62eFaE859Da5e08BAAE7A2"

  // 1. DAOContract(MultiSig) 소유자들의 Safe 인스턴스 생성
  const multisigOwner1Kit = await Safe.init({
    provider: RPC_URL,
    signer: OWNER_PRIVATE_KEY,
    safeAddress: DAO_ADDRESS
  });

  const multisigOwner2Kit = await Safe.init({
    provider: RPC_URL,
    signer: OWNER_PRIVATE_KEY2,
    safeAddress: DAO_ADDRESS
  });

  // 2. 메인 Safe 인스턴스 생성 (DAOContract가 소유자인 Safe)
  const mainSafeKit = await Safe.init({
    provider: RPC_URL,
    signer: OWNER_PRIVATE_KEY,
    safeAddress: SAFE_ADDRESS
  });

  // 3. Safe 트랜잭션 데이터 생성
  const safeTransactionData = {
    "to": "0xf0B595d10a92A5a9BC3fFeA7e79f5d266b6035Ea",
    "data": "0x",
    "value": "20000000000000000",
    "operation": 0,
    "baseGas": "0",
    "gasPrice": "0",
    "gasToken": "0x0000000000000000000000000000000000000000",
    "nonce": 1,
    "refundReceiver": "0x0000000000000000000000000000000000000000",
    "safeTxGas": "0"
  }

  const safeTransaction = await mainSafeKit.createTransaction({
    transactions: [safeTransactionData]
  });

  // 4. Safe 트랜잭션 해시 생성
  // 트랜잭션 해시 생성
  const txHash = await mainSafeKit.getTransactionHash(safeTransaction);
  console.log("Safe Transaction Hash:", txHash);

  // 5. DAOContract 소유자들이 Safe 트랜잭션 해시에 서명
  // 각 멀티시그 소유자가 개별적으로 서명
  // 중요: Safe 트랜잭션 해시에 서명해야 함
  const owner1Signature = await multisigOwner1Kit.signHash(txHash);
  const owner2Signature = await multisigOwner2Kit.signHash(txHash);

  console.log("Owner1 Signature:", owner1Signature.data);
  console.log("Owner2 Signature:", owner2Signature.data);

  // 6. 서명들을 올바른 순서로 정렬 (Safe는 서명자 주소 순서대로 정렬 필요)
  const signatures = [
    { signer: OWNER_ADDRESS, data: owner1Signature.data },
    { signer: OWNER_ADDRESS2, data: owner2Signature.data }
  ].sort((a, b) => a.signer.toLowerCase().localeCompare(b.signer.toLowerCase()));

  // 7. 서명들을 연결
  const concatenatedSignatures = signatures
    .map(sig => sig.data.slice(2)) // 0x 제거
    .join('');

  // console.log("concatenatedSignatures : ", concatenatedSignatures)

  // // 서명들을 연결하여 하나의 서명으로 생성
  // const concatenatedSignatures2 = owner1Signature.data + owner2Signature.data.slice(2);

  // console.log("concatenatedSignatures2 : ", concatenatedSignatures2)

  // Safe Protocol Kit의 buildContractSignature 사용
  // const contractSignature2 = await buildContractSignature(
  //   [{ signer: DAO_ADDRESS, data: concatenatedSignatures }],
  //   DAO_ADDRESS
  // );
  // console.log("Contract Signature2:", contractSignature2.data);


  // 8. EIP-1271 컨트랙트 서명 생성
  // Safe에서 요구하는 컨트랙트 서명 형식:
  // [32 bytes r][32 bytes s][1 byte v] 여기서 v = 0 (EIP-1271 표시)
  const contractSignature = {
    signer: DAO_ADDRESS,
    data: '0x' + 
          concatenatedSignatures + 
          '00'.repeat(32) + // r 값 (0으로 패딩)
          DAO_ADDRESS.slice(2).padStart(64, '0') + // s 값에 컨트랙트 주소
          '00' // v = 0 (EIP-1271 서명 표시)
  };
  console.log("Contract Signature:", contractSignature.data);

  
  // 9. Safe 트랜잭션에 컨트랙트 서명 추가
  safeTransaction.addSignature(contractSignature)

  const isValid = await verifyDAOApproval(DAO_ADDRESS, txHash, concatenatedSignatures);
  console.log("DAO approval valid:", isValid);

  // // EOA 소유자 서명도 추가
  // const eoaSignature = await mainSafeKit.signTransaction(safeTransaction);
  // safeTransaction.addSignature(eoaSignature);

  // 10. Safe API를 통해 트랜잭션 제출
  // Safe Transaction Service를 통한 확인
  const apiKit = new SafeApiKit({
    chainId: 11155111n,
    apiKey: SAFE_API_KEY
  });
  // const safeTxHash = await mainSafeKit.getTransactionHash(safeTransaction);
  console.log("1")

  // Safe Service에 트랜잭션 제출
  await apiKit.proposeTransaction({
    safeAddress: SAFE_ADDRESS,
    safeTransactionData: safeTransaction.data,
    safeTxHash: txHash,
    senderAddress: DAO_ADDRESS,
    senderSignature: contractSignature.data
  });

  console.log("Transaction proposed successfully!");

  await apiKit.confirmTransaction(
    txHash,
    contractSignature.data
  );
  console.log("Transaction confirmed with DAO approval!");
}

// DAOContract에서 Safe 서명 검증을 위한 헬퍼 함수
async function verifyDAOApproval(daoAddress, safeTxHash, signatures) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const daoContract = new ethers.Contract(daoAddress, [
    "function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4)"
  ], provider);

  try {
     // signatures가 올바른 bytes 형식인지 확인
     if (!signatures.startsWith('0x')) {
      signatures = '0x' + signatures;
    }
    
    console.log("Verifying with hash:", safeTxHash);
    console.log("Verifying with signatures:", signatures);

    const result = await daoContract.isValidSignature(safeTxHash, signatures);
    const EIP1271_MAGIC_VALUE = "0x1626ba7e";
    
    console.log("Verification result:", result);
    return result === EIP1271_MAGIC_VALUE;
  } catch (error) {
    console.error("Signature verification failed:", error);
    return false;
  }
}


main().catch((error) => {
  console.error(error);
  process.exit(1);
});