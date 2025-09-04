import { ethers } from 'ethers';

function analyzeSignature(signature: string, name: string) {
    console.log(`\n=== ${name} 분석 ===`);
    console.log(`전체 길이: ${signature.length} 문자 (${signature.length / 2 - 1} bytes)`);
    
    // 서명 구조 분석
    const signatureBytes = ethers.getBytes(signature);
    console.log(`서명 바이트 길이: ${signatureBytes.length}`);
    
    // 첫 번째 서명자 주소 (32 bytes)
    const signer1Address = '0x' + signature.slice(2, 66);
    console.log(`서명자 1 주소: ${signer1Address}`);
    
    // 서명 길이 (32 bytes)
    const signatureLength = parseInt(signature.slice(66, 130), 16);
    console.log(`서명 길이: ${signatureLength}`);
    
    // 서명 데이터 시작 위치
    const signatureStart = 130;
    const signatureEnd = signatureStart + (signatureLength * 2);
    console.log(`서명 데이터: ${signature.slice(signatureStart, signatureEnd)}`);
    
    // 서명 데이터를 65바이트씩 분할
    const signatureData = signature.slice(signatureStart, signatureEnd);
    const signatureCount = signatureData.length / (65 * 2);
    console.log(`서명 개수: ${signatureCount}`);
    
    // 각 서명 분석
    for (let i = 0; i < signatureCount; i++) {
        const start = i * 65 * 2;
        const end = start + (65 * 2);
        const sig = signatureData.slice(start, end);
        console.log(`  서명 ${i + 1}: ${sig}`);
        
        // v, r, s 분리
        const v = sig.slice(0, 2);
        const r = sig.slice(2, 66);
        const s = sig.slice(66, 130);
        console.log(`    v: ${v}, r: ${r}, s: ${s}`);
    }
    
    return {
        signer1Address,
        signatureLength,
        signatureCount,
        signatureData
    };
}

function main() {
    const signature1 = "0x0000000000000000000000000a92feb25c1ff258a7df028a9469412ba9f5b0090000000000000000000000000000000000000000000000000000000000000041000000000000000000000000000000000000000000000000000000000000000082a9e4e3baac56317d7c957ba4e0fb4d1fb4a07e6c9fc1877d5bc988f56c830f0122abce6e25fb191a6396040cf654240e71bd0acb7b6b1835a8b21094c073a7211fd6fc5a8da3d55c2f183e8cb1c85a2e019dd5b6ed8fa661bd710dc777d981d0e603f7e6cc5bb8c9ed5b2d";
    
    const signature2 = "0x000000000000000000000000a2101482b28e3d99ff6ced517ba41eff4971a386000000000000000000000000000000000000000000000000000000000000004100000000000000000000000000000000000000000000000000000000000000008297d0e592582b7cb49ac13fa95e07b9ee851a3c585e26c7ad2f43df73f3d4fc31644b45e4a9a567917e4178daeccf83994b56d9fac653f875a5ecc802e90fc76a1fde129c1dfae28ed0181d5a88ee32f92d6243f7ae7a9ed68ea9130dcab975c6ad6508fb2d432de7c7b36b";
    
    const result1 = analyzeSignature(signature1, "서명 1 (문제없음)");
    const result2 = analyzeSignature(signature2, "서명 2 (GS021 에러)");
    
    console.log("\n=== 비교 분석 ===");
    console.log(`서명자 1 주소 비교:`);
    console.log(`  서명 1: ${result1.signer1Address}`);
    console.log(`  서명 2: ${result2.signer1Address}`);
    console.log(`  동일한가?: ${result1.signer1Address === result2.signer1Address}`);
    
    console.log(`\n서명 길이 비교:`);
    console.log(`  서명 1: ${result1.signatureLength}`);
    console.log(`  서명 2: ${result2.signatureLength}`);
    console.log(`  동일한가?: ${result1.signatureLength === result2.signatureLength}`);
    
    console.log(`\n서명 개수 비교:`);
    console.log(`  서명 1: ${result1.signatureCount}`);
    console.log(`  서명 2: ${result2.signatureCount}`);
    console.log(`  동일한가?: ${result1.signatureCount === result2.signatureCount}`);
    
    console.log("\n=== GS021 에러 분석 ===");
    console.log("GS021 에러는 checkNSignatures 함수에서 발생하는 서명 관련 에러입니다.");
    console.log("가능한 원인들:");
    console.log("1. 서명자 주소가 SafeWallet의 소유자가 아님");
    console.log("2. 서명자 주소가 DAOContract의 소유자가 아님");
    console.log("3. 서명 순서가 잘못됨 (주소 순으로 정렬되어야 함)");
    console.log("4. 서명 자체가 잘못됨");
    console.log("5. DAOContract 설정 문제");
}

(async () => {
    try {
        await main();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
})();
