# Safe Wallet EIP-1271 Contract Confirmation Tool

이미 배포된 EIP-1271 컨트랙트가 Safe Wallet의 소유자로 등록되어 있을 때, 해당 컨트랙트를 통해 Safe 트랜잭션에 confirmation을 추가하는 도구입니다.

## 주요 기능

- **EIP-1271 Contract Confirmation**: 이미 배포된 EIP-1271 컨트랙트를 통한 Safe 트랜잭션 확인
- **Safe Wallet 통합**: Safe Protocol Kit을 사용한 멀티시그 지갑 관리
- **실시간 Confirmation**: 대기 중인 Safe 트랜잭션에 EIP-1271 컨트랙트로 확인 추가
- **Safe Service API 연동**: Safe Transaction Service와 연동하여 실제 트랜잭션 관리

## 설치 및 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example` 파일을 `.env`로 복사하고 필요한 값들을 설정하세요:

```bash
cp .env.example .env
```

`.env` 파일에서 다음 값들을 설정하세요:

- `RPC_URL`: 이더리움 네트워크 RPC URL
- `SAFE_ADDRESS`: Safe Wallet 주소
- `EIP1271_CONTRACT_ADDRESS`: 이미 배포된 EIP-1271 컨트랙트 주소 (Safe 소유자로 등록된 상태)
- `CONTRACT_OWNER_PRIVATE_KEY`: EIP-1271 컨트랙트 소유자의 개인키
- `CHAIN_ID`: 체인 ID (1: 메인넷, 5: Goerli 등)

## 사용법

### EIP-1271 컨트랙트 Confirmation 테스트

```bash
npm start
# 또는
npm test
```

### 실제 Safe Service API 연동 테스트

```bash
npm run test:real
```

## 프로젝트 구조

```
├── src/
│   ├── safeConfirmation.js   # Safe Confirmation 관리자 (EIP-1271용)
│   ├── safeServiceAPI.js     # Safe Transaction Service API 클라이언트
│   ├── confirmationTest.js   # EIP-1271 Confirmation 테스트 (메인)
│   └── realWorldTest.js      # 실제 Safe Service 연동 테스트
├── package.json
├── .env.example
└── README.md
```

## 핵심 컴포넌트

### SafeConfirmationManager

이미 배포된 EIP-1271 컨트랙트를 통해 Safe 트랜잭션에 confirmation을 추가하는 클래스입니다.

```javascript
const manager = new SafeConfirmationManager(config);
await manager.initialize();

// 새 트랜잭션 생성 및 확인
const { transaction, hash } = await manager.createSafeTransaction(transactionData);
const result = await manager.confirmTransactionWithContract(transaction);

// 기존 트랜잭션 확인
const signature = await manager.confirmExistingTransaction(safeTxHash);
```

### SafeServiceClient

Safe Transaction Service API와 상호작용하여 실제 트랜잭션을 관리하는 클래스입니다.

```javascript
const client = new SafeServiceClient(chainId, safeAddress);

// 대기 중인 트랜잭션 조회
const pendingTxs = await client.getPendingTransactions();

// 확인 추가
await client.addConfirmation(safeTxHash, signature);

// 트랜잭션 제안
await client.proposeTransaction(transactionData, signature, sender);
```

## EIP-1271 표준

EIP-1271은 스마트 컨트랙트가 서명을 검증할 수 있게 하는 표준입니다. 이 도구는 이미 배포된 EIP-1271 컨트랙트를 통해 Safe 트랜잭션에 confirmation을 추가합니다.

### 매직 값

유효한 서명의 경우 `0x1626ba7e` 값을 반환해야 합니다.

## Safe Wallet Confirmation 프로세스

이 스크립트는 다음과 같은 프로세스로 EIP-1271 컨트랙트를 통해 Safe 트랜잭션을 확인합니다:

### 1. 기본 Confirmation 프로세스
1. **Safe 정보 조회**: Safe 소유자, threshold, nonce 확인
2. **EIP-1271 컨트랙트 검증**: 컨트랙트가 Safe 소유자인지 확인
3. **트랜잭션 생성**: Safe Protocol Kit으로 트랜잭션 생성
4. **컨트랙트 서명**: EIP-1271 컨트랙트 소유자로 서명
5. **Confirmation 추가**: Safe에 서명 추가

