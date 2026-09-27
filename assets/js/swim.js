/* 생존수영 능력 인증 공통
   swimGroups/{id}: 학교·기관 수업 { school, className, place, startDate, endDate, regDeadline, regOpen, status: 'open'|'issued',
     items: [평가 항목], evaluatorUids: [], programId, issuedOn, createdAt }  — 누구나 읽기(등록 링크), 관리자만 쓰기
   swimStudents/{id}: 보호자(또는 만 14세 이상 본인)가 등록한 학생 { uid, groupId, name, birth, grade, registrant: 'guardian'|'self',
     consentAt, results: { 항목: '이수'|'미이수' }, evaluatedBy, evaluatedAt, status: 'registered'|'evaluated'|'issued', certNo, issuedOn, memberUntil }
   swimContacts/{학생ID}: 보호자 연락처 { uid, guardianName, relation, phone }  — 본인·관리자만 (평가 강사는 볼 수 없음)
   evaluators/{uid}: 평가 강사 { name, email }  — 관리자가 지정
   settings/swimItems: { items: [...] }  — 새 수업의 기본 평가 항목 */
import { db, fs, esc } from './app.js';
import { SEAL_IMAGE } from './qual-config.js';

export const DEFAULT_SWIM_ITEMS = ['물적응', '생존뜨기', '낙수', '응용뜨기 및 생존영법', '구조사슬'];
export const SWIM_MEMBER_YEARS = 5;   // 인증 받으면 준회원 5년
export const STUDENT_STATUS = { registered: '평가 전', evaluated: '평가 완료', issued: '발급 완료' };
export const RESULTS = ['이수', '미이수'];

export async function loadSwimItems() {
  try { const d = await fs.getDoc(fs.doc(db, 'settings', 'swimItems')); if (d.exists() && (d.data().items || []).length) return d.data().items; } catch (e) { /* 기본값 */ }
  return DEFAULT_SWIM_ITEMS.slice();
}
export const groupTitle = g => [g.school, g.className].filter(Boolean).join(' ');
export const groupPeriod = g => g.startDate ? g.startDate + (g.endDate && g.endDate !== g.startDate ? ' ~ ' + g.endDate : '') : '';
export const regLink = id => location.origin + location.pathname.replace(/[^/]*$/, '') + 'swim.html?g=' + encodeURIComponent(id);
// 모든 항목에 결과가 있는지
export const fullyEvaluated = (s, items) => items.every(i => s.results && RESULTS.includes(s.results[i]));
// 발급일로부터 5년 뒤의 전날
export function memberUntilOf(ymd) {
  const [y, m, d] = ymd.split('-').map(Number), t = new Date(y + SWIM_MEMBER_YEARS, m - 1, d - 1);
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
}
export const formatSwimNo = (year, seq) => 'KWSA-SC-' + year + '-' + String(seq).padStart(6, '0');

const krDate = s => { const [y, m, d] = String(s).split('-'); return y + '년 ' + Number(m) + '월 ' + Number(d) + '일'; };
// 인증서 한 장 (보호자 출력·관리자 일괄 인쇄 공용)
export function swimCertHTML(s, g) {
  const items = (g && g.items) || Object.keys(s.results || {});
  return '<div class="course-cert swim-cert">' +
    '<p class="cc-no">인증번호 ' + esc(s.certNo) + '</p>' +
    '<h2>생존수영 능력 인증서</h2>' +
    '<dl><dt>성명</dt><dd>' + esc(s.name) + '</dd><dt>생년월일</dt><dd>' + esc(s.birth) + '</dd>' +
      '<dt>소속</dt><dd>' + esc([g && g.school, s.grade].filter(Boolean).join(' ')) + '</dd>' +
      (g && groupPeriod(g) ? '<dt>교육 기간</dt><dd>' + esc(groupPeriod(g)) + '</dd>' : '') + '</dl>' +
    '<table class="swim-items"><thead><tr><th>평가 항목</th><th>결과</th></tr></thead><tbody>' +
      items.map(i => '<tr><td>' + esc(i) + '</td><td class="' + ((s.results || {})[i] === '이수' ? 'ok' : 'no') + '">' + esc((s.results || {})[i] || '–') + '</td></tr>').join('') +
    '</tbody></table>' +
    '<p class="cc-text">위 사람은 사단법인 대한수상안전협회의 생존수영 교육에 참여하여<br>위와 같이 생존수영 능력을 평가받았음을 인증합니다.</p>' +
    '<p class="cc-date">' + krDate(s.issuedOn) + '</p>' +
    '<p class="cc-issuer qc-issuer"><img src="assets/img/logo-color.png" alt="">사단법인 대한수상안전협회장<img class="qc-seal" src="' + SEAL_IMAGE + '" alt="직인"></p>' +
    '<p class="qc-foot">이 인증서를 받은 학생은 ' + esc(s.memberUntil) + '까지 대한수상안전협회 준회원으로 등록됩니다.</p>' +
  '</div>';
}
