const { ethers } = require('ethers');
require('dotenv').config();

// EIP-1271 Magic Values
const MAGICVALUE = '0x1626ba7e';
const INVALID_SIGNATURE = '0x00000000';

class PureEthersDAOProtocol {
    constructor(config) {
        this.config = config;
        this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
        
        // MultiSigWallet 서명자들의 지갑
        this.multiSigSigners = config.multiSigSigners.map(signer => 
            new ethers.Wallet(signer.privateKey, this.provider)
        );
        
        // SafeWallet의 다른 서명자 (Signer1, Signer3)
        this.safeSigners = config.safeSigners.map(signer => 
            new ethers.Wallet(signer.privateKey, this.provider)
        );
        
        // SafeWallet 컨트랙트
        this.safeWallet = new ethers.Contract(
            config.safeWalletAddress,
            this.getSafeWalletABI(),
            this.provider
        );
        
        // DAOContract
        this.daoContract = new ethers.Contract(
            config.daoContractAddress,
            this.getDAOContractABI(),
            this.provider
        );
    }

    // SafeWallet ABI
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
                // 서명 생성 - DAOContract가 기대하는 형식으로
                const signature = await signer.signMessage(ethers.getBytes(hash));
                signatures.push(signature);
                validSigners++;
                console.log(`✅ ${signerAddress} 서명 완료 (${validSigners}/${requiredConfirmations})`);
                console.log(`   서명: ${signature}`);
            } catch (error) {
                console.log(`❌ ${signerAddress} 서명 실패:`, error.message);
            }
        }
        
        if (validSigners < requiredConfirmations) {
            throw new Error(`충분한 서명을 수집하지 못했습니다. (${validSigners}/${requiredConfirmations})`);
        }
        
        // 서명들을 연결 (DAOContract가 기대하는 형식: 65바이트씩 연결)
        const combinedSignature = ethers.concat(signatures);
        console.log(`🎯 총 ${validSigners}개의 서명을 수집했습니다.`);
        console.log(`📝 결합된 서명 길이: ${combinedSignature.length} bytes (예상: ${validSigners * 65} bytes)`);
        console.log(`📝 결합된 서명: ${combinedSignature}`);
        
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

    // SafeWallet 트랜잭션 해시 생성 (Safe Protocol Kit 방식)
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

    // SafeWallet 트랜잭션 데이터 생성 (Safe Protocol Kit 방식)
    createSafeTransactionData(to, value, data, operation = 0) {
        return {
            to: to,
            value: value.toString(),
            data: data,
            operation: operation,
            baseGas: "0",
            gasPrice: "0",
            gasToken: ethers.ZeroAddress,
            refundReceiver: ethers.ZeroAddress,
            safeTxGas: "0"
        };
    }

    // SafeWallet 트랜잭션 해시 생성 (올바른 방식)
    async getSafeTransactionHash(safeTransactionData) {
        const nonce = await this.safeWallet.nonce();
        
        // SafeWallet의 getTransactionHash 함수 호출
        return await this.safeWallet.getTransactionHash(
            safeTransactionData.to,
            safeTransactionData.value,
            safeTransactionData.data,
            safeTransactionData.operation,
            safeTransactionData.safeTxGas,
            safeTransactionData.baseGas,
            safeTransactionData.gasPrice,
            safeTransactionData.gasToken,
            safeTransactionData.refundReceiver,
            nonce
        );
    }

    // SafeWallet에 서명 제출 (approveHash 사용)
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
            
            // 5. Signer1으로 approveHash 호출
            console.log('🎯 SafeWallet에 서명 승인 중...');
            const safeWalletWithSigner = this.safeWallet.connect(signer1);
            const approveTx = await safeWalletWithSigner.approveHash(txHash);
            
            console.log('✅ Signer1 서명 승인 성공!');
            console.log(`📋 승인 트랜잭션 해시: ${approveTx.hash}`);
            
            // 6. DAOContract를 통한 서명 제출 시도
            console.log('🏛️ DAOContract를 통한 서명 제출 시도...');
            
            // DAOContract 주소를 서명자로 사용하여 서명 제출
            const daoContractAddress = this.config.daoContractAddress;
            console.log(`🏛️ DAOContract 주소: ${daoContractAddress}`);
            
            // DAOContract가 SafeWallet의 소유자인지 확인
            const isOwner = await this.safeWallet.isOwner(daoContractAddress);
            console.log(`🔍 DAOContract가 SafeWallet 소유자인가? ${isOwner}`);
            
            if (isOwner) {
                // DAOContract를 통해 서명 제출
                const daoContractWithSigner = this.daoContract.connect(signer1);
                
                // DAOContract의 approveHash를 호출하려고 시도
                // 하지만 DAOContract에 approveHash 함수가 없으므로 다른 방법 사용
                console.log('💡 DAOContract를 통한 직접 서명 제출은 제한적입니다.');
                console.log('💡 대신 execTransaction을 통해 서명을 검증할 수 있습니다.');
                
                return {
                    txHash,
                    signer1Signature,
                    multiSigSignature,
                    approveTx,
                    daoContractAddress,
                    isOwner
                };
            } else {
                throw new Error('DAOContract가 SafeWallet의 소유자가 아닙니다.');
            }
            
        } catch (error) {
            console.error('❌ SafeWallet 서명 제출 실패:', error.message);
            throw error;
        }
    }

    // SafeWallet 서명 형식 변환
    formatSignatureForSafe(signerAddress, signature) {
        // SafeWallet은 서명을 특정 형식으로 받아야 함
        // 형식: signerAddress (32 bytes) + signature (65 bytes)
        const signerAddressPadded = ethers.zeroPadValue(signerAddress, 32);
        return ethers.concat([signerAddressPadded, signature]);
    }

    // SafeWallet 서명 형식 (더 정확한 방법)
    createSafeSignature(signerAddress, signature) {
        // SafeWallet 서명 형식:
        // - signerAddress (32 bytes, padded)
        // - signature (65 bytes)
        const signerAddressPadded = ethers.zeroPadValue(signerAddress, 32);
        return ethers.concat([signerAddressPadded, signature]);
    }

    // SafeWallet 서명 배열 생성
    createSafeSignatures(signatures) {
        // 서명들을 SafeWallet 형식으로 변환하고 결합
        let result = '0x';
        
        for (const sig of signatures) {
            const formattedSig = this.createSafeSignature(sig.signer, sig.signature);
            result += formattedSig.slice(2); // '0x' 제거하고 추가
        }
        
        return result;
    }

    // SafeWallet 트랜잭션 실행 (올바른 방식)
    async executeSafeTransaction(to, value, data, operation = 0) {
        console.log('🚀 SafeWallet 트랜잭션 실행 시작...');
        
        try {
            // 1. SafeWallet 트랜잭션 데이터 생성
            const safeTransactionData = this.createSafeTransactionData(to, value, data, operation);
            console.log('📋 SafeWallet 트랜잭션 데이터:', safeTransactionData);
            
            // 2. SafeWallet 트랜잭션 해시 생성 (올바른 방식)
            const txHash = await this.getSafeTransactionHash(safeTransactionData);
            console.log(`📝 SafeWallet 트랜잭션 해시: ${txHash}`);
            
            // 3. Signer1 서명
            console.log('✍️ Signer1 서명 중...');
            const signer1 = this.safeSigners[0];
            const signer1Address = await signer1.getAddress();
            const signer1Signature = await signer1.signMessage(ethers.getBytes(txHash));
            console.log('✅ Signer1 서명 완료');
            
            // 4. MultiSigWallet 서명자들의 서명 수집
            const multiSigSignature = await this.collectMultiSigSignatures(txHash);
            
            // 5. DAOContract 서명 검증 테스트
            const isValid = await this.testDAOContractSignature(txHash, multiSigSignature);
            if (!isValid) {
                throw new Error('DAOContract 서명 검증 실패');
            }
            
            // 6. SafeWallet 형식으로 서명 결합
            console.log('🔄 SafeWallet 형식으로 서명 결합 중...');
            
            // SafeWallet은 각 서명이 어떤 서명자로부터 왔는지 알아야 함
            // 형식: signerAddress (32 bytes) + signature (65 bytes) + signerAddress (32 bytes) + signature (65 bytes)
            const daoContractAddress = this.config.daoContractAddress;
            
            // Signer1 서명 형식화
            const signer1AddressPadded = ethers.zeroPadValue(signer1Address, 32);
            const signer1Formatted = ethers.concat([signer1AddressPadded, signer1Signature]);
            
            // DAOContract 서명 형식화 (DAOContract 주소 + MultiSigWallet 서명)
            const daoAddressPadded = ethers.zeroPadValue(daoContractAddress, 32);
            const daoFormatted = ethers.concat([daoAddressPadded, multiSigSignature]);
            
            // 최종 서명 결합
            const combinedSignatures = ethers.concat([signer1Formatted, daoFormatted]);
            console.log(`📝 결합된 서명 길이: ${combinedSignatures.length} bytes`);
            console.log(`📝 Signer1 주소: ${signer1Address}`);
            console.log(`📝 DAOContract 주소: ${daoContractAddress}`);
            
            // 7. 트랜잭션 실행
            console.log('🎯 SafeWallet 트랜잭션 실행 중...');
            const safeWalletWithSigner = this.safeWallet.connect(signer1);
            const tx = await safeWalletWithSigner.execTransaction(
                safeTransactionData.to,
                safeTransactionData.value,
                safeTransactionData.data,
                safeTransactionData.operation,
                safeTransactionData.safeTxGas,
                safeTransactionData.baseGas,
                safeTransactionData.gasPrice,
                safeTransactionData.gasToken,
                safeTransactionData.refundReceiver,
                combinedSignatures
            );
            
            console.log('✅ 트랜잭션 실행 성공!');
            console.log(`📋 트랜잭션 해시: ${tx.hash}`);
            
            return {
                txHash,
                safeTransactionData,
                signatures: combinedSignatures,
                tx
            };
            
        } catch (error) {
            console.error('❌ SafeWallet 트랜잭션 실행 실패:', error.message);
            console.error('에러 상세:', error);
            
            // GS026 에러인 경우 추가 정보 제공
            if (error.message.includes('GS026')) {
                console.log('\n💡 GS026 에러 해결 방법:');
                console.log('1. DAOContract가 SafeWallet의 소유자로 등록되어 있는지 확인');
                console.log('2. DAOContract의 isValidSignature 함수가 올바르게 구현되어 있는지 확인');
                console.log('3. MultiSigWallet의 서명이 올바른 형식인지 확인');
                console.log('4. SafeWallet의 임계값 설정이 올바른지 확인');
                console.log('5. SafeWallet 트랜잭션 해시 생성 방식이 올바른지 확인');
            }
            
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
            console.log(`🏦 SafeWallet 주소: ${this.config.safeWalletAddress}`);
            console.log(`🏦 SafeWallet 소유자들:`);
            safeOwners.forEach((owner, index) => {
                console.log(`   ${index + 1}. ${owner}`);
            });
            
            // DAOContract 정보
            const daoMultiSig = await this.daoContract.multiSigWallet();
            console.log(`🏛️ DAOContract의 MultiSigWallet: ${daoMultiSig}`);
            
            // DAOContract가 SafeWallet의 소유자인지 확인
            const isOwner = await this.safeWallet.isOwner(this.config.daoContractAddress);
            console.log(`🔍 DAOContract가 SafeWallet 소유자인가? ${isOwner}`);
            
            // Signer1이 SafeWallet의 소유자인지 확인
            const signer1Address = await this.safeSigners[0].getAddress();
            const signer1IsOwner = await this.safeWallet.isOwner(signer1Address);
            console.log(`🔍 Signer1이 SafeWallet 소유자인가? ${signer1IsOwner}`);
            console.log(`🔍 Signer1 주소: ${signer1Address}`);
            
            // 현재 nonce 확인
            const nonce = await this.safeWallet.nonce();
            console.log(`🔢 현재 nonce: ${nonce}`);
            
            return {
                safeWallet: { 
                    owners: safeOwners.length, 
                    threshold: safeThreshold,
                    address: this.config.safeWalletAddress,
                    ownersList: safeOwners
                },
                daoContract: { 
                    multiSigWallet: daoMultiSig,
                    address: this.config.daoContractAddress,
                    isOwner: isOwner
                },
                signer1: {
                    address: signer1Address,
                    isOwner: signer1IsOwner
                },
                nonce: nonce
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
        console.log('- SAFE_SIGNER1_PRIVATE_KEY');
        console.log('- SAFE_SIGNER3_PRIVATE_KEY');
        return;
    }

    try {
        const protocol = new PureEthersDAOProtocol(config);
        
        // 상태 확인
        await protocol.checkStatus();
        
        // 테스트 트랜잭션 실행
        const testTo = process.env.TEST_TO_ADDRESS || ethers.ZeroAddress;
        const testValue = process.env.TEST_VALUE || '0';
        const testData = process.env.TEST_DATA || '0x';
        
        console.log('\n🧪 순수 ethers 테스트 트랜잭션 실행...');
        const result = await protocol.executeSafeTransaction(testTo, testValue, testData);
        
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

module.exports = PureEthersDAOProtocol;
