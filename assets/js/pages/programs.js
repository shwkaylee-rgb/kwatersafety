import { enabled, db, fs, disabledNotice, addToCart, toast, errMsg, esc, textToHTML, won } from '../app.js';

const el = document.getElementById('programs');

async function init() {
  if (!enabled) return disabledNotice(el);
  let programs;
  try {
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'programs'), fs.where('open', '==', true)));
    programs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.date).localeCompare(String(b.date)));
  } catch (e) { console.error(e); el.innerHTML = '<p class="board-empty">목록을 불러오지 못했습니다.</p>'; return; }
  if (!programs.length) { el.innerHTML = '<p class="board-empty">현재 모집 중인 교육·자격 과정이 없습니다.</p>'; return; }

  el.innerHTML = '<div class="program-grid">' + programs.map(p =>
    '<article class="program-card">' +
      '<span class="badge">' + esc(p.category) + '</span>' +
      '<h3>' + esc(p.title) + '</h3>' +
      '<dl>' +
        (p.date ? '<dt>일정</dt><dd>' + esc(p.date) + '</dd>' : '') +
        (p.place ? '<dt>장소</dt><dd>' + esc(p.place) + '</dd>' : '') +
        (p.capacity ? '<dt>정원</dt><dd>' + esc(p.capacity) + '명</dd>' : '') +
        (p.deadline ? '<dt>접수 마감</dt><dd>' + esc(p.deadline) + '</dd>' : '') +
        '<dt>비용</dt><dd class="fee">' + won(p.fee) + '</dd>' +
      '</dl>' +
      (p.description ? '<p class="desc">' + textToHTML(p.description) + '</p>' : '') +
      '<button class="btn btn-primary btn-block" type="button" data-add="' + p.id + '">장바구니 담기</button>' +
    '</article>'
  ).join('') + '</div>';

  el.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', async () => {
    const p = programs.find(x => x.id === b.getAttribute('data-add'));
    try { await addToCart(p); } catch (e) { toast(errMsg(e)); }
  }));
}
init();
