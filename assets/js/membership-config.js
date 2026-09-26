/* 회원(멤버십) 설정
   회비·할인율·입금 계좌가 바뀌면 이 파일만 고치면 됩니다.
   (회원 약관 페이지의 숫자도 여기서 가져오므로, 고친 뒤 `node tools/build.js`를 한 번 실행하세요.) */
export const MEMBERSHIP = {
  tiers: {
    general: { name: '일반회원', code: 'G', fee: 20000, discount: 0.10 },
    full:    { name: '정회원',   code: 'F', fee: 50000, discount: 0.20 }
  },
  alumniDiscount: 0.5,   // 준회원 출신 일반회원 첫해 할인율
  graceDays: 30,         // 만료 후 이 기간 안에 갱신하면 기간이 이어짐
  renewWindowDays: 30,   // 만료 몇 일 전부터 갱신 신청 가능
  refundDays: 7,         // 가입 후 이 기간 안, 혜택 미사용 시 전액 환불
  numberPrefix: 'KWSA',  // 회원번호: KWSA-G-2026-0001

  // 회비 입금 계좌 (비어 있으면 "사무국이 별도 안내"로 표시)
  bank: { name: '', account: '', holder: '' },

  // 등급별 혜택 (회원 안내 페이지·마이페이지에 표시)
  // assoc: 준회원, general: 일반회원, full: 정회원. 값이 없으면 "–"
  benefits: [
    { name: '디지털 회원증', assoc: '능력 인증서로 대신', general: '제공', full: '제공 (보유 자격 표시)' },
    { name: '협회 소식·행사 안내', assoc: '제공', general: '제공', full: '제공' },
    { name: '협회 주관 행사 참여', assoc: '참여', general: '참여', full: '우선 접수' },
    { name: '교육·자격 신청비', assoc: '자격제도 가산점', general: '10% 할인', full: '20% 할인' },
    { name: '보수교육·세미나', assoc: '', general: '녹화본 일부', full: '녹화본 전체 + 연 1회 무료' },
    { name: '회원 전용 자료실', assoc: '', general: '가정용 물놀이 안전 자료, 수상안전 가이드', full: '전체 (교안, 진도표, 평가지, 위험성평가 양식, 홍보 자료)' },
    { name: '내 자격증 조회', assoc: '능력 인증서 조회', general: '제공', full: '제공 + 자격 만료 안내' },
    { name: '협력기관 할인', assoc: '', general: '제공', full: '제공' },
    { name: '총회 의결권·임원 선거권', assoc: '', general: '', full: '있음' }
  ]
};
