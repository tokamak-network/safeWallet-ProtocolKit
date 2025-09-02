const { ethers } = require('ethers');
const Safe = require('@safe-global/protocol-kit').default;
const { SigningMethod } = require('@safe-global/protocol-kit');
require('dotenv').config();

// EIP-1271 Magic Values
const MAGICVALUE = '0x1626ba7e';
const INVALID_SIGNATURE = '0x00000000';

class SafeProtocolDAOProtocol {
    constructor(config) {
        this.config = config;
        this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
        
        // MultiSigWallet 서명자들의 지갑
        this.multiSigSigners = config.multiSigSigners.map(signer => 
            new ethers.Wallet(signer.privateKey, this.provider)
        );
        
        // SafeWallet의 다른 서명자 (Signer1, Signer3)
        this.safeSigners = config.safeSigners.map(signer => 
            new ethers.Wallet(signer.privateKey, this.provider)
        );
    }

    // Safe Protocol Kit 초기화
    async initializeSafeProtocol() {
        console.log('🔧 Safe Protocol Kit 초기화 중...');
        
        try {
            // Signer1으로 Safe Protocol Kit 초기화
            const signer1 = this.safeSigners[0];
            
            // Safe Protocol Kit 초기화 - 최신 버전 방식
            this.protocolKit = await Safe.init({
                provider: this.provider,
                signer: signer1, // Wallet 객체를 직접 전달
                safeAddress: this.config.safeWalletAddress
            });
            
            console.log('✅ Safe Protocol Kit 초기화 완료');
            return this.protocolKit;
            
        } catch (error) {
            console.error('❌ Safe Protocol Kit 초기화 실패:', error.message);
            console.error('에러 상세:', error);
            
            // 대안 방법: ethers v5 호환성 문제일 수 있으므로 다른 방식으로 시도
            try {
                console.log('🔄 대안 방법으로 재시도 중...');
                
                // ethers v5 스타일로 시도
                const providerV5 = new ethers.providers.JsonRpcProvider(this.config.rpcUrl);
                const signerV5 = new ethers.Wallet(signer1.privateKey, providerV5);
                
                this.protocolKit = await Safe.init({
                    provider: providerV5,
                    signer: signerV5,
                    safeAddress: this.config.safeWalletAddress
                });
                
                console.log('✅ 대안 방법으로 Safe Protocol Kit 초기화 완료');
                return this.protocolKit;
                
            } catch (altError) {
                console.error('❌ 대안 방법도 실패:', altError.message);
                throw error; // 원래 에러를 던짐
            }
        }
    }

