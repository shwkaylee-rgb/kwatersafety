/* 자격증 공통 계산 (상태, 유효기간, 자격 확인용 키)
   qualifications/{자격번호}: { uid, typeId, typeName, grade: '1급'|'2급', certNo, name, birth, issuedOn, expiresOn,
     status: 'active'|'suspended'|'revoked', statusReason, source, renewals: [{ on, completionId, programTitle }] }
   qualVerify/{sha256(자격번호|이름)}: 공개 자격 확인용 최소 정보 (이름은 일부 가림) */
import { QUALS, QUAL_GRADES, QUAL_VALID_YEARS, QUAL_SOON_DAYS } from './qual-config.js';
import { parseYmd, ymd, daysBetween, todayYmd } from './membership.js';
export { QUALS, QUAL_GRADES };
// 표시용 자격명: 착의생존수영지도자 1급
export const qualTitle = q => q.typeName + (q.grade ? ' ' + q.grade : '');

export const QUAL_STATUS_NAMES = { valid: '유효', soon: '갱신 필요', expired: '만료', suspended: '정지', revoked: '취소' };

// 발표일로부터 2년 뒤의 전날 (예: 2026-10-10 → 2028-10-09)
export function validUntil(s) { const d = parseYmd(s); d.setFullYear(d.getFullYear() + QUAL_VALID_YEARS); d.setDate(d.getDate() - 1); return ymd(d); }

export function qualStatus(q, today = todayYmd()) {
  if (!q) return 'expired';
  if (q.status === 'revoked') return 'revoked';
  if (q.status === 'suspended') return 'suspended';
  if (today > q.expiresOn) return 'expired';
  return daysBetween(today, q.expiresOn) <= QUAL_SOON_DAYS ? 'soon' : 'valid';
}
export const qualValid = (q, today) => ['valid', 'soon'].includes(qualStatus(q, today));

// 자격번호 형식: KWSA-CS-2026-0001
export const formatCertNo = (typeId, year, seq) => 'KWSA-' + QUALS[typeId].code + '-' + year + '-' + String(seq).padStart(4, '0');
export const normNo = s => String(s || '').trim().toUpperCase();
export const normName = s => String(s || '').replace(/\s+/g, '');

// 공개 자격 확인 문서 ID: 자격번호와 이름을 모두 알아야 조회 가능
export async function verifyId(certNo, name) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normNo(certNo) + '|' + normName(name)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
// 홍길동 → 홍*동, 김철 → 김*, 남궁민수 → 남**수
export function maskName(n) {
  n = normName(n);
  if (n.length <= 1) return n;
  if (n.length === 2) return n[0] + '*';
  return n[0] + '*'.repeat(n.length - 2) + n[n.length - 1];
}
// 공개 문서 내용
export const publicView = q => ({ certNo: q.certNo, typeName: q.typeName, grade: q.grade || '', maskedName: maskName(q.name), issuedOn: q.issuedOn,
  expiresOn: q.expiresOn, status: q.status, regNo: (QUALS[q.typeId] || {}).regNo || '' });
