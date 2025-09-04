const SimpleConfirmTest = require('./simple-confirm-test');

async function testSimpleConfirm() {
    console.log('🚀 Simple Confirm Transaction 테스트 시작...\n');
    
    // 테스트 설정
    const config = {
        rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
        safeWalletAddress: process.env.SAFE_WALLET_ADDRESS,
        daoContractAddress: process.env.DAO_CONTRACT_ADDRESS,
        multiSigWalletAddress: process.env.MULTISIG_WALLET_ADDRESS,
        multiSigSigners: [
            { privateKey: process.env.MULTISIG_SIGNER1_PRIVATE_KEY },
            { privateKey: process.env.MULTISIG_SIGNER2_PRIVATE_KEY }
        ]
    };

    // 필수 설정 확인
    if (!config.safeWalletAddress || !config.daoContractAddress || !config.multiSigWalletAddress) {
        console.error('❌ 필수 환경 변수가 설정되지 않았습니다.');
        console.log('다음 환경 변수들을 설정해주세요:');
        console.log('- SAFE_WALLET_ADDRESS');
        console.log('- DAO_CONTRACT_ADDRESS');
        console.log('- MULTISIG_WALLET_ADDRESS');
        console.log('- MULTISIG_SIGNER1_PRIVATE_KEY');
        console.log('- MULTISIG_SIGNER2_PRIVATE_KEY');
        console.log('- RPC_URL (선택사항, 기본값: http://localhost:8545)');
        return;
    }

    try {
        const test = new SimpleConfirmTest(config);
        
        // 1. 상태 확인
        console.log('📊 1단계: 상태 확인');
        await test.checkStatus();
        console.log('');
        
        // 2. 테스트할 txHash들
        const testTxHashes = [
            process.env.TEST_TX_HASH || '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba'
        ];
        
        // 3. 각 txHash에 대해 테스트
        console.log('🧪 2단계: txHash별 confirmTransaction 테스트');
        for (let i = 0; i < testTxHashes.length; i++) {
            const txHash = testTxHashes[i];
            console.log(`\n--- 테스트 ${i + 1}/${testTxHashes.length} ---`);
            console.log(`📝 테스트 txHash: ${txHash}`);
            
            const result = await test.testConfirmTransaction(txHash);
            
            if (result.success) {
                console.log(`✅ 테스트 ${i + 1} 성공!`);
                console.log(`📋 결과: ${result.message}`);
            } else {
                console.log(`❌ 테스트 ${i + 1} 실패: ${result.error}`);
            }
            
            // 다음 테스트 전 잠시 대기
            if (i < testTxHashes.length - 1) {
                console.log('⏳ 다음 테스트를 위해 2초 대기...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log('\n🎉 모든 테스트 완료!');
        
    } catch (error) {
        console.error('❌ 테스트 실행 실패:', error.message);
        process.exit(1);
    }
}

// 테스트 실행
if (require.main === module) {
    testSimpleConfirm().catch(console.error);
}

module.exports = testSimpleConfirm;