    // MultiSigWallet 서명자들의 서명 수집
    async collectMultiSigSignatures(hash) {
        console.log('🔍 MultiSigWallet 서명 수집 시작...');
        
        const requiredConfirmations = 2; // 2/3 설정
        console.log(`📋 필요한 서명 수: ${requiredConfirmations}`);
        
        const signatures = [];
        let validSigners = 0;
        
        for (let i = 0; i < this.multiSigSigners.length && validSigners < requiredConfirmations; i++) {
            const signer = this.multiSigSigners[i];
            const signerAddress = await signer.getAddress();
            
            try {
                // 서명 생성
                const signature = await signer.signMessage(ethers.utils.arrayify(hash));
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
        const combinedSignature = ethers.utils.hexConcat(signatures);
        console.log(`🎯 총 ${validSigners}개의 서명을 수집했습니다.`);
        
        return combinedSignature;
    }

    // DAOContract 서명 검증 테스트
    async testDAOContractSignature(hash, signature) {
        console.log('🧪 DAOContract 서명 검증 테스트...');
        
        try {
            const daoContract = new ethers.Contract(
                this.config.daoContractAddress,
                [
                    "function isValidSignature(bytes32 _hash, bytes memory _signature) external view returns (bytes4 magicValue)"
                ],
                this.provider
            );
            
            const result = await daoContract.isValidSignature(hash, signature);
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

    // Safe Protocol Kit을 사용한 트랜잭션 생성 및 서명
    async createAndSignTransaction(to, value, data) {
        console.log('📝 Safe Protocol Kit으로 트랜잭션 생성 및 서명 시작...');
        
        try {
            // 1. Safe Protocol Kit 초기화
            await this.initializeSafeProtocol();
            
            // 2. 트랜잭션 데이터 생성
            const safeTransactionData = {
                to: to,
                value: value.toString(),
                data: data
            };
            
            console.log('📋 트랜잭션 데이터:', safeTransactionData);
            
            // 3. Safe 트랜잭션 생성
            let safeTransaction = await this.protocolKit.createTransaction({
                transactions: [safeTransactionData]
            });
            
            console.log('✅ Safe 트랜잭션 생성 완료');
            console.log(`📝 트랜잭션 해시: ${safeTransaction.data.safeTxHash}`);
            
            // 4. Signer1 서명 (ECDSA)
            console.log('✍️ Signer1 서명 중...');
            safeTransaction = await this.protocolKit.signTransaction(
                safeTransaction,
                SigningMethod.ETH_SIGN
            );
            console.log('✅ Signer1 서명 완료');
            
            // 5. MultiSigWallet 서명자들의 서명 수집
            const multiSigSignature = await this.collectMultiSigSignatures(safeTransaction.data.safeTxHash);
            
            // 6. DAOContract 서명 검증 테스트
            const isValid = await this.testDAOContractSignature(safeTransaction.data.safeTxHash, multiSigSignature);
            if (!isValid) {
                throw new Error('DAOContract 서명 검증 실패');
            }
            
            // 7. DAOContract 서명을 Safe 트랜잭션에 추가
            console.log('🏛️ DAOContract 서명을 Safe 트랜잭션에 추가 중...');
            
            // DAOContract 주소를 서명자로 추가
            const daoContractAddress = this.config.daoContractAddress;
            
            // 서명 데이터를 Safe 형식으로 변환
            // Safe는 서명을 특정 형식으로 저장하므로 이를 맞춰줘야 함
            const daoSignature = {
                signer: daoContractAddress,
                data: multiSigSignature,
                isContractSignature: true
            };
            
            // 서명을 Safe 트랜잭션에 추가
            safeTransaction.signatures.set(daoContractAddress, daoSignature);
            
            console.log('✅ DAOContract 서명 추가 완료');
            console.log(`📊 총 서명 수: ${safeTransaction.signatures.size}`);
            
            return safeTransaction;
            
        } catch (error) {
            console.error('❌ Safe Protocol Kit 트랜잭션 생성 실패:', error.message);
            throw error;
        }
    }

    // Safe Protocol Kit을 사용한 트랜잭션 실행
    async executeSafeTransaction(to, value, data) {
        console.log('🚀 Safe Protocol Kit으로 트랜잭션 실행 시작...');
        
        try {
            // 1. 트랜잭션 생성 및 서명
            const safeTransaction = await this.createAndSignTransaction(to, value, data);
            
            // 2. 트랜잭션 실행
            console.log('🎯 Safe 트랜잭션 실행 중...');
            const transactionResponse = await this.protocolKit.executeTransaction(safeTransaction);
            
            console.log('✅ Safe 트랜잭션 실행 성공!');
            console.log(`📋 트랜잭션 해시: ${transactionResponse.hash}`);
            
            return {
                safeTransaction,
                transactionResponse
            };
            
        } catch (error) {
            console.error('❌ Safe Protocol Kit 트랜잭션 실행 실패:', error.message);
            throw error;
        }
    }

    // 현재 상태 확인
    async checkStatus() {
        console.log('📊 현재 상태 확인...');
        
        try {
            await this.initializeSafeProtocol();
            
            // SafeWallet 정보
            const safeInfo = await this.protocolKit.getSafeInfo();
            console.log(`🏦 SafeWallet 소유자 수: ${safeInfo.owners.length}, 임계값: ${safeInfo.threshold}`);
            console.log(`🏦 SafeWallet 주소: ${safeInfo.address}`);
            
            // DAOContract 정보
            const daoContract = new ethers.Contract(
                this.config.daoContractAddress,
                [
                    "function multiSigWallet() external view returns (address)"
                ],
                this.provider
            );
            
            const daoMultiSig = await daoContract.multiSigWallet();
            console.log(`🏛️ DAOContract의 MultiSigWallet: ${daoMultiSig}`);
            
            return {
                safeWallet: { 
                    owners: safeInfo.owners.length, 
                    threshold: safeInfo.threshold,
                    address: safeInfo.address
                },
                daoContract: { multiSigWallet: daoMultiSig }
            };
            
        } catch (error) {
            console.error('❌ 상태 확인 중 오류:', error.message);
            throw error;
        }
    }

    // 서명된 트랜잭션의 인코딩된 서명 반환
    getEncodedSignatures(safeTransaction) {
        console.log('🔐 인코딩된 서명 생성 중...');
        
        try {
            const encodedSignatures = safeTransaction.encodedSignatures();
            console.log(`📝 인코딩된 서명 길이: ${encodedSignatures.length} bytes`);
            console.log(`📝 인코딩된 서명: ${encodedSignatures}`);
            
            return encodedSignatures;
            
        } catch (error) {
            console.error('❌ 서명 인코딩 실패:', error.message);
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
        console.log('- SAFE_SIGNER1_PRIVATE_KEY');
        console.log('- SAFE_SIGNER3_PRIVATE_KEY');
        return;
    }

    try {
        const protocol = new SafeProtocolDAOProtocol(config);
        
        // 상태 확인
        await protocol.checkStatus();
        
        // 테스트 트랜잭션 실행
        const testTo = process.env.TEST_TO_ADDRESS || ethers.constants.AddressZero;
        const testValue = process.env.TEST_VALUE || '0';
        const testData = process.env.TEST_DATA || '0x';
        
        console.log('\n🧪 Safe Protocol Kit 테스트 트랜잭션 실행...');
        const result = await protocol.executeSafeTransaction(testTo, testValue, testData);
        
        // 인코딩된 서명 확인
        const encodedSignatures = protocol.getEncodedSignatures(result.safeTransaction);
        
        console.log('\n✅ 모든 작업 완료!');
        console.log('SafeWallet UI에서 트랜잭션을 확인할 수 있습니다.');
        
    } catch (error) {
        console.error('❌ 스크립트 실행 실패:', error.message);
        process.exit(1);
    }
}

// 스크립트가 직접 실행될 때만 main 함수 호출
if (require.main === module) {
    main().catch(console.error);
}

module.exports = SafeProtocolDAOProtocol;