### 2. Safe Service API 연동 프로세스
1. **대기 트랜잭션 조회**: Safe Service에서 pending 트랜잭션 확인
2. **기존 트랜잭션 확인**: 대기 중인 트랜잭션에 confirmation 추가
3. **새 트랜잭션 제안**: 새로운 트랜잭션을 Safe Service에 제안
4. **실시간 상태 확인**: 트랜잭션 확인 상태 모니터링

## 보안 고려사항

- 개인키는 안전하게 보관하고 `.env` 파일을 버전 관리에 포함하지 마세요
- 프로덕션 환경에서는 하드웨어 지갑이나 키 관리 서비스 사용을 권장합니다
- 컨트랙트 주소와 Safe Wallet 설정을 신중히 검토하세요

## 라이선스

MIT License

## 전제 조건

이 도구를 사용하기 전에 다음 조건들이 충족되어야 합니다:

1. **EIP-1271 컨트랙트가 이미 배포되어 있어야 함**
2. **해당 컨트랙트가 Safe Wallet의 소유자로 등록되어 있어야 함**
3. **컨트랙트 소유자의 개인키에 접근 가능해야 함**

## 사용 예시

### 1. 환경 설정
```bash
# .env 파일 설정
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
SAFE_ADDRESS=0x1234567890123456789012345678901234567890
EIP1271_CONTRACT_ADDRESS=0x0987654321098765432109876543210987654321
CONTRACT_OWNER_PRIVATE_KEY=0xabc123...
CHAIN_ID=1
```

### 2. EIP-1271 컨트랙트 Confirmation 테스트
```bash
npm start
```

### 3. 실제 Safe Service 연동 테스트
```bash
npm run test:real
```

### 4. 대기 중인 트랜잭션 확인하기
```javascript
// 실제 사용 예시
const manager = new SafeConfirmationManager(config);
await manager.initialize();

// Safe Service에서 대기 중인 트랜잭션 조회
const safeService = new SafeServiceClient(chainId, safeAddress);
const pendingTxs = await safeService.getPendingTransactions();

// 첫 번째 대기 트랜잭션에 확인 추가
if (pendingTxs.length > 0) {
  const signature = await manager.confirmExistingTransaction(pendingTxs[0].safeTxHash);
  await safeService.addConfirmation(pendingTxs[0].safeTxHash, signature);
}
```

## 트러블슈팅

### 일반적인 문제들

1. **EIP-1271 컨트랙트 소유자 오류**: 
   - EIP-1271 컨트랙트가 Safe Wallet의 소유자로 등록되어 있는지 확인
   - `getSafeInfo()` 함수로 현재 Safe 소유자 목록 확인

2. **컨트랙트 권한 오류**:
   - 환경 변수의 개인키가 EIP-1271 컨트랙트의 소유자인지 확인
   - 컨트랙트의 `owner()` 함수로 소유자 주소 확인

3. **Safe Service API 연결 오류**:
   - 올바른 네트워크의 Safe Service URL 사용 확인
   - 테스트넷의 경우 해당 네트워크의 Safe Service 지원 여부 확인

4. **서명 형식 오류**:
   - EIP-1271 서명이 올바른 형식인지 확인
   - Safe Service에서 EIP-1271 서명을 인식하는지 확인

### 디버깅 팁

- `npm start`로 로컬 테스트 먼저 실행
- Safe Service API 연결 상태를 `npm run test:real`로 확인
- Safe Wallet의 현재 상태를 Safe UI에서 직접 확인
- 트랜잭션 해시와 서명을 로그로 확인하여 디버깅

### Safe Service API 엔드포인트

각 네트워크별 Safe Service API:
- **Mainnet**: `https://safe-transaction-mainnet.safe.global`
- **Goerli**: `https://safe-transaction-goerli.safe.global`
- **Sepolia**: `https://safe-transaction-sepolia.safe.global`
- **Polygon**: `https://safe-transaction-polygon.safe.global`
- **Arbitrum**: `https://safe-transaction-arbitrum.safe.global`