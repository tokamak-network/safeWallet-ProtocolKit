import { ethers } from 'ethers';

/**
 * Safe Transaction Service API 클라이언트
 * 실제 Safe Service와 상호작용하여 트랜잭션 제안, 확인, 실행
 */
export class SafeServiceClient {
  constructor(chainId, safeAddress) {
    this.chainId = chainId;
    this.safeAddress = safeAddress;
    this.baseUrl = this.getServiceUrl(chainId);
  }

  /**
   * 체인 ID에 따른 Safe Service URL 반환
   */
  getServiceUrl(chainId) {
    const urls = {
      '1': 'https://safe-transaction-mainnet.safe.global',
      '5': 'https://safe-transaction-goerli.safe.global',
      '11155111': 'https://safe-transaction-sepolia.safe.global',
      '137': 'https://safe-transaction-polygon.safe.global',
      '100': 'https://safe-transaction-gnosis-chain.safe.global',
      '42161': 'https://safe-transaction-arbitrum.safe.global',
      '10': 'https://safe-transaction-optimism.safe.global'
    };
    
    return urls[chainId.toString()] || urls['1'];
  }

  /**
   * Safe 정보 조회
   */
  async getSafeInfo() {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/safes/${this.safeAddress}/`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📊 Safe Service Info:', data);
      
      return data;
    } catch (error) {
      console.error('❌ Error fetching Safe info:', error);
      throw error;
    }
  }

  /**
   * 대기 중인 트랜잭션 조회
   */
  async getPendingTransactions() {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/safes/${this.safeAddress}/multisig-transactions/?executed=false&limit=20`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`📋 Found ${data.results.length} pending transactions`);
      
      return data.results;
    } catch (error) {
      console.error('❌ Error fetching pending transactions:', error);
      throw error;
    }
  }

  /**
   * 트랜잭션 제안 (Propose)
   */
  async proposeTransaction(transactionData, signature, sender) {
    try {
      const payload = {
        to: transactionData.to,
        value: transactionData.value || '0',
        data: transactionData.data || '0x',
        operation: transactionData.operation || 0,
        gasToken: transactionData.gasToken || '0x0000000000000000000000000000000000000000',
        safeTxGas: transactionData.safeTxGas || 0,
        baseGas: transactionData.baseGas || 0,
        gasPrice: transactionData.gasPrice || '0',
        refundReceiver: transactionData.refundReceiver || '0x0000000000000000000000000000000000000000',
        nonce: transactionData.nonce,
        contractTransactionHash: transactionData.contractTransactionHash,
        sender: sender,
        signature: signature,
        origin: 'EIP-1271 Contract Signer'
      };

      console.log('📤 Proposing transaction to Safe Service...');
      console.log('Payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(
        `${this.baseUrl}/api/v1/safes/${this.safeAddress}/multisig-transactions/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Transaction proposed successfully:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Error proposing transaction:', error);
      throw error;
    }
  }

  /**
   * 기존 트랜잭션에 확인(Confirmation) 추가
   */
  async addConfirmation(safeTxHash, signature) {
    try {
      const payload = {
        signature: signature
      };

      console.log(`🔐 Adding confirmation to transaction: ${safeTxHash}`);

      const response = await fetch(
        `${this.baseUrl}/api/v1/multisig-transactions/${safeTxHash}/confirmations/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Confirmation added successfully:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Error adding confirmation:', error);
      throw error;
    }
  }

  /**
   * 특정 트랜잭션 정보 조회
   */
  async getTransaction(safeTxHash) {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/multisig-transactions/${safeTxHash}/`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📋 Transaction details:', data);
      
      return data;
    } catch (error) {
      console.error('❌ Error fetching transaction:', error);
      throw error;
    }
  }

  /**
   * 트랜잭션 확인 상태 조회
   */
  async getConfirmations(safeTxHash) {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/multisig-transactions/${safeTxHash}/confirmations/`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log(`🔍 Confirmations for ${safeTxHash}:`, data);
      
      return data.results;
    } catch (error) {
      console.error('❌ Error fetching confirmations:', error);
      throw error;
    }
  }

  /**
   * EIP-1271 서명 형식으로 변환
   */
  formatEIP1271Signature(signature, contractAddress) {
    // EIP-1271 서명은 특별한 형식이 필요할 수 있습니다
    // Safe Service에서 EIP-1271 서명을 인식하도록 하는 형식
    
    // 일반적으로 다음과 같은 형식을 사용:
    // - 서명 데이터
    // - 컨트랙트 주소 정보
    
    return {
      signature: signature,
      signatureType: 'CONTRACT_SIGNATURE', // EIP-1271 타입 표시
      owner: contractAddress
    };
  }
}