/* 납부확인서: payment-receipt.html?kind=m(회비)|a(교육비)&id=신청서ID
   입금이 확인된 건만 출력. 세법상 증빙(현금영수증·계산서)을 대신하지 않음 */
import { enabled, db, fs, requireLogin, disabledNotice, esc, qs, won } from '../app.js';
import { TIER_NAMES, KIND_NAMES } from '../membership.js';
import { SEAL_IMAGE } from '../qual-config.js';

const el = document.getElementById('cert');
const krDate = s => { const [y, m, d] = String(s).split('-'); return y + '년 ' + Number(m) + '월 ' + Number(d) + '일'; };

async function init() {
  if (!enabled) return disabledNotice(el);
  if (!(await requireLogin())) return;
  const kind = qs('kind') === 'm' ? 'm' : 'a', id = qs('id') || '-';
  let r = null;
  try {
    const d = await fs.getDoc(fs.doc(db, kind === 'm' ? 'membershipApplications' : 'applications', id));
    r = d.exists() ? d.data() : null;
  } catch (e) { r = null; }
  const paid = r && (kind === 'm' ? r.status === '활성화' : r.status === '승인') && Number(kind === 'm' ? r.fee : r.total) > 0;
  if (!paid) { el.innerHTML = '<p class="board-empty">입금이 확인된 납부 내역이 아닙니다. <a href="mypage.html#pay">마이페이지로</a></p>'; return; }

  const who = r.applicant || {}, amount = kind === 'm' ? r.fee : r.total, on = (kind === 'm' ? r.processedOn : r.approvedOn) || '';
  const lines = kind === 'm'
    ? ['<tr><td>연회비 · ' + esc(TIER_NAMES[r.kind === 'upgrade' ? 'full' : r.tier]) + ' ' + esc(KIND_NAMES[r.kind]) + (r.periodStart ? '<br><small>회원 기간 ' + esc(r.periodStart) + ' ~ ' + esc(r.periodEnd) + '</small>' : '') + '</td><td class="num">' + won(amount) + '</td></tr>']
    : (r.items || []).map(i => '<tr><td>교육비 · ' + esc(i.title) + (i.date ? '<br><small>' + esc(i.date) + '</small>' : '') + '</td><td class="num">' + won(i.fee) + '</td></tr>')
      .concat(r.discount ? ['<tr><td>멤버십 할인 (' + Math.round(r.discountRate * 100) + '%)</td><td class="num">−' + Number(r.discount).toLocaleString('ko-KR') + '원</td></tr>'] : []);
  el.innerHTML =
    '<div class="course-cert pay-cert">' +
      '<p class="cc-no">확인번호 ' + (kind === 'm' ? 'M-' : 'E-') + esc(id.slice(0, 10).toUpperCase()) + '</p>' +
      '<h2>납 부 확 인 서</h2>' +
      '<dl><dt>납부자</dt><dd>' + esc(r.depositor || who.guardianName || who.name) + '</dd>' +
        (kind === 'a' && who.guardianName ? '<dt>참가자</dt><dd>' + esc(who.name) + '</dd>' : '') +
        (r.memberNo ? '<dt>회원번호</dt><dd>' + esc(r.memberNo) + '</dd>' : '') +
        '<dt>납부 확인일</dt><dd>' + esc(on) + '</dd></dl>' +
      '<table class="pay-table"><thead><tr><th>내용</th><th class="num">금액</th></tr></thead><tbody>' + lines.join('') +
        '</tbody><tfoot><tr><th>합계</th><th class="num">' + won(amount) + '</th></tr></tfoot></table>' +
      '<p class="cc-text">위 금액이 사단법인 대한수상안전협회에 납부되었음을 확인합니다.</p>' +
      (on ? '<p class="cc-date">' + krDate(on) + '</p>' : '') +
      '<p class="cc-issuer qc-issuer"><img src="assets/img/logo-color.png" alt="">사단법인 대한수상안전협회장<img class="qc-seal" src="' + SEAL_IMAGE + '" alt="직인"></p>' +
      '<p class="qc-foot">이 확인서는 납부 사실을 확인하는 문서이며, 세법상 증빙(현금영수증·계산서)을 대신하지 않습니다.' +
        (r.receiptStatus === '발급' && r.receiptNo ? '<br>' + (r.receipt && r.receipt.type === 'invoice' ? '계산서' : '현금영수증') + ' 발급 완료 · 승인번호 ' + esc(r.receiptNo) : '') + '</p>' +
    '</div>' +
    '<p class="center btn-row no-print"><button type="button" class="btn btn-primary" id="print">인쇄 / PDF로 저장</button><a class="btn btn-outline" href="mypage.html#pay">마이페이지로</a></p>';
  document.getElementById('print').addEventListener('click', () => window.print());
}
init();
