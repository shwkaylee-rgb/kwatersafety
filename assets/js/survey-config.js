/* 교육 전 사전 설문(건강 문진표) 설정
   표준 문항은 모든 과정에 같이 쓰고, 과정별 추가 문항은 관리자 [교육·자격 과정]에서 붙입니다.
   type: radio(하나 고르기) | check(여러 개 고르기) | text(한 줄) | textarea(여러 줄)
   detailOn: 이 보기를 고르면 내용을 적게 함 / flag: 이 보기를 고르면 관리자 화면에서 주의 표시 */
export const SURVEY_KEEP_DAYS = 365;   // 보관: 교육 종료 후 1년

export const STANDARD_SURVEY = [
  { id: 'swim', label: '수영 능력', type: 'radio', required: true,
    options: ['전혀 못 함', '25m 미만', '25m 이상', '50m 이상 자유롭게'] },
  { id: 'conditions', label: '현재 치료 중이거나 진단받은 질환 (해당하는 것 모두)', type: 'check', required: true,
    options: ['심장·혈관 질환', '고혈압', '호흡기 질환(천식 등)', '뇌전증·발작', '당뇨', '귀 질환(중이염 등)', '피부 질환', '기타', '해당 없음'],
    flag: ['심장·혈관 질환', '고혈압', '호흡기 질환(천식 등)', '뇌전증·발작', '당뇨', '귀 질환(중이염 등)', '피부 질환', '기타'], detailOn: ['기타'], exclusive: '해당 없음' },
  { id: 'surgery', label: '최근 6개월 안에 수술을 받았거나 다친 적이 있나요?', type: 'radio', required: true, options: ['아니오', '예'], detailOn: ['예'], flag: ['예'] },
  { id: 'medicine', label: '현재 복용 중인 약이 있나요?', type: 'radio', required: true, options: ['아니오', '예'], detailOn: ['예'], flag: ['예'] },
  { id: 'pregnant', label: '임신 중인가요?', type: 'radio', required: true, options: ['아니오', '예', '해당 없음'], flag: ['예'] },
  { id: 'fear', label: '물에 대한 두려움이 크거나 물놀이 사고를 겪은 적이 있나요?', type: 'radio', required: true, options: ['아니오', '예'], detailOn: ['예'], flag: ['예'] },
  { id: 'allergy', label: '알레르기 (없으면 비워 두세요)', type: 'text' },
  { id: 'emergency', label: '비상 연락처 (이름 · 관계 · 전화번호)', type: 'text', required: true, placeholder: '예: 홍길동 · 어머니 · 010-0000-0000' },
  { id: 'note', label: '지도자에게 미리 알릴 사항', type: 'textarea' }
];

// 민감정보(건강 정보) 별도 동의 문구
export const SENSITIVE_CONSENT = {
  items: '수영 능력, 질환·수술·부상·복용 약·임신 여부, 물에 대한 두려움·사고 경험, 알레르기, 비상 연락처, 지도자 전달 사항, 과정별 추가 문항의 답변',
  purpose: '수상 교육 중 참가자 안전 관리, 수준별 지도, 응급 상황 대응',
  period: '교육 종료 후 1년 (이후 파기)',
  refuse: '동의를 거부할 수 있습니다. 다만 안전을 위해 사전 설문이 필요한 과정은 참여가 제한될 수 있습니다.'
};
