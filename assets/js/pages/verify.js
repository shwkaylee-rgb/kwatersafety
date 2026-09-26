/* 공개 자격 확인: 자격번호와 성명이 모두 맞아야 결과가 나옴 (로그인 필요 없음) */
import { enabled, db, fs, esc, qs, disabledNotice } from '../app.js';
import { qualStatus, QUAL_STATUS_NAMES, verifyId, normNo } from '../qual.js';

const f = document.getElementById('verify-form'), out = document.getElementById('verify-result');

async function check(no, name) {
  out.innerHTML = '<p class="board-empty">조회하는 중…</p>';
  try {
    const d = await fs.getDoc(fs.doc(db, 'qualVerify', await verifyId(no, name)));
    if (!d.exists()) {
      out.innerHTML = '<div class="verify-card none"><b>일치하는 자격이 없습니다.</b><p>자격번호와 성명을 자격증에 적힌 그대로 입력했는지 확인해 주세요. 계속 조회되지 않으면 협회로 문의해 주세요.</p></div>';
      return;
    }
    const v = d.data(), st = qualStatus(v), ok = st === 'valid' || st === 'soon';
    out.innerHTML = '<div class="verify-card ' + (ok ? 'ok' : 'no') + '">' +
      '<p class="verify-head">' + (ok ? '✓ 유효한 자격입니다' : '이 자격은 현재 ' + QUAL_STATUS_NAMES[st] + ' 상태입니다') + '</p>' +
      '<dl><dt>자격명</dt><dd>' + esc(v.typeName) + '</dd><dt>자격번호</dt><dd>' + esc(v.certNo) + '</dd>' +
      '<dt>성명</dt><dd>' + esc(v.maskedName) + '</dd><dt>취득일</dt><dd>' + esc(v.issuedOn) + '</dd>' +
      '<dt>유효기간</dt><dd>' + esc(v.expiresOn) + '까지</dd><dt>상태</dt><dd>' + (ok ? '유효' : QUAL_STATUS_NAMES[st]) + '</dd>' +
      (v.regNo ? '<dt>등록번호</dt><dd>민간자격 ' + esc(v.regNo) + '</dd>' : '') + '</dl>' +
      '<p class="form-help">조회일 ' + new Date().toLocaleDateString('ko-KR') + ' · 발급기관 사단법인 대한수상안전협회</p></div>';
  } catch (e) { console.error(e); out.innerHTML = '<p class="board-empty">조회하지 못했습니다. 잠시 후 다시 시도해 주세요.</p>'; }
}

if (!enabled) disabledNotice(out);
else {
  f.addEventListener('submit', e => {
    e.preventDefault();
    const no = normNo(f.no.value), name = f.name.value.trim();
    if (!no || !name) return;
    check(no, name);
  });
  if (qs('no')) f.no.value = qs('no');
}
