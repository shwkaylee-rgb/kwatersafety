import { enabled, db, fs, ready, state, disabledNotice, addToCart, toast, errMsg, esc, textToHTML, won } from '../app.js';
import { enrollmentId, enrollmentStatus, completionValid, progressPercent, totalMinutes, ENR_STATUS_NAMES } from '../course.js';
import { discountRate, TIER_NAMES } from '../membership.js';

const el = document.getElementById('online');

async function init() {
  if (!enabled) return disabledNotice(el);
  let courses, programs;
  try {
    const [cSnap, pSnap] = await Promise.all([
      fs.getDocs(fs.query(fs.collection(db, 'courses'), fs.where('open', '==', true))),
      fs.getDocs(fs.query(fs.collection(db, 'programs'), fs.where('open', '==', true)))
    ]);
    courses = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    programs = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error(e); el.innerHTML = '<p class="board-empty">목록을 불러오지 못했습니다.</p>'; return; }
  if (!courses.length) { el.innerHTML = '<p class="board-empty">현재 수강할 수 있는 온라인 과정이 없습니다.</p>'; return; }

  await ready;
  const mine = {};
  if (state.user) {
    await Promise.all(courses.map(async c => {
      try { const s = await fs.getDoc(fs.doc(db, 'enrollments', enrollmentId(state.user.uid, c.id))); if (s.exists()) mine[c.id] = s.data(); }
      catch (e) { /* 수강 기록 없음 */ }
    }));
  }
  const rate = discountRate(state.membership);

  el.innerHTML = '<div class="course-list">' + courses.map(c => {
    const e = mine[c.id], st = enrollmentStatus(e);
    const leadsTo = programs.filter(p => p.requiresCourse === c.id);
    const action = st === 'active' || st === 'passed'
      ? '<a class="btn btn-primary" href="learn.html?course=' + encodeURIComponent(c.id) + '">' + (st === 'passed' ? '다시 보기' : progressPercent(c, e) ? '이어서 학습' : '학습 시작') + '</a>' +
        (st === 'passed' ? '<a class="btn btn-outline" href="course-certificate.html?course=' + encodeURIComponent(c.id) + '">수료증</a>' : '')
      : '<button type="button" class="btn btn-primary" data-add="' + c.id + '">수강 신청 (장바구니 담기)</button>';
    return '<article class="course-card" id="' + esc(c.id) + '">' +
      '<div class="course-main">' +
        '<span class="badge">온라인 학습</span>' + (st !== 'none' ? ' <span class="mstatus mstatus-' + (st === 'passed' ? 'ok' : st === 'active' ? 'wait' : 'off') + '">' + ENR_STATUS_NAMES[st] + (st === 'active' ? ' · 진도 ' + progressPercent(c, e) + '%' : '') + '</span>' : '') +
        '<h3>' + esc(c.title) + '</h3>' +
        (c.description ? '<p class="desc">' + textToHTML(c.description) + '</p>' : '') +
        (leadsTo.length ? '<p class="prereq">이 과정을 수료해야 신청할 수 있는 교육: ' + leadsTo.map(p => '「' + esc(p.title) + '」').join(', ') + '</p>' : '') +
        '<ol class="chapter-preview">' + (c.chapters || []).map(ch => '<li><span class="ch-type">' + (ch.type === 'video' ? '영상' : '글') + '</span>' + esc(ch.title) + (ch.minutes ? ' <small>' + ch.minutes + '분</small>' : '') + '</li>').join('') + '</ol>' +
      '</div>' +
      '<aside class="course-side">' +
        '<dl><dt>수강료</dt><dd class="fee">' + won(c.fee) + (rate && c.fee ? '<small>' + TIER_NAMES[state.membership.tier] + ' ' + Math.round(rate * 100) + '% 할인 적용 전</small>' : '') + '</dd>' +
        '<dt>학습 분량</dt><dd>' + (c.chapters || []).length + '개 챕터 · 약 ' + totalMinutes(c) + '분</dd>' +
        '<dt>수강 기간</dt><dd>승인 후 ' + c.accessDays + '일</dd>' +
        '<dt>수료 기준</dt><dd>모든 챕터 + 평가 ' + c.passScore + '점 이상</dd>' +
        '<dt>수료 인정</dt><dd>' + (c.validityMonths ? '수료일부터 ' + c.validityMonths + '개월' : '기간 제한 없음') + '</dd>' +
        (e && st !== 'none' ? '<dt>' + (st === 'passed' ? '수료일' : '수강 종료') + '</dt><dd>' + esc(st === 'passed' ? e.passedOn + (completionValid(e) ? '' : ' (인정 기간 만료)') : e.endDate) + '</dd>' : '') +
        '</dl><div class="btn-col">' + action + '</div>' +
      '</aside>' +
    '</article>';
  }).join('') + '</div>';

  el.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', async () => {
    const c = courses.find(x => x.id === b.getAttribute('data-add'));
    const p = programs.find(x => x.type === 'online' && x.courseId === c.id) || { id: 'online-' + c.id, type: 'online', courseId: c.id, category: '온라인 학습', title: c.title, fee: c.fee, date: '승인 후 ' + c.accessDays + '일간 수강' };
    try { await addToCart(p); } catch (e) { toast(errMsg(e)); }
  }));
  if (location.hash) { const t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) t.scrollIntoView(); }
}
init();
