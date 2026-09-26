/* 멤버십 화면 조각 (회원 안내, 마이페이지, 관리자에서 함께 사용) */
import { esc } from './app.js';
import { MEMBERSHIP as M, TIER_NAMES, STATUS_NAMES, memberStatus } from './membership.js';

// 등급별 혜택 비교표. highlight: 강조할 등급 열 ('general' | 'full')
export function benefitsTable(highlight) {
  const cls = t => t === highlight ? ' class="is-mine"' : '';
  const cell = (v, t) => '<td' + (t === highlight ? ' class="is-mine"' : '') + '>' + (v ? esc(v) : '<span class="muted">–</span>') + '</td>';
  return '<div class="table-scroll"><table class="board-table benefit-table"><thead><tr><th>혜택</th>' +
    '<th>준회원</th><th' + cls('general') + '>' + TIER_NAMES.general + '</th><th' + cls('full') + '>' + TIER_NAMES.full + '</th></tr></thead><tbody>' +
    M.benefits.map(b => '<tr><th scope="row">' + esc(b.name) + '</th>' + cell(b.assoc) + cell(b.general, 'general') + cell(b.full, 'full') + '</tr>').join('') +
    '</tbody></table></div>';
}

// 상태 배지
export function statusBadge(m) {
  const s = memberStatus(m);
  return '<span class="mstatus mstatus-' + s + '">' + STATUS_NAMES[s] + '</span>';
}

// 신청서 처리 상태 배지
export function appStatusBadge(status) {
  const map = { '접수': 'wait', '활성화': 'ok', '반려': 'no', '취소': 'off', '환불': 'off' };
  return '<span class="mstatus mstatus-' + (map[status] || 'off') + '">' + esc(status) + '</span>';
}
