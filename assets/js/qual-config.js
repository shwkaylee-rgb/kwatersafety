/* 협회 자격 종목 설정
   종목을 늘리려면 QUALS에 한 줄 추가하세요. code는 자격번호에 들어갑니다 (KWSA-코드-연도-일련번호).
   regNo: 민간자격 등록번호 (등록 후 입력하면 자격증과 자격 확인 화면에 표시) */
export const QUALS = {
  clothed: { name: '착의생존수영지도자', code: 'CS', regNo: '' },
  infant: { name: '영유아 수상교육전문지도자', code: 'IW', regNo: '' }
};
export const QUAL_GRADES = ['1급', '2급'];   // 모든 종목 공통 등급
export const QUAL_VALID_YEARS = 2;   // 유효기간: 결과 발표일(또는 갱신교육 이수일)로부터 2년
export const QUAL_SOON_DAYS = 90;    // 만료 몇 일 전부터 "갱신 필요"로 안내할지
export const SEAL_IMAGE = 'assets/img/seal-sample.svg';   // 직인 이미지 (예시. 실제 직인으로 바꿀 예정)
