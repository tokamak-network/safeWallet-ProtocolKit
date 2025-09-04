const { ethers } = require('ethers');
require('dotenv').config();

class SimpleConfirmTest {
    constructor(config) {
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        this.safeWallet = new ethers.Contract(
            config.safeWalletAddress,
            this.getSafeWalletABI(),
            this.provider
        );
        this.daoContract = new ethers.Contract(
            config.daoContractAddress,
            this.getDAOContractABI(),
            this.provider
        );
        
        // DAOContract를 서명자로 사용
        this.daoSigner = new ethers.Wallet(config.daoPrivateKey, this.provider);
    }

    // SafeWallet ABI (confirmTransaction 관련)
    getSafeWalletABI() {
        return [
            "function getOwners() external view returns (address[])",
            "function getThreshold() external view returns (uint256)",
            "function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) public view returns (bytes32)",
            "function approveHash(bytes32 hashToApprove) external",
            "function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) public payable returns (bool success)",
            "function nonce() public view returns (uint256)",
            "function isOwner(address owner) public view returns (bool)"
        ];
    }

    // DAOContract ABI
    getDAOContractABI() {
        return [
            "function isValidSignature(bytes32 _hash, bytes memory _signature) external view returns (bytes4 magicValue)"
        ];
    }

    // 특정 txHash에 대해 DAOContract로 confirmTransaction 테스트
    async testConfirmTransaction(txHash) {
        console.log('🧪 특정 txHash에 대한 confirmTransaction 테스트 시작...');
        console.log(`📝 테스트할 txHash: ${txHash}`);
        
        try {
            // 1. SafeWallet이 DAOContract를 소유자로 인식하는지 확인
            const daoAddress = await this.daoContract.getAddress();
            console.log(`🏛️ DAOContract 주소: ${daoAddress}`);
            
            const isOwner = await this.safeWallet.isOwner(daoAddress);
            console.log(`🔍 DAOContract가 SafeWallet 소유자인가?: ${isOwner}`);
            
            if (!isOwner) {
                throw new Error('DAOContract가 SafeWallet의 소유자가 아닙니다.');
            }

            // 2. DAOContract로 서명 생성
            console.log('✍️ DAOContract로 서명 생성 중...');
            const signature = await this.daoSigner.signMessage(ethers.getBytes(txHash));
            console.log('✅ DAOContract 서명 완료');

            // 3. DAOContract 서명 검증
            console.log('🔍 DAOContract 서명 검증 중...');
            const isValid = await this.daoContract.isValidSignature(txHash, signature);
            const MAGICVALUE = '0x20c13b0b';
            
            if (isValid === MAGICVALUE) {
                console.log('✅ DAOContract 서명 검증 성공!');
            } else {
                console.log('❌ DAOContract 서명 검증 실패!');
                return false;
            }

            // 4. SafeWallet에 서명 승인 (approveHash)
            console.log('🎯 SafeWallet에 서명 승인 중...');
            const safeWalletWithDAO = this.safeWallet.connect(this.daoSigner);
            const approveTx = await safeWalletWithDAO.approveHash(txHash);
            
            console.log('✅ 서명 승인 성공!');
            console.log(`📋 승인 트랜잭션 해시: ${approveTx.hash}`);
            
            // 트랜잭션 완료 대기
            await approveTx.wait();
            console.log('✅ 트랜잭션 완료 확인됨');

            return {
                success: true,
                txHash,
                signature,
                approveTx: approveTx.hash
            };

        } catch (error) {
            console.error('❌ confirmTransaction 테스트 실패:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 현재 상태 확인
    async checkStatus() {
        console.log('📊 현재 상태 확인...');
        
        try {
            // SafeWallet 정보
            const safeOwners = await this.safeWallet.getOwners();
            const safeThreshold = await this.safeWallet.getThreshold();
            console.log(`🏦 SafeWallet 소유자 수: ${safeOwners.length}, 임계값: ${safeThreshold}`);
            
            // DAOContract 주소
            const daoAddress = await this.daoContract.getAddress();
            console.log(`🏛️ DAOContract 주소: ${daoAddress}`);
            
            // DAOContract가 SafeWallet 소유자인지 확인
            const isOwner = await this.safeWallet.isOwner(daoAddress);
            console.log(`🔍 DAOContract가 SafeWallet 소유자인가?: ${isOwner}`);

            return {
                safeWallet: { 
                    owners: safeOwners.length, 
                    threshold: safeThreshold,
                    daoIsOwner: isOwner
                },
                daoContract: { address: daoAddress }
            };
            
        } catch (error) {
            console.error('❌ 상태 확인 중 오류:', error.message);
            throw error;
        }
    }
}

// 사용 예제
async function main() {
    // 환경 변수에서 설정 로드
    const config = {
        rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
        safeWalletAddress: process.env.SAFE_WALLET_ADDRESS,
        daoContractAddress: process.env.DAO_CONTRACT_ADDRESS,
        daoPrivateKey: process.env.DAO_PRIVATE_KEY
    };

    // 필수 설정 확인
    if (!config.safeWalletAddress || !config.daoContractAddress || !config.daoPrivateKey) {
        console.error('❌ 필수 환경 변수가 설정되지 않았습니다.');
        console.log('다음 환경 변수들을 설정해주세요:');
        console.log('- SAFE_WALLET_ADDRESS');
        console.log('- DAO_CONTRACT_ADDRESS');
        console.log('- DAO_PRIVATE_KEY');
        return;
    }

    try {
        const test = new SimpleConfirmTest(config);
        
        // 상태 확인
        await test.checkStatus();
        
        // 테스트할 txHash (환경변수에서 가져오거나 기본값 사용)
        const testTxHash = process.env.TEST_TX_HASH || '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
        
        console.log('\n🧪 특정 txHash에 대한 confirmTransaction 테스트...');
        const result = await test.testConfirmTransaction(testTxHash);
        
        if (result.success) {
            console.log('\n🎉 테스트 성공!');
            console.log(`📋 승인된 txHash: ${result.txHash}`);
            console.log(`📋 승인 트랜잭션: ${result.approveTx}`);
        } else {
            console.log('\n❌ 테스트 실패!');
            console.log(`오류: ${result.error}`);
        }
        
    } catch (error) {
        console.error('❌ 스크립트 실행 실패:', error.message);
        process.exit(1);
    }
}

// 스크립트가 직접 실행될 때만 main 함수 호출
if (require.main === module) {
    main().catch(console.error);
}

module.exports = SimpleConfirmTest;
