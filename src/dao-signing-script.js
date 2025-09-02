const { ethers } = require('ethers');
require('dotenv').config();

// EIP-1271 Magic Values
const MAGICVALUE = '0x1626ba7e';
const INVALID_SIGNATURE = '0x00000000';

class SafeWalletDAOProtocol {
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
        
        // MultiSigWallet 서명자들의 지갑
        this.multiSigSigners = config.multiSigSigners.map(signer => 
            new ethers.Wallet(signer.privateKey, this.provider)
        );
        
        // SafeWallet의 다른 서명자 (Signer1, Signer3)
        this.safeSigners = config.safeSigners.map(signer => 
            new ethers.Wallet(signer.privateKey, this.provider)
        );
    }

    // SafeWallet ABI (필요한 함수들만)
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
            "function multiSigWallet() external view returns (address)",
            "function hasRole(bytes32 role, address account) external view returns (bool)",
            "function DEFAULT_ADMIN_ROLE() external view returns (bytes32)"
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

    // 트랜잭션 해시 생성
    async getTransactionHash(to, value, data, operation = 0) {
        const nonce = await this.safeWallet.nonce();
        const safeTxGas = 0;
        const baseGas = 0;
        const gasPrice = 0;
        const gasToken = ethers.ZeroAddress;
        const refundReceiver = ethers.ZeroAddress;

        return await this.safeWallet.getTransactionHash(
            to, value, data, operation, safeTxGas, baseGas, gasPrice, gasToken, refundReceiver, nonce
        );
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

    // DAOContract 서명 검증 테스트
    async testDAOContractSignature(hash, signature) {
        console.log('🧪 DAOContract 서명 검증 테스트...');
        
        try {
            const result = await this.daoContract.isValidSignature(hash, signature);
            console.log(`📊 DAOContract 검증 결과: ${result}`);
            
            if (result === MAGICVALUE) {
                console.log('✅ DAOContract 서명 검증 성공!');
                return true;
            } else {
                console.log('❌ DAOContract 서명 검증 실패!');
                return false;
            }
        } catch (error) {
            console.log('❌ DAOContract 서명 검증 중 오류:', error.message);
            return false;
        }
    }

    // SafeWallet 트랜잭션 실행 (서명된 트랜잭션으로)
    async executeSafeTransaction(to, value, data, operation = 0) {
        console.log('🚀 SafeWallet 트랜잭션 실행 시작...');
        
        try {
            // 1. 트랜잭션 해시 생성
            const txHash = await this.getTransactionHash(to, value, data, operation);
            console.log(`📝 트랜잭션 해시: ${txHash}`);
            
            // 2. Signer1 서명
            console.log('✍️ Signer1 서명 중...');
            const signer1 = this.safeSigners[0];
            const signer1Signature = await signer1.signMessage(ethers.getBytes(txHash));
            console.log('✅ Signer1 서명 완료');
            
            // 3. MultiSigWallet 서명자들의 서명 수집
            const multiSigSignature = await this.collectMultiSigSignatures(txHash);
            
            // 4. DAOContract 서명 검증 테스트
            const isValid = await this.testDAOContractSignature(txHash, multiSigSignature);
            if (!isValid) {
                throw new Error('DAOContract 서명 검증 실패');
            }
            
            // 5. 서명들을 결합 (Signer1 + DAOContract)
            const combinedSignatures = ethers.concat([signer1Signature, multiSigSignature]);
            
            // 6. 서명된 트랜잭션을 Signer1의 지갑으로 실행
            console.log('🎯 SafeWallet 트랜잭션 실행 중...');
            const safeWalletWithSigner = this.safeWallet.connect(signer1);
            const tx = await safeWalletWithSigner.execTransaction(
                to, value, data, operation, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, combinedSignatures
            );
            
            console.log('✅ 트랜잭션 실행 성공!');
            console.log(`📋 트랜잭션 해시: ${tx.hash}`);
            
            return tx;
            
        } catch (error) {
            console.error('❌ SafeWallet 트랜잭션 실행 실패:', error.message);
            throw error;
        }
    }

    // SafeWallet에 서명만 제출하는 방법 (트랜잭션 실행 없이)
    async submitSignatureToSafeWallet(to, value, data, operation = 0) {
        console.log('📝 SafeWallet에 서명 제출 시작...');
        
        try {
            // 1. 트랜잭션 해시 생성
            const txHash = await this.getTransactionHash(to, value, data, operation);
            console.log(`📝 트랜잭션 해시: ${txHash}`);
            
            // 2. Signer1 서명
            console.log('✍️ Signer1 서명 중...');
            const signer1 = this.safeSigners[0];
            const signer1Signature = await signer1.signMessage(ethers.getBytes(txHash));
            console.log('✅ Signer1 서명 완료');
            
            // 3. MultiSigWallet 서명자들의 서명 수집
            const multiSigSignature = await this.collectMultiSigSignatures(txHash);
            
            // 4. DAOContract 서명 검증 테스트
            const isValid = await this.testDAOContractSignature(txHash, multiSigSignature);
            if (!isValid) {
                throw new Error('DAOContract 서명 검증 실패');
            }
            
            // 5. 서명들을 결합 (Signer1 + DAOContract)
            const combinedSignatures = ethers.concat([signer1Signature, multiSigSignature]);
            
            // 6. approveHash를 통해 서명 승인 (트랜잭션 실행 없이)
            console.log('🎯 SafeWallet에 서명 승인 중...');
            const safeWalletWithSigner = this.safeWallet.connect(signer1);
            const approveTx = await safeWalletWithSigner.approveHash(txHash);
            
            console.log('✅ 서명 승인 성공!');
            console.log(`📋 승인 트랜잭션 해시: ${approveTx.hash}`);
            
            return {
                txHash,
                signatures: combinedSignatures,
                approveTx
            };
            
        } catch (error) {
            console.error('❌ SafeWallet 서명 제출 실패:', error.message);
            throw error;
        }
    }

    // DAOContract를 통해 서명을 SafeWallet에 제출하는 방법
    async submitDAOSignatureToSafeWallet(to, value, data, operation = 0) {
        console.log('🏛️ DAOContract를 통한 SafeWallet 서명 제출 시작...');
        
        try {
            // 1. 트랜잭션 해시 생성
            const txHash = await this.getTransactionHash(to, value, data, operation);
            console.log(`📝 트랜잭션 해시: ${txHash}`);
            
            // 2. MultiSigWallet 서명자들의 서명 수집
            const multiSigSignature = await this.collectMultiSigSignatures(txHash);
            
            // 3. DAOContract 서명 검증 테스트
            const isValid = await this.testDAOContractSignature(txHash, multiSigSignature);
            if (!isValid) {
                throw new Error('DAOContract 서명 검증 실패');
            }
            
            // 4. DAOContract를 통해 서명 제출
            console.log('🎯 DAOContract를 통해 SafeWallet에 서명 제출 중...');
            
            // DAOContract의 주소를 서명자로 사용하여 서명 제출
            const daoContractAddress = await this.daoContract.getAddress();
            console.log(`🏛️ DAOContract 주소: ${daoContractAddress}`);
            
            // SafeWallet의 approveHash를 DAOContract 주소로 호출
            // 이는 DAOContract가 SafeWallet의 서명자로 등록되어 있어야 함
            const safeWalletWithDAO = this.safeWallet.connect(this.provider);
            
            // DAOContract의 서명을 직접 사용하여 트랜잭션 실행
            const tx = await safeWalletWithDAO.execTransaction(
                to, value, data, operation, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, multiSigSignature
            );
            
            console.log('✅ DAOContract 서명 제출 성공!');
            console.log(`📋 트랜잭션 해시: ${tx.hash}`);
            
            return {
                txHash,
                signatures: multiSigSignature,
                tx
            };
            
        } catch (error) {
            console.error('❌ DAOContract 서명 제출 실패:', error.message);
            throw error;
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
            const daoMultiSig = await this.daoContract.multiSigWallet();
            console.log(`🏛️ DAOContract의 MultiSigWallet: ${daoMultiSig}`);
            
            // MultiSigWallet 정보
            const multiSigOwners = await this.multiSigWallet.getOwners();
            const multiSigThreshold = await this.multiSigWallet.numConfirmationsRequired();
            console.log(`🔐 MultiSigWallet 소유자 수: ${multiSigOwners.length}, 임계값: ${multiSigThreshold}`);
            
            return {
                safeWallet: { owners: safeOwners.length, threshold: safeThreshold },
                daoContract: { multiSigWallet: daoMultiSig },
                multiSigWallet: { owners: multiSigOwners.length, threshold: multiSigThreshold }
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
        ],
        safeSigners: [
            { privateKey: process.env.SAFE_SIGNER1_PRIVATE_KEY },
            { privateKey: process.env.SAFE_SIGNER3_PRIVATE_KEY }
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
        console.log('- MULTISIG_SIGNER3_PRIVATE_KEY');
        console.log('- SAFE_SIGNER1_PRIVATE_KEY');
        console.log('- SAFE_SIGNER3_PRIVATE_KEY');
        return;
    }

    try {
        const protocol = new SafeWalletDAOProtocol(config);
        
        // 상태 확인
        await protocol.checkStatus();
        
        // 테스트 트랜잭션 실행
        const testTo = process.env.TEST_TO_ADDRESS || ethers.ZeroAddress;
        const testValue = process.env.TEST_VALUE || '0';
        const testData = process.env.TEST_DATA || '0x';
        
        console.log('\n🧪 테스트 트랜잭션 실행...');
        await protocol.executeSafeTransaction(testTo, testValue, testData);
        
    } catch (error) {
        console.error('❌ 스크립트 실행 실패:', error.message);
        process.exit(1);
    }
}

// 스크립트가 직접 실행될 때만 main 함수 호출
if (require.main === module) {
    main().catch(console.error);
}

module.exports = SafeWalletDAOProtocol;
