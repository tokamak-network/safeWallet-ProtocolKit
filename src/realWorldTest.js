import dotenv from 'dotenv';
import { SafeConfirmationManager } from './safeConfirmation.js';
import { SafeServiceClient } from './safeServiceAPI.js';
import { ethers } from 'ethers';

// Load environment variables
dotenv.config();

/**
 * 실제 Safe Service API를 사용한 EIP-1271 컨트랙트 확인 테스트
 */
async function realWorldConfirmationTest() {
  try {
    console.log('🌍 Real World Safe Confirmation Test with EIP-1271 Contract');
    console.log('=' .repeat(70));

    // Configuration
    const config = {
      rpcUrl: process.env.RPC_URL,
      safeAddress: process.env.SAFE_ADDRESS,
      eip1271ContractAddress: process.env.EIP1271_CONTRACT_ADDRESS,
      contractOwnerPrivateKey: process.env.CONTRACT_OWNER_PRIVATE_KEY,
      chainId: parseInt(process.env.CHAIN_ID || '1')
    };

    // Validate configuration
    if (!config.rpcUrl || !config.safeAddress || !config.eip1271ContractAddress || !config.contractOwnerPrivateKey) {
      throw new Error('Missing required environment variables');
    }

    // Initialize managers
    const confirmationManager = new SafeConfirmationManager(config);
    const safeService = new SafeServiceClient(config.chainId, config.safeAddress);
    
    await confirmationManager.initialize();

    // Step 1: Get Safe info from both local and service
    console.log('\n📊 Step 1: Getting Safe information...');
    const localSafeInfo = await confirmationManager.getSafeInfo();
    
    try {
      const serviceSafeInfo = await safeService.getSafeInfo();
      console.log('✅ Safe Service connection successful');
    } catch (error) {
      console.log('⚠️  Safe Service not available (might be testnet or local)');
    }

    if (!localSafeInfo.isContractOwner) {
      console.log('\n❌ EIP-1271 contract is not a Safe owner');
      console.log('   Please add the contract as a Safe owner first');
      return;
    }

    // Step 2: Check for pending transactions
    console.log('\n📋 Step 2: Checking for pending transactions...');
    try {
      const pendingTxs = await safeService.getPendingTransactions();
      
      if (pendingTxs.length > 0) {
        console.log(`📌 Found ${pendingTxs.length} pending transaction(s)`);
        
        // Confirm the first pending transaction
        const firstTx = pendingTxs[0];
        console.log(`🎯 Confirming transaction: ${firstTx.safeTxHash}`);
        
        await confirmPendingTransaction(confirmationManager, safeService, firstTx);
      } else {
        console.log('📝 No pending transactions found, creating a new one...');
        await createAndConfirmNewTransaction(confirmationManager, safeService, config);
      }
    } catch (error) {
      console.log('⚠️  Could not access Safe Service, testing locally only...');
      await createAndConfirmNewTransaction(confirmationManager, null, config);
    }

    console.log('\n✅ Real world confirmation test completed!');

  } catch (error) {
    console.error('\n❌ Real world test failed:', error.message);
    console.error(error.stack);
  }
}

/**
 * 대기 중인 트랜잭션에 확인 추가
 */
async function confirmPendingTransaction(confirmationManager, safeService, pendingTx) {
  try {
    console.log('\n🔐 Confirming pending transaction...');
    console.log(`   Safe Tx Hash: ${pendingTx.safeTxHash}`);
    console.log(`   To: ${pendingTx.to}`);
    console.log(`   Value: ${pendingTx.value} wei`);
    console.log(`   Current confirmations: ${pendingTx.confirmations?.length || 0}`);

    // EIP-1271 컨트랙트로 서명
    const signature = await confirmationManager.confirmExistingTransaction(pendingTx.safeTxHash);
    
    // Safe Service에 확인 추가
    if (safeService) {
      try {
        await safeService.addConfirmation(pendingTx.safeTxHash, signature);
        console.log('✅ Confirmation added to Safe Service');
        
        // 확인 상태 조회
        const confirmations = await safeService.getConfirmations(pendingTx.safeTxHash);
        console.log(`📊 Total confirmations now: ${confirmations.length}`);
        
      } catch (error) {
        console.log('⚠️  Could not add confirmation to Safe Service:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Error confirming pending transaction:', error);
    throw error;
  }
}

/**
 * 새 트랜잭션 생성 및 확인
 */
async function createAndConfirmNewTransaction(confirmationManager, safeService, config) {
  try {
    console.log('\n📝 Creating new transaction...');

    // 테스트 트랜잭션 생성
    const testTransaction = {
      to: '0x0000000000000000000000000000000000000001',
      value: '1000000000000000', // 0.001 ETH
      data: '0x'
    };

    // Safe 트랜잭션 생성
    const { transaction, hash } = await confirmationManager.createSafeTransaction(testTransaction);
    
    // EIP-1271 컨트랙트로 확인
    const confirmationResult = await confirmationManager.confirmTransactionWithContract(transaction);
    
    console.log('✅ Local transaction created and confirmed');
    console.log(`   Transaction Hash: ${confirmationResult.txHash}`);

    // Safe Service에 제안 (가능한 경우)
    if (safeService) {
      try {
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        const contractOwnerWallet = new ethers.Wallet(config.contractOwnerPrivateKey, provider);
        const senderAddress = await contractOwnerWallet.getAddress();

        // 트랜잭션 데이터 준비
        const transactionData = {
          ...testTransaction,
          nonce: await confirmationManager.safe.getNonce(),
          contractTransactionHash: confirmationResult.txHash
        };

        await safeService.proposeTransaction(
          transactionData,
          confirmationResult.signature,
          senderAddress
        );
        
        console.log('✅ Transaction proposed to Safe Service');
        
      } catch (error) {
        console.log('⚠️  Could not propose to Safe Service:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Error creating new transaction:', error);
    throw error;
  }
}

/**
 * Safe Service API 연결 테스트
 */
async function testSafeServiceConnection() {
  try {
    console.log('\n🔌 Testing Safe Service API connection...');
    
    const chainId = parseInt(process.env.CHAIN_ID || '1');
    const safeAddress = process.env.SAFE_ADDRESS;
    
    const safeService = new SafeServiceClient(chainId, safeAddress);
    
    console.log(`🌐 Service URL: ${safeService.baseUrl}`);
    console.log(`📍 Safe Address: ${safeAddress}`);
    console.log(`🔗 Chain ID: ${chainId}`);
    
    // Test connection
    const safeInfo = await safeService.getSafeInfo();
    console.log('✅ Safe Service connection successful');
    
    return true;
  } catch (error) {
    console.log('❌ Safe Service connection failed:', error.message);
    return false;
  }
}

// Run the real world test
async function runRealWorldTest() {
  console.log('🚀 Starting Real World EIP-1271 Safe Confirmation Test');
  console.log('=' .repeat(80));
  
  // Test Safe Service connection first
  const serviceAvailable = await testSafeServiceConnection();
  
  if (serviceAvailable) {
    console.log('✅ Safe Service is available, running full test...');
  } else {
    console.log('⚠️  Safe Service not available, running local test only...');
  }
  
  await realWorldConfirmationTest();
}

runRealWorldTest().catch(console.error);