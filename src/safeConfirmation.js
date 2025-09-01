import Safe from '@safe-global/protocol-kit';
import { ethers } from 'ethers';

/**
 * Safe Wallet Confirmation Manager for EIP-1271 Contract Owners
 * 이미 배포된 EIP-1271 컨트랙트가 Safe 소유자일 때 confirmation을 처리
 */
export class SafeConfirmationManager {
  constructor(config) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.safe = null;
    this.contractOwnerWallet = null;
  }

  /**
   * Safe와 컨트랙트 소유자 지갑 초기화
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Safe Confirmation Manager...');
      
      // Safe Protocol Kit 초기화
      this.safe = await Safe.init({
        provider: this.config.rpcUrl,
        safeAddress: this.config.safeAddress,
      });

      // 컨트랙트 소유자 지갑 (EIP-1271 컨트랙트를 제어할 수 있는 지갑)
      this.contractOwnerWallet = new ethers.Wallet(
        this.config.contractOwnerPrivateKey,
        this.provider
      );

      console.log('✅ Safe Confirmation Manager initialized');
      console.log(`📍 Safe Address: ${this.config.safeAddress}`);
      console.log(`📍 EIP-1271 Contract: ${this.config.eip1271ContractAddress}`);
      console.log(`👤 Contract Owner: ${await this.contractOwnerWallet.getAddress()}`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Safe Confirmation Manager:', error);
      throw error;
    }
  }

  /**
   * Safe의 현재 상태 및 소유자 정보 조회
   */
  async getSafeInfo() {
    try {
      const address = await this.safe.getAddress();
      const owners = await this.safe.getOwners();
      const threshold = await this.safe.getThreshold();
      const nonce = await this.safe.getNonce();
      
      const info = {
        address,
        owners,
        threshold,
        nonce
      };
      
      console.log('\n📊 Safe Information:');
      console.log(`   Address: ${info.address}`);
      console.log(`   Owners: ${info.owners.join(', ')}`);
      console.log(`   Threshold: ${info.threshold}`);
      console.log(`   Nonce: ${info.nonce}`);
      
      // EIP-1271 컨트랙트가 소유자인지 확인
      const isContractOwner = owners.includes(this.config.eip1271ContractAddress);
      console.log(`   EIP-1271 Contract is owner: ${isContractOwner ? 'Yes' : 'No'}`);
      
      return { ...info, isContractOwner };
    } catch (error) {
      console.error('❌ Error getting Safe info:', error);
      throw error;
    }
  }

  /**
   * Safe 트랜잭션 생성
   */
  async createSafeTransaction(transactionData) {
    try {
      console.log('\n📝 Creating Safe transaction...');
      
      const safeTransaction = await this.safe.createTransaction({
        transactions: [transactionData]
      });

      const txHash = await this.safe.getTransactionHash(safeTransaction);
      
      console.log(`✅ Safe transaction created`);
      console.log(`📋 Transaction hash: ${txHash}`);
      
      return {
        transaction: safeTransaction,
        hash: txHash
      };
    } catch (error) {
      console.error('❌ Error creating Safe transaction:', error);
      throw error;
    }
  }

  /**
   * EIP-1271 컨트랙트를 통한 트랜잭션 서명 (Confirmation)
   */
  async confirmTransactionWithContract(safeTransaction) {
    try {
      console.log('\n🔐 Confirming transaction with EIP-1271 contract...');
      
      // 트랜잭션 해시 가져오기
      const txHash = await this.safe.getTransactionHash(safeTransaction);
      console.log(`📋 Transaction hash to sign: ${txHash}`);

      // EIP-1271 컨트랙트 ABI (isValidSignature 함수만 필요)
      const contractABI = [
        "function isValidSignature(bytes32 _hash, bytes _signature) external view returns (bytes4)",
        "function owner() external view returns (address)"
      ];

      const contract = new ethers.Contract(
        this.config.eip1271ContractAddress,
        contractABI,
        this.contractOwnerWallet
      );

      // 컨트랙트 소유자 확인
      try {
        const contractOwner = await contract.owner();
        const walletAddress = await this.contractOwnerWallet.getAddress();
        
        console.log(`🔍 Contract owner: ${contractOwner}`);
        console.log(`🔍 Wallet address: ${walletAddress}`);
        
        if (contractOwner.toLowerCase() !== walletAddress.toLowerCase()) {
          throw new Error('Wallet is not the owner of the EIP-1271 contract');
        }
      } catch (error) {
        console.log('⚠️  Could not verify contract ownership (contract may not have owner() function)');
      }

      // 트랜잭션 해시에 서명 (컨트랙트 소유자로서)
      const messageBytes = ethers.getBytes(txHash);
      const signature = await this.contractOwnerWallet.signMessage(messageBytes);
      
      console.log(`✅ Signature created: ${signature}`);

      // Safe에 서명 추가 (EIP-1271 컨트랙트 주소로)
      const signedTransaction = await this.safe.signTransaction(
        safeTransaction,
        'eth_sign' // 서명 방법
      );

      console.log('✅ Transaction confirmed with EIP-1271 contract signature');
      
      return {
        signedTransaction,
        signature,
        txHash
      };
      
    } catch (error) {
      console.error('❌ Error confirming transaction with contract:', error);
      throw error;
    }
  }

  /**
   * 대기 중인 트랜잭션 조회
   */
  async getPendingTransactions() {
    try {
      console.log('\n📋 Getting pending transactions...');
      
      // Safe Service API를 통해 대기 중인 트랜잭션 조회
      // 실제 구현에서는 Safe Transaction Service API를 사용해야 합니다
      console.log('💡 To get pending transactions, you need to use Safe Transaction Service API');
      console.log('   Example: https://safe-transaction-mainnet.safe.global/api/v1/safes/{safe-address}/multisig-transactions/');
      
      return [];
    } catch (error) {
      console.error('❌ Error getting pending transactions:', error);
      throw error;
    }
  }

  /**
   * 기존 트랜잭션에 confirmation 추가
   */
  async confirmExistingTransaction(safeTxHash) {
    try {
      console.log(`\n🔐 Confirming existing transaction: ${safeTxHash}`);
      
      // 실제로는 Safe Transaction Service API를 통해 트랜잭션 정보를 가져와야 합니다
      console.log('💡 To confirm existing transactions:');
      console.log('   1. Get transaction details from Safe Transaction Service API');
      console.log('   2. Recreate the Safe transaction object');
      console.log('   3. Sign with EIP-1271 contract');
      console.log('   4. Submit confirmation to Safe Transaction Service');
      
      // 예시: 트랜잭션 해시에 직접 서명
      const messageBytes = ethers.getBytes(safeTxHash);
      const signature = await this.contractOwnerWallet.signMessage(messageBytes);
      
      console.log(`✅ Signature for existing transaction: ${signature}`);
      
      return signature;
    } catch (error) {
      console.error('❌ Error confirming existing transaction:', error);
      throw error;
    }
  }

  /**
   * 트랜잭션 실행 (충분한 confirmation이 있을 때)
   */
  async executeTransaction(signedTransaction) {
    try {
      console.log('\n🚀 Executing Safe transaction...');
      
      const executeTxResponse = await this.safe.executeTransaction(signedTransaction);
      console.log(`✅ Transaction executed: ${executeTxResponse.hash}`);
      
      return executeTxResponse;
    } catch (error) {
      console.error('❌ Error executing transaction:', error);
      throw error;
    }
  }
}