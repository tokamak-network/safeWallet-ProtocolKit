# safeWallet-ProtocolKit

SafeWallet과 DAOContract 간의 서명 및 트랜잭션 실행을 위한 프로토콜 킷입니다.

## 기능

- DAOContract를 통한 SafeWallet 트랜잭션 서명
- MultiSigWallet과의 연동
- EIP-1271 서명 검증
- 간단한 confirmTransaction 테스트

## 설치

```bash
npm install
```

## 환경 설정

`.env` 파일을 생성하고 필요한 환경 변수를 설정하세요:

```bash
cp env.example .env
```

### 필수 환경 변수

- `SAFE_WALLET_ADDRESS`: SafeWallet 컨트랙트 주소
- `DAO_CONTRACT_ADDRESS`: DAOContract 주소 (이미 SafeWallet에 등록됨)
- `MULTISIG_WALLET_ADDRESS`: MultiSigWallet 컨트랙트 주소 (DAOContract의 소유자)
- `MULTISIG_SIGNER1_PRIVATE_KEY`: MultiSigWallet 서명자 1의 private key
- `MULTISIG_SIGNER2_PRIVATE_KEY`: MultiSigWallet 서명자 2의 private key
- `RPC_URL`: 이더리움 RPC URL

## 사용법

### 1. 간단한 confirmTransaction 테스트

특정 txHash에 대해 DAOContract로 SafeWallet의 confirmTransaction을 테스트합니다:

```bash
# 단일 txHash 테스트
npm run confirm

# 여러 txHash 테스트
npm run test-simple
```

### 2. 전체 프로토콜 테스트

```bash
# 기본 테스트
npm test

# Pure ethers 테스트
npm run test-pure
```

### 3. 서명 실행

```bash
# DAO 서명 스크립트
npm run sign

# Pure ethers 서명
npm run sign-pure
```

## 스크립트 설명

- `simple-confirm-test.js`: 특정 txHash에 대한 간단한 confirmTransaction 테스트
- `test-simple-confirm.js`: 여러 txHash에 대한 테스트 실행
- `dao-signing-script.js`: 전체 DAO 서명 프로토콜
- `pure-ethers-dao-signing.js`: Pure ethers를 사용한 서명
- `safe-protocol-dao-signing.js`: Safe Protocol을 사용한 서명

## 아키텍처

```
MultiSigWallet Signers (Signer1, Signer2, Signer3)
                    ↓
            MultiSigWallet Contract
                    ↑
            DAOContract (Signer2)
                    ↓
            SafeWallet
```

DAOContract가 MultiSigWallet Contract를 제어하고, SafeWallet과도 직접 연결된 구조입니다.
