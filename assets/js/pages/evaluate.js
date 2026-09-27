/* 생존수영 평가 (평가 강사 전용): 배정된 수업의 학생마다 항목별 이수·미이수를 누르면 바로 저장
   evaluate.html?g=수업ID */
import { enabled, db, fs, state, requireLogin, disabledNotice, toast, errMsg, esc, qs } from '../app.js';
import { groupTitle, groupPeriod, RESULTS, fullyEvaluated, STUDENT_STATUS } from '../swim.js';

const el = document.getElementById('evaluate');

async function init() {
  if (!enabled) return disabledNotice(el);
  if (!(await requireLogin())) return;
  const isEval = state.isAdmin || (await fs.getDoc(fs.doc(db, 'evaluators', state.user.uid)).catch(() => null))?.exists();
  if (!isEval) { el.innerHTML = '<div class="notice-box">평가 강사로 지정된 회원만 볼 수 있습니다. 협회에 문의해 주세요.</div>'; return; }
  const gid = qs('g');
  if (!gid) return listGroups();
  let g;
  try { const d = await fs.getDoc(fs.doc(db, 'swimGroups', gid)); g = d.exists() ? { id: d.id, ...d.data() } : null; } catch (e) { g = null; }
  if (!g || (!state.isAdmin && !(g.evaluatorUids || []).includes(state.user.uid))) { el.innerHTML = '<p class="board-empty">배정된 수업이 아닙니다. <a href="evaluate.html">내 수업 목록</a></p>'; return; }
  let students = [];
  try {
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'swimStudents'), fs.where('groupId', '==', g.id)));
    students = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.grade + a.name).localeCompare(String(b.grade + b.name), 'ko'));
  } catch (e) { el.innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }
  const items = g.items || [], locked = g.status !== 'open';
  const done = () => students.filter(s => fullyEvaluated(s, items)).length;
  el.innerHTML =
    '<p><a class="link-btn" href="evaluate.html">← 내 수업 목록</a></p>' +
    '<div class="swim-head"><h2>' + esc(groupTitle(g)) + '</h2><p>' + esc(groupPeriod(g)) + ' · 학생 ' + students.length + '명 · 평가 완료 <b id="done">' + done() + '</b>명</p>' +
      (locked ? '<p class="warn">평가가 마감된 수업입니다. 고칠 내용은 협회에 알려 주세요.</p>' : '<p class="form-help">누르는 즉시 저장됩니다. 모든 항목을 고르면 "평가 완료"가 됩니다.</p>') + '</div>' +
    '<input id="find" class="mini-input wide" placeholder="이름으로 찾기" autocomplete="off">' +
    (students.length ? '<div class="ev-list">' + students.map(s => '<article class="ev-card" data-s="' + s.id + '" data-name="' + esc(s.name) + '">' +
      '<header><b>' + esc(s.name) + '</b><small>' + esc([s.grade, s.birth].filter(Boolean).join(' · ')) + '</small><span class="ev-st">' + STUDENT_STATUS[s.status] + '</span></header>' +
      items.map(i => '<div class="ev-row"><span>' + esc(i) + '</span><div class="ev-btns">' + RESULTS.map(r =>
        '<button type="button" class="ev-btn' + ((s.results || {})[i] === r ? ' on ' + (r === '이수' ? 'ok' : 'no') : '') + '" data-item="' + esc(i) + '" data-r="' + r + '"' + (locked || s.status === 'issued' ? ' disabled' : '') + '>' + r + '</button>').join('') + '</div></div>').join('') +
      (locked || s.status === 'issued' ? '' : '<p class="ev-all"><button type="button" class="link-btn" data-all="' + s.id + '">모든 항목 이수</button></p>') +
      '</article>').join('') + '</div>' : '<p class="board-empty">아직 등록한 학생이 없습니다. 보호자가 등록 링크로 등록하면 여기에 나타납니다.</p>');

  const save = async (s, results) => {
    const status = fullyEvaluated({ results }, items) ? 'evaluated' : 'registered';
    await fs.updateDoc(fs.doc(db, 'swimStudents', s.id), { results, status, evaluatedBy: state.user.uid, evaluatedAt: fs.serverTimestamp() });
    s.results = results; s.status = status;
    const card = el.querySelector('[data-s="' + s.id + '"]');
    card.querySelector('.ev-st').textContent = STUDENT_STATUS[status];
    card.querySelectorAll('.ev-btn').forEach(b => { const on = results[b.dataset.item] === b.dataset.r; b.className = 'ev-btn' + (on ? ' on ' + (b.dataset.r === '이수' ? 'ok' : 'no') : ''); });
    document.getElementById('done').textContent = done();
  };
  el.querySelectorAll('.ev-btn').forEach(b => b.addEventListener('click', async () => {
    const s = students.find(x => x.id === b.closest('[data-s]').dataset.s);
    try { await save(s, { ...(s.results || {}), [b.dataset.item]: b.dataset.r }); } catch (e) { toast(errMsg(e)); }
  }));
  el.querySelectorAll('[data-all]').forEach(b => b.addEventListener('click', async () => {
    const s = students.find(x => x.id === b.dataset.all);
    try { await save(s, Object.fromEntries(items.map(i => [i, '이수']))); } catch (e) { toast(errMsg(e)); }
  }));
  document.getElementById('find').addEventListener('input', e => {
    const q = e.target.value.trim();
    el.querySelectorAll('.ev-card').forEach(c => { c.hidden = q && !c.dataset.name.includes(q); });
  });
}

async function listGroups() {
  let groups = [];
  try {
    const q = state.isAdmin ? fs.collection(db, 'swimGroups') : fs.query(fs.collection(db, 'swimGroups'), fs.where('evaluatorUids', 'array-contains', state.user.uid));
    groups = (await fs.getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')));
  } catch (e) { console.error(e); }
  el.innerHTML = '<div class="swim-head"><h2>생존수영 평가</h2><p>배정된 수업을 골라 학생별로 평가를 기록해 주세요.</p></div>' +
    (groups.length ? '<ul class="swim-groups">' + groups.map(g => '<li><a href="evaluate.html?g=' + encodeURIComponent(g.id) + '"><b>' + esc(groupTitle(g)) + '</b><small>' +
      esc([groupPeriod(g), g.status === 'open' ? '평가 중' : '평가 마감'].filter(Boolean).join(' · ')) + '</small></a></li>').join('') + '</ul>'
      : '<p class="board-empty">배정된 수업이 없습니다.</p>');
}
init();
