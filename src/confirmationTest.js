import dotenv from 'dotenv';
import { SafeConfirmationManager } from './safeConfirmation.js';

// Load environment variables
dotenv.config();

/**
 * EIP-1271 컨트랙트를 통한 Safe Wallet Confirmation 테스트
 */
async function testSafeConfirmation() {
    try {
        console.log('🎯 Testing Safe Wallet Confirmation with EIP-1271 Contract');
        console.log('='.repeat(70));

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
            throw new Error('Missing required environment variables. Please check your .env file.');
        }

        // Initialize Safe Confirmation Manager
        const confirmationManager = new SafeConfirmationManager(config);
        await confirmationManager.initialize();

        // Get Safe information
        const safeInfo = await confirmationManager.getSafeInfo();

        if (!safeInfo.isContractOwner) {
            console.log('\n⚠️  Warning: EIP-1271 contract is not a Safe owner');
            console.log('   Please add the contract as a Safe owner first');
            return;
        }

        console.log(`\n✅ EIP-1271 contract is a Safe owner`);
        console.log(`📊 Safe requires ${safeInfo.threshold} confirmation(s) out of ${safeInfo.owners.length} owners`);

        // Create a test transaction
        const testTransaction = {
            to: '0x0000000000000000000000000000000000000001', // Example address
            value: '1000000000000000', // 0.001 ETH in wei
            data: '0x' // Empty data for simple transfer
        };

        console.log('\n📋 Test Transaction:');
        console.log(`   To: ${testTransaction.to}`);
        console.log(`   Value: ${testTransaction.value} wei (0.001 ETH)`);
        console.log(`   Data: ${testTransaction.data}`);

        // Create Safe transaction
        const { transaction, hash } = await confirmationManager.createSafeTransaction(testTransaction);

        // Confirm transaction with EIP-1271 contract
        const confirmationResult = await confirmationManager.confirmTransactionWithContract(transaction);

        console.log('\n🎉 Confirmation completed!');
        console.log(`   Transaction Hash: ${confirmationResult.txHash}`);
        console.log(`   Signature: ${confirmationResult.signature}`);

        // Check if we can execute (depends on threshold)
        if (safeInfo.threshold === 1) {
            console.log('\n💡 Threshold is 1, transaction can be executed immediately');
            // Uncomment to execute:
            // const executionResult = await confirmationManager.executeTransaction(confirmationResult.signedTransaction);
        } else {
            console.log(`\n💡 Threshold is ${safeInfo.threshold}, need ${safeInfo.threshold - 1} more confirmation(s)`);
            console.log('   Other owners need to confirm this transaction');
        }

        // Test confirming an existing transaction (example)
        console.log('\n🔄 Testing confirmation of existing transaction...');
        const existingTxSignature = await confirmationManager.confirmExistingTransaction(hash);
        console.log(`✅ Existing transaction signature: ${existingTxSignature}`);

        console.log('\n✅ Safe Confirmation test completed successfully!');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        process.exit(1);
    }
}

/**
 * Safe Transaction Service API 사용 예시
 */
async function demonstrateSafeServiceAPI() {
    console.log('\n📡 Safe Transaction Service API Usage Examples:');
    console.log('='.repeat(50));

    const safeAddress = process.env.SAFE_ADDRESS;
    const chainId = process.env.CHAIN_ID || '1';

    // 네트워크별 Safe Service URL
    const serviceUrls = {
        '1': 'https://safe-transaction-mainnet.safe.global',
        '5': 'https://safe-transaction-goerli.safe.global',
        '137': 'https://safe-transaction-polygon.safe.global',
        '100': 'https://safe-transaction-gnosis-chain.safe.global'
    };

    const baseUrl = serviceUrls[chainId] || serviceUrls['1'];

    console.log(`🌐 Safe Service URL: ${baseUrl}`);
    console.log(`📍 Safe Address: ${safeAddress}`);

    console.log('\n📋 API Endpoints:');
    console.log(`   Pending transactions: ${baseUrl}/api/v1/safes/${safeAddress}/multisig-transactions/?executed=false`);
    console.log(`   All transactions: ${baseUrl}/api/v1/safes/${safeAddress}/multisig-transactions/`);
    console.log(`   Safe info: ${baseUrl}/api/v1/safes/${safeAddress}/`);
    console.log(`   Propose transaction: POST ${baseUrl}/api/v1/safes/${safeAddress}/multisig-transactions/`);
    console.log(`   Add confirmation: POST ${baseUrl}/api/v1/multisig-transactions/{safeTxHash}/confirmations/`);

    console.log('\n💡 To interact with these APIs:');
    console.log('   1. Use fetch() or axios to make HTTP requests');
    console.log('   2. For POST requests, include proper authentication');
    console.log('   3. Follow Safe Transaction Service API documentation');
}

// Run tests
async function runAllTests() {
    await testSafeConfirmation();
    await demonstrateSafeServiceAPI();
}

runAllTests().catch(console.error);