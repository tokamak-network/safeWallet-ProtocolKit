const { ethers } = require('ethers');
const SafeProtocolDAOProtocol = require('./safe-protocol-dao-signing');
require('dotenv').config();

// Safe Protocol Kit을 사용한 테스트
async function testSafeProtocolDAO() {
    console.log('🧪 Safe Protocol Kit DAOContract 서명 테스트 시작...\n');
    
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
            ].filter(signer => signer.privateKey),
            safeSigners: [
                { privateKey: process.env.SAFE_SIGNER1_PRIVATE_KEY },
                { privateKey: process.env.SAFE_SIGNER3_PRIVATE_KEY }
            ].filter(signer => signer.privateKey)
        };
        
        const protocol = new SafeProtocolDAOProtocol(config);
        
        // 1. 상태 확인
        console.log('📊 1단계: 현재 상태 확인');
        await protocol.checkStatus();
        
        // 2. 간단한 테스트 해시로 DAOContract 서명 테스트
        console.log('\n🧪 2단계: DAOContract 서명 테스트');
        const testHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes('test message for DAO signing'));
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
            return;
        }
        
        // 3. Safe Protocol Kit을 사용한 실제 트랜잭션 테스트
        if (process.env.TEST_SAFE_TRANSACTION === 'true') {
            console.log('\n🚀 3단계: Safe Protocol Kit 트랜잭션 테스트');
            const testTo = process.env.TEST_TO_ADDRESS || ethers.constants.AddressZero;
            const testValue = process.env.TEST_VALUE || '0';
            const testData = process.env.TEST_DATA || '0x';
            
            try {
                const result = await protocol.executeSafeTransaction(testTo, testValue, testData);
                
                console.log('\n✅ Safe Protocol Kit 트랜잭션 실행 성공!');
                console.log('이제 SafeWallet UI에서 "2 out of 2" 상태를 확인할 수 있습니다.');
                console.log(`트랜잭션 해시: ${result.transactionResponse.hash}`);
                
                // 인코딩된 서명 확인
                const encodedSignatures = protocol.getEncodedSignatures(result.safeTransaction);
                console.log('\n📝 인코딩된 서명 정보:');
                console.log(`서명 길이: ${encodedSignatures.length} bytes`);
                console.log(`서명 수: ${result.safeTransaction.signatures.size}`);
                
            } catch (error) {
                console.log('❌ Safe Protocol Kit 트랜잭션 실행 실패:', error.message);
                console.log('에러 상세:', error);
            }
        } else {
            console.log('\n💡 Safe Protocol Kit 트랜잭션 테스트를 실행하려면:');
            console.log('   .env 파일에서 TEST_SAFE_TRANSACTION=true로 설정하세요.');
        }
        
    } catch (error) {
        console.error('❌ 테스트 실행 실패:', error.message);
        console.error('스택 트레이스:', error.stack);
    }
}

// 스크립트 실행
if (require.main === module) {
    testSafeProtocolDAO().catch(console.error);
}

module.exports = testSafeProtocolDAO;
