import { enabled, db, fs, requireLogin, disabledNotice, esc, qs } from '../app.js';
import { QUALS, SEAL_IMAGE } from '../qual-config.js';
import { qualStatus, QUAL_STATUS_NAMES } from '../qual.js';

const el = document.getElementById('cert');
const krDate = s => { const [y, m, d] = s.split('-'); return y + '년 ' + Number(m) + '월 ' + Number(d) + '일'; };

async function init() {
  if (!enabled) return disabledNotice(el);
  if (!(await requireLogin())) return;
  let q = null;
  try {
    // 본인 자격만 읽을 수 있음 (다른 사람 번호는 규칙에서 막힘)
    const d = await fs.getDoc(fs.doc(db, 'qualifications', qs('no') || '-'));
    q = d.exists() ? { ...d.data(), certNo: d.id } : null;
  } catch (e) { q = null; }
  if (!q) { el.innerHTML = '<p class="board-empty">보유한 자격이 아닙니다. <a href="mypage.html">마이페이지로</a></p>'; return; }
  const st = qualStatus(q);
  if (!['valid', 'soon'].includes(st)) {
    el.innerHTML = '<p class="board-empty">' + QUAL_STATUS_NAMES[st] + '된 자격은 자격증을 출력할 수 없습니다.' +
      (st === 'expired' ? ' 갱신교육을 이수하면 다시 발급됩니다.' : '') + ' <a href="mypage.html">마이페이지로</a></p>';
    return;
  }
  const reg = (QUALS[q.typeId] || {}).regNo;
  el.innerHTML =
    '<div class="course-cert qual-cert">' +
      '<p class="cc-no">자격번호 제 ' + esc(q.certNo) + ' 호</p>' +
      '<h2>자 격 증</h2>' +
      '<p class="qc-type">' + esc(q.typeName) + '</p>' +
      '<dl><dt>성명</dt><dd>' + esc(q.name) + '</dd>' +
      (q.birth ? '<dt>생년월일</dt><dd>' + esc(q.birth) + '</dd>' : '') +
      '<dt>취득일</dt><dd>' + esc(q.issuedOn) + '</dd>' +
      (q.lastRenewedOn ? '<dt>최근 갱신</dt><dd>' + esc(q.lastRenewedOn) + '</dd>' : '') +
      '<dt>유효기간</dt><dd>' + esc(q.expiresOn) + '까지</dd></dl>' +
      '<p class="cc-text">위 사람은 사단법인 대한수상안전협회가 시행한<br>' + esc(q.typeName) + ' 과정을 이수하고 평가에 합격하였으므로<br>이 자격증을 수여합니다.</p>' +
      '<p class="cc-date">' + krDate(q.lastRenewedOn || q.issuedOn) + '</p>' +
      '<p class="cc-issuer qc-issuer"><img src="assets/img/logo-color.png" alt="">사단법인 대한수상안전협회장<img class="qc-seal" src="' + SEAL_IMAGE + '" alt="직인"></p>' +
      '<p class="qc-foot">자격 확인: kwasa.or.kr/verify.html (자격번호와 성명으로 조회)' +
        (reg ? '<br>민간자격 등록번호 ' + esc(reg) + ' · 이 자격은 「자격기본법」에 따른 등록민간자격이며 국가자격이 아닙니다.' : '') + '</p>' +
    '</div>' +
    '<p class="center btn-row no-print"><button type="button" class="btn btn-primary" id="print">인쇄 / PDF로 저장</button><a class="btn btn-outline" href="mypage.html">마이페이지로</a></p>';
  document.getElementById('print').addEventListener('click', () => window.print());
}
init();
