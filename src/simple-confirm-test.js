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
        this.multiSigWallet = new ethers.Contract(
            config.multiSigWalletAddress,
            this.getMultiSigWalletABI(),
            this.provider
        );
        
        // MultiSigWallet 서명자들 (DAOContract의 소유자들)
        this.multiSigSigners = config.multiSigSigners.map(signer => 
            new ethers.Wallet(signer.privateKey, this.provider)
        );
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
            "function isValidSignature(bytes32 _hash, bytes memory _signature) external view returns (bytes4 magicValue)",
            "function multiSigWallet() external view returns (address)"
        ];
    }

    // MultiSigWallet ABI
    getMultiSigWalletABI() {
        return [
            "function getOwners() external view returns (address[])",
            "function getConfirmationCount() external view returns (uint256)",
            "function getTransactionCount(bool pending, bool executed) external view returns (uint256)",
            "function getTransaction(uint256 transactionId) external view returns (address to, uint256 value, bytes data, bool executed, uint256 numConfirmations)",
            "function submitTransaction(address destination, uint256 value, bytes data) external returns (uint256 transactionId)",
            "function confirmTransaction(uint256 transactionId) external",
            "function executeTransaction(uint256 transactionId) external",
            "function isOwner(address owner) external view returns (bool)",
            "function numConfirmationsRequired() external view returns (uint256)"
        ];
    }

    // MultiSigWallet 서명자들의 서명 수집
    async collectMultiSigSignatures(hash) {
        console.log('🔍 MultiSigWallet 서명 수집 시작...');
        
        const requiredConfirmations = await this.multiSigWallet.numConfirmationsRequired();
        console.log(`📋 필요한 서명 수: ${requiredConfirmations}`);
        
        const signatures = [];
        let validSigners = 0;
        
        for (let i = 0; i < this.multiSigSigners.length && validSigners < requiredConfirmations; i++) {
            const signer = this.multiSigSigners[i];
            const signerAddress = await signer.getAddress();
            
            // MultiSigWallet의 소유자인지 확인
            const isOwner = await this.multiSigWallet.isOwner(signerAddress);
            if (!isOwner) {
                console.log(`❌ ${signerAddress}는 MultiSigWallet 소유자가 아닙니다.`);
                continue;
            }
            
            try {
                // 서명 생성
                const signature = await signer.signMessage(ethers.getBytes(hash));
                signatures.push(signature);
                validSigners++;
                console.log(`✅ ${signerAddress} 서명 완료 (${validSigners}/${requiredConfirmations})`);
            } catch (error) {
                console.log(`❌ ${signerAddress} 서명 실패:`, error.message);
            }
        }
        
        if (validSigners < requiredConfirmations) {
            throw new Error(`충분한 서명을 수집하지 못했습니다. (${validSigners}/${requiredConfirmations})`);
        }
        
        // 서명들을 연결
        const combinedSignature = ethers.concat(signatures);
        console.log(`🎯 총 ${validSigners}개의 서명을 수집했습니다.`);
        
        return combinedSignature;
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

            // 2. MultiSigWallet 서명자들의 서명 수집 (DAOContract의 소유자들)
            console.log('✍️ MultiSigWallet 서명자들로 서명 생성 중...');
            const multiSigSignature = await this.collectMultiSigSignatures(txHash);

            // 3. DAOContract 서명 검증 (EIP-1271)
            console.log('🔍 DAOContract 서명 검증 중...');
            const isValid = await this.daoContract.isValidSignature(txHash, multiSigSignature);
            const MAGICVALUE = '0x20c13b0b';
            
            if (isValid === MAGICVALUE) {
                console.log('✅ DAOContract 서명 검증 성공!');
            } else {
                console.log('❌ DAOContract 서명 검증 실패!');
                return false;
            }

            // 4. SafeWallet에 서명 승인 (approveHash) - MultiSigWallet 서명자 중 하나를 통해
            console.log('🎯 SafeWallet에 서명 승인 중...');
            
            // MultiSigWallet 서명자 중 첫 번째를 사용하여 트랜잭션 실행
            const signer = this.multiSigSigners[0];
            const safeWalletWithSigner = this.safeWallet.connect(signer);
            
            // DAOContract의 서명을 사용하여 트랜잭션 실행
            const tx = await safeWalletWithSigner.execTransaction(
                ethers.ZeroAddress, // to (빈 트랜잭션)
                0, // value
                '0x', // data
                0, // operation
                0, // safeTxGas
                0, // baseGas
                0, // gasPrice
                ethers.ZeroAddress, // gasToken
                ethers.ZeroAddress, // refundReceiver
                multiSigSignature // signatures
            );
            
            console.log('✅ DAOContract 서명 승인 성공!');
            console.log(`📋 승인 트랜잭션 해시: ${tx.hash}`);
            
            // 트랜잭션 완료 대기
            await tx.wait();
            console.log('✅ 트랜잭션 완료 확인됨');

            return {
                success: true,
                txHash,
                signature: multiSigSignature,
                approveTx: tx.hash
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
            
            // DAOContract 정보
            const daoAddress = await this.daoContract.getAddress();
            const daoMultiSig = await this.daoContract.multiSigWallet();
            console.log(`🏛️ DAOContract 주소: ${daoAddress}`);
            console.log(`🔐 DAOContract의 MultiSigWallet: ${daoMultiSig}`);
            
            // DAOContract가 SafeWallet 소유자인지 확인
            const isOwner = await this.safeWallet.isOwner(daoAddress);
            console.log(`🔍 DAOContract가 SafeWallet 소유자인가?: ${isOwner}`);

            // MultiSigWallet 정보
            const multiSigOwners = await this.multiSigWallet.getOwners();
            const multiSigThreshold = await this.multiSigWallet.numConfirmationsRequired();
            console.log(`🔐 MultiSigWallet 소유자 수: ${multiSigOwners.length}, 임계값: ${multiSigThreshold}`);

            return {
                safeWallet: { 
                    owners: safeOwners.length, 
                    threshold: safeThreshold,
                    daoIsOwner: isOwner
                },
                daoContract: { 
                    address: daoAddress,
                    multiSigWallet: daoMultiSig
                },
                multiSigWallet: { 
                    owners: multiSigOwners.length, 
                    threshold: multiSigThreshold 
                }
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
