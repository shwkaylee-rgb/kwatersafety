import { enabled, state, requireLogin, disabledNotice, esc } from '../app.js';
import { TIER_NAMES, STATUS_NAMES, memberStatus } from '../membership.js';

const el = document.getElementById('card');

async function init() {
  if (!enabled) return disabledNotice(el);
  if (!(await requireLogin())) return;
  const m = state.membership, s = memberStatus(m);
  if (s === 'none') {
    el.innerHTML = '<p class="board-empty">멤버십 회원이 아닙니다. <a href="membership.html">회원 안내 보기</a></p>';
    return;
  }
  const q = m.qualification;
  el.innerHTML =
    '<div class="member-card tier-' + esc(m.tier) + '">' +
      '<div class="mc-head"><img src="assets/img/logo-white.png" alt="사단법인 대한수상안전협회"><span class="mc-tier">' + TIER_NAMES[m.tier] + '</span></div>' +
      '<p class="mc-label">MEMBERSHIP CARD</p>' +
      '<p class="mc-name">' + esc(m.name || (state.profile && state.profile.name) || '') + '</p>' +
      '<dl>' +
        '<dt>회원번호</dt><dd>' + esc(m.memberNo) + '</dd>' +
        '<dt>유효기간</dt><dd>' + esc(m.startDate) + ' ~ ' + esc(m.endDate) + '</dd>' +
        (m.tier === 'full' && q ? '<dt>보유 자격</dt><dd>' + esc(q.name) + (q.number ? ' (' + esc(q.number) + ')' : '') + '</dd>' : '') +
      '</dl>' +
      (s !== 'active' ? '<p class="mc-warn">현재 상태: ' + STATUS_NAMES[s] + '</p>' : '') +
      '<p class="mc-foot">사단법인 대한수상안전협회 · kwasa.or.kr</p>' +
    '</div>' +
    '<p class="center btn-row no-print"><button type="button" class="btn btn-primary" id="print">인쇄 / PDF로 저장</button>' +
    '<a class="btn btn-outline" href="mypage.html">마이페이지로</a></p>' +
    '<p class="form-help center no-print">인쇄 창에서 대상을 "PDF로 저장"으로 고르면 파일로 받을 수 있습니다.</p>';
  document.getElementById('print').addEventListener('click', () => window.print());
}
init();
