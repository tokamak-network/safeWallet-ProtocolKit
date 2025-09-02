const { ethers } = require('ethers');
const SafeWalletDAOProtocol = require('./dao-signing-script');
require('dotenv').config();

// 테스트용 간단한 스크립트
async function testDAOContractSigning() {
    console.log('🧪 DAOContract 서명 테스트 시작...\n');
    
    // 환경 변수 확인
    const requiredEnvVars = [
        'SAFE_WALLET_ADDRESS',
        'DAO_CONTRACT_ADDRESS', 
        'MULTISIG_WALLET_ADDRESS',
        'MULTISIG_SIGNER1_PRIVATE_KEY',
        'MULTISIG_SIGNER2_PRIVATE_KEY',
        'SAFE_SIGNER1_PRIVATE_KEY'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        console.error('❌ 다음 환경 변수들이 설정되지 않았습니다:');
        missingVars.forEach(varName => console.log(`  - ${varName}`));
        console.log('\n.env 파일을 생성하고 필요한 변수들을 설정해주세요.');
        return;
    }
    
    try {
        const config = {
            rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
            safeWalletAddress: process.env.SAFE_WALLET_ADDRESS,
            daoContractAddress: process.env.DAO_CONTRACT_ADDRESS,
            multiSigWalletAddress: process.env.MULTISIG_WALLET_ADDRESS,
            multiSigSigners: [
                { privateKey: process.env.MULTISIG_SIGNER1_PRIVATE_KEY },
                { privateKey: process.env.MULTISIG_SIGNER2_PRIVATE_KEY }
            ].filter(signer => signer.privateKey), // privateKey가 있는 것만 필터링
            safeSigners: [
                { privateKey: process.env.SAFE_SIGNER1_PRIVATE_KEY },
                { privateKey: process.env.SAFE_SIGNER3_PRIVATE_KEY }
            ].filter(signer => signer.privateKey)
        };
        
        const protocol = new SafeWalletDAOProtocol(config);
        
        // 1. 상태 확인
        console.log('📊 1단계: 현재 상태 확인');
        await protocol.checkStatus();
        
        // 2. 간단한 테스트 해시로 DAOContract 서명 테스트
        console.log('\n🧪 2단계: DAOContract 서명 테스트');
        const testHash = ethers.keccak256(ethers.toUtf8Bytes('test message for DAO signing'));
        console.log(`테스트 해시: ${testHash}`);
        
        // MultiSigWallet 서명자들의 서명 수집
        const multiSigSignature = await protocol.collectMultiSigSignatures(testHash);
        
        // DAOContract 서명 검증
        const isValid = await protocol.testDAOContractSignature(testHash, multiSigSignature);
        
        if (isValid) {
            console.log('\n✅ DAOContract 서명 테스트 성공!');
            console.log('SafeWallet에서 DAOContract를 통한 서명이 정상적으로 작동합니다.');
        } else {
            console.log('\n❌ DAOContract 서명 테스트 실패!');
            console.log('DAOContract의 isValidSignature 함수를 확인해주세요.');
        }
        
        // 3. SafeWallet에 서명 제출 테스트 (선택사항)
        if (process.env.TEST_SAFE_TRANSACTION === 'true') {
            console.log('\n🚀 3단계: SafeWallet 서명 제출 테스트');
            const testTo = process.env.TEST_TO_ADDRESS || ethers.ZeroAddress;
            const testValue = process.env.TEST_VALUE || '0';
            const testData = process.env.TEST_DATA || '0x';
            
            // 방법 1: Signer1 + DAOContract 서명을 함께 제출
            console.log('\n📝 방법 1: Signer1 + DAOContract 서명 제출');
            try {
                const result1 = await protocol.submitSignatureToSafeWallet(testTo, testValue, testData);
                console.log('✅ 방법 1 완료!');
            } catch (error) {
                console.log('❌ 방법 1 실패:', error.message);
            }
            
            // 방법 2: DAOContract만을 통한 서명 제출
            console.log('\n🏛️ 방법 2: DAOContract만을 통한 서명 제출');
            try {
                const result2 = await protocol.submitDAOSignatureToSafeWallet(testTo, testValue, testData);
                console.log('✅ 방법 2 완료!');
                console.log('이제 SafeWallet UI에서 "2 out of 2" 상태를 확인할 수 있습니다.');
            } catch (error) {
                console.log('❌ 방법 2 실패:', error.message);
            }
        }
        
    } catch (error) {
        console.error('❌ 테스트 실행 실패:', error.message);
        console.error('스택 트레이스:', error.stack);
    }
}

// 스크립트 실행
if (require.main === module) {
    testDAOContractSigning().catch(console.error);
}

module.exports = testDAOContractSigning;
