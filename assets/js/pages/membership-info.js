import { ready, state, won, esc } from '../app.js';
import { MEMBERSHIP as M, TIER_NAMES, STATUS_NAMES, memberStatus, availableKinds } from '../membership.js';
import { benefitsTable } from '../membership-ui.js';

const el = document.getElementById('membership');
const pct = r => Math.round(r * 100) + '%';

async function render() {
  el.innerHTML =
    '<div class="tier-grid">' +
      '<article class="tier-card assoc"><span class="tier-tag">무료</span><h3>준회원</h3><p class="tier-fee">무료</p>' +
        '<p>생존수영 능력 인증서를 받은 아동을 5년간 자동으로 등록합니다. 따로 신청하지 않습니다.</p>' +
        '<p><a href="activities-certify.html">생존수영 교육인증 안내 →</a></p></article>' +
      '<article class="tier-card general"><span class="tier-tag">만 14세 이상 누구나</span><h3>' + TIER_NAMES.general + '</h3>' +
        '<p class="tier-fee">' + won(M.tiers.general.fee) + '<small> / 년</small></p>' +
        '<ul><li>교육·자격 신청비 ' + pct(M.tiers.general.discount) + ' 할인</li><li>기본 자료실, 협력기관 할인</li><li>디지털 회원증</li></ul>' +
        '<p class="tier-note">준회원 출신은 첫해 ' + pct(M.alumniDiscount) + ' 할인</p></article>' +
      '<article class="tier-card full"><span class="tier-tag">지도자 자격 보유자</span><h3>' + TIER_NAMES.full + '</h3>' +
        '<p class="tier-fee">' + won(M.tiers.full.fee) + '<small> / 년</small></p>' +
        '<ul><li>교육·자격 신청비 ' + pct(M.tiers.full.discount) + ' 할인</li><li>연 1회 보수교육 무료</li><li>전체 자료실</li><li>총회 의결권</li></ul>' +
        '<p class="tier-note">자격 확인과 심사 후 승인</p></article>' +
    '</div>' +
    '<div class="center" id="cta"></div>' +

    '<h2 class="page-title section-gap">등급별 혜택</h2>' + benefitsTable() +

    '<h2 class="page-title section-gap">가입 안내</h2>' +
    '<ol class="howto">' +
      '<li><b>회원가입·로그인</b><span>홈페이지 회원으로 먼저 가입합니다.</span></li>' +
      '<li><b>멤버십 신청</b><span>등급을 고르고 신청서를 냅니다. 정회원은 보유 자격 정보를 함께 적습니다.</span></li>' +
      '<li><b>연회비 입금</b><span>안내받은 계좌로 입금합니다. 현금영수증 또는 계산서를 신청할 수 있습니다.</span></li>' +
      '<li><b>확인·활성화</b><span>사무국이 입금(정회원은 자격도)을 확인하면 회원번호가 나오고 바로 혜택을 받습니다.</span></li>' +
    '</ol>' +
    '<ul class="rule-list">' +
      '<li>회원 기간은 입금 확인일부터 1년입니다. 만료 ' + M.renewWindowDays + '일 전부터 갱신할 수 있고, 만료 후 ' + M.graceDays + '일 안에 갱신하면 기간이 이어집니다.</li>' +
      '<li>' + TIER_NAMES.general + '이 ' + TIER_NAMES.full + '으로 바꾸면 차액(' + won(M.tiers.full.fee - M.tiers.general.fee) + ')만 내고 남은 기간은 그대로 유지됩니다.</li>' +
      '<li>가입 후 ' + M.refundDays + '일 안에 혜택을 쓰지 않았다면 전액 환불해 드립니다. 자세한 내용은 <a href="terms.html">회원 약관</a>을 확인해 주세요.</li>' +
    '</ul>';

  await ready;
  const cta = document.getElementById('cta');
  if (!state.user) {
    cta.innerHTML = '<a class="btn btn-primary" href="login.html?back=membership-apply.html">로그인하고 신청하기</a>';
    return;
  }
  const m = state.membership, s = memberStatus(m), kinds = availableKinds(m);
  const now = m && s !== 'none' ? '<p class="cta-status">현재 <b>' + TIER_NAMES[m.tier] + '</b> · ' + STATUS_NAMES[s] + ' (만료 ' + esc(m.endDate) + ')</p>' : '';
  cta.innerHTML = now + (kinds.length
    ? '<a class="btn btn-primary" href="membership-apply.html">' + (kinds.includes('join') ? '멤버십 신청하기' : '갱신·전환 신청하기') + '</a>'
    : '<a class="btn btn-outline" href="mypage.html">마이페이지에서 멤버십 보기</a>');
}
render();
