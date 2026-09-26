import { enabled, db, fs, ready, state, disabledNotice, addToCart, toast, errMsg, esc, textToHTML, won } from '../app.js';
import { enrollmentId, completionValid } from '../course.js';

const el = document.getElementById('programs');

async function init() {
  if (!enabled) return disabledNotice(el);
  let programs;
  try {
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'programs'), fs.where('open', '==', true)));
    // 온라인 과정은 [온라인 학습] 페이지에서 따로 보여줌
    programs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.type !== 'online')
      .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.date).localeCompare(String(b.date)));
  } catch (e) { console.error(e); el.innerHTML = '<p class="board-empty">목록을 불러오지 못했습니다.</p>'; return; }

  // 로그인한 회원의 온라인 학습 수료 여부
  await ready;
  const done = {};
  if (state.user) {
    await Promise.all([...new Set(programs.map(p => p.requiresCourse).filter(Boolean))].map(async cid => {
      try { const s = await fs.getDoc(fs.doc(db, 'enrollments', enrollmentId(state.user.uid, cid))); done[cid] = s.exists() && completionValid(s.data()); }
      catch (e) { done[cid] = false; }
    }));
  }

  el.innerHTML = '<p class="center program-online-link"><a class="btn btn-outline btn-sm" href="online.html">온라인 학습 과정 보기 →</a></p>' +
    (programs.length ? '<div class="program-grid">' + programs.map(p => {
      const needs = p.requiresCourse, ok = needs && done[needs];
      return '<article class="program-card">' +
        '<span class="badge">' + esc(p.category) + '</span>' +
        '<h3>' + esc(p.title) + '</h3>' +
        (needs ? '<p class="prereq ' + (ok ? 'ok' : '') + '">' + (ok ? '✓ 사전요건 수료: ' : '사전요건: ') + '온라인 학습 「' + esc(p.requiresCourseTitle || '') + '」 수료</p>' : '') +
        '<dl>' +
          (p.date ? '<dt>일정</dt><dd>' + esc(p.date) + '</dd>' : '') +
          (p.place ? '<dt>장소</dt><dd>' + esc(p.place) + '</dd>' : '') +
          (p.capacity ? '<dt>정원</dt><dd>' + esc(p.capacity) + '명</dd>' : '') +
          (p.deadline ? '<dt>접수 마감</dt><dd>' + esc(p.deadline) + '</dd>' : '') +
          '<dt>비용</dt><dd class="fee">' + won(p.fee) + '</dd>' +
        '</dl>' +
        (p.description ? '<p class="desc">' + textToHTML(p.description) + '</p>' : '') +
        (needs && !ok
          ? '<a class="btn btn-outline btn-block" href="online.html#' + esc(needs) + '">온라인 학습 먼저 수료하기</a>'
          : '<button class="btn btn-primary btn-block" type="button" data-add="' + p.id + '">장바구니 담기</button>') +
      '</article>';
    }).join('') + '</div>' : '<p class="board-empty">현재 모집 중인 교육·자격 과정이 없습니다.</p>');

  el.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', async () => {
    const p = programs.find(x => x.id === b.getAttribute('data-add'));
    try { await addToCart(p); } catch (e) { toast(errMsg(e)); }
  }));
}
init();
