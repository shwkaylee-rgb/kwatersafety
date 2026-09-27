/* 관리자 > 자료실·제휴 탭: 회원 전용 자료 올리기(등급별 공개), 제휴 할인 등록 */
import { db, fs, toast, errMsg, esc, fmtDate, storageApi } from '../app.js';
import { LEVEL_NAMES, RES_CATEGORIES, fileSize, downloadResource } from '../library.js';
import { logAdmin } from '../admin-log.js';

const MAX = 20 * 1024 * 1024;
let box, view = 'res';
const levelSelect = (name, v) => '<select name="' + name + '">' + Object.entries(LEVEL_NAMES).map(([k, t]) => '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>';

export function tabLibrary(container) {
  box = container;
  box.innerHTML = '<div class="chips sub-chips">' + [['res', '자료실'], ['partner', '제휴 할인']].map(([k, v]) =>
    '<button type="button" class="chip' + (k === view ? ' is-active' : '') + '" data-view="' + k + '">' + v + '</button>').join('') +
    '</div><div id="lib-view"><p class="board-empty">불러오는 중…</p></div>';
  box.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { view = b.getAttribute('data-view'); tabLibrary(box); }));
  (view === 'res' ? viewResources : viewPartners)();
}
const target = () => document.getElementById('lib-view');

/* ---------- 자료실 ---------- */
async function viewResources() {
  let list;
  try {
    const snap = await fs.getDocs(fs.collection(db, 'resources'));
    list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  } catch (e) { target().innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }
  target().innerHTML =
    '<form class="form-card wide" id="rf"><h2>자료 올리기</h2>' +
      '<p class="form-help">파일 하나에 20MB까지 올릴 수 있습니다. 회원은 공개 등급에 맞을 때만 받을 수 있고, 파일 주소가 알려져도 다른 사람은 받을 수 없습니다. 공개 등급을 바꾸려면 저장 후 목록에서 고치면 됩니다.</p>' +
      '<div class="form-row"><label>자료명<input name="title" required maxlength="80"></label>' +
      '<label>분류<select name="category">' + RES_CATEGORIES.map(c => '<option>' + c + '</option>').join('') + '</select></label></div>' +
      '<div class="form-row"><label>공개 등급' + levelSelect('level', 'paid') + '</label><label>파일<input type="file" name="file" required></label></div>' +
      '<label>설명 <small>(선택)</small><textarea name="description" rows="2" maxlength="300"></textarea></label>' +
      '<div class="btn-row"><button class="btn btn-primary" type="submit">올리기</button></div></form>' +
    '<h3 class="list-title">자료 ' + list.length + '건</h3>' +
    '<div class="table-scroll"><table class="board-table"><thead><tr><th>분류</th><th>자료명</th><th>공개</th><th>파일</th><th>받은 수</th><th class="col-date">올린 날</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map(r => '<tr data-id="' + r.id + '"><td>' + esc(r.category) + '</td><td class="col-title">' + esc(r.title) + (r.open === false ? ' <small class="muted">(숨김)</small>' : '') + '</td>' +
        '<td>' + levelSelect('lv', r.level) + '</td><td class="nowrap"><small>' + esc(r.fileName) + '<br>' + fileSize(r.size) + '</small></td><td>' + (r.downloads || 0) + '</td>' +
        '<td class="col-date">' + fmtDate(r.createdAt) + '</td><td class="nowrap"><button type="button" class="link-btn" data-get="' + r.id + '">받기</button> ' +
        '<button type="button" class="link-btn" data-hide="' + r.id + '">' + (r.open === false ? '보이기' : '숨기기') + '</button> <button type="button" class="link-btn" data-del="' + r.id + '">삭제</button></td></tr>').join('')
        : '<tr><td colspan="7">올린 자료가 없습니다.</td></tr>') +
    '</tbody></table></div>';

  const f = document.getElementById('rf');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const file = f.file.files[0];
    if (!file) { toast('파일을 골라 주세요.'); return; }
    if (file.size > MAX) { toast('20MB보다 큰 파일은 올릴 수 없습니다.'); return; }
    const btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = '올리는 중…';
    try {
      const ref = fs.doc(fs.collection(db, 'resources'));
      const path = 'resources/' + ref.id + '_' + file.name.replace(/[^\w.\-가-힣]/g, '_').slice(-80);
      const { m, s } = await storageApi();
      const fileRef = m.ref(s, path);
      await m.uploadBytes(fileRef, file, { contentType: file.type || 'application/octet-stream' });
      await fs.setDoc(ref, { title: f.title.value.trim(), category: f.category.value, description: f.description.value.trim(), level: f.level.value,
        path, bucket: fileRef.bucket, fileName: file.name, contentType: file.type || 'application/octet-stream', size: file.size, open: true, downloads: 0, createdAt: fs.serverTimestamp() });
      logAdmin('자료 올리기', f.title.value.trim(), file.name + ' · ' + LEVEL_NAMES[f.level.value]);
      toast('올렸습니다.'); viewResources();
    } catch (err) { toast(errMsg(err)); btn.disabled = false; btn.textContent = '올리기'; }
  });
  target().querySelectorAll('[name=lv]').forEach(sel => sel.addEventListener('change', async () => {
    try { await fs.updateDoc(fs.doc(db, 'resources', sel.closest('tr').dataset.id), { level: sel.value }); toast('공개 등급을 바꿨습니다.'); }
    catch (err) { toast(errMsg(err)); }
  }));
  target().querySelectorAll('[data-get]').forEach(b => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await downloadResource(b.dataset.get); } catch (err) { toast(errMsg(err)); }
    b.disabled = false;
  }));
  target().querySelectorAll('[data-hide]').forEach(b => b.addEventListener('click', async () => {
    const r = list.find(x => x.id === b.dataset.hide);
    try { await fs.updateDoc(fs.doc(db, 'resources', r.id), { open: r.open === false }); viewResources(); } catch (err) { toast(errMsg(err)); }
  }));
  target().querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    const r = list.find(x => x.id === b.dataset.del);
    if (!confirm('「' + r.title + '」 자료를 삭제할까요? 파일도 함께 지워집니다.')) return;
    try {
      const { m, s } = await storageApi();
      await m.deleteObject(m.ref(s, r.path)).catch(e => { if (e.code !== 'storage/object-not-found') throw e; });
      await fs.deleteDoc(fs.doc(db, 'resources', r.id));
      logAdmin('자료 삭제', r.title, r.fileName);
      toast('삭제했습니다.'); viewResources();
    } catch (err) { toast(errMsg(err)); }
  }));
}

/* ---------- 제휴 할인 ---------- */
async function viewPartners(editing) {
  let list, codes;
  try {
    const [p, c] = await Promise.all([fs.getDocs(fs.collection(db, 'partners')), fs.getDocs(fs.collection(db, 'partnerCodes'))]);
    list = p.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0));
    codes = Object.fromEntries(c.docs.map(d => [d.id, d.data()]));
  } catch (e) { target().innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }
  const o = editing ? { ...editing, ...(codes[editing.id] || {}) } : { name: '', category: '', benefit: '', description: '', link: '', level: 'paid', validUntil: '', open: true, order: 0, code: '', howTo: '' };
  target().innerHTML =
    '<table class="board-table"><thead><tr><th>제휴처</th><th>혜택</th><th>공개</th><th class="col-date">유효기간</th><th>상태</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map(p => '<tr><td class="col-title">' + esc(p.name) + (p.category ? '<br><small>' + esc(p.category) + '</small>' : '') + '</td><td>' + esc(p.benefit) + '</td>' +
        '<td>' + LEVEL_NAMES[p.level || 'all'] + '</td><td class="col-date">' + esc(p.validUntil || '상시') + '</td><td>' + (p.open === false ? '<span class="status status-취소">숨김</span>' : '<span class="status status-승인">공개</span>') + '</td>' +
        '<td class="nowrap"><button type="button" class="link-btn" data-edit="' + p.id + '">수정</button> <button type="button" class="link-btn" data-del="' + p.id + '">삭제</button></td></tr>').join('')
        : '<tr><td colspan="6">등록된 제휴 할인이 없습니다.</td></tr>') +
    '</tbody></table>' +
    '<form class="form-card wide" id="pf" data-id="' + (editing ? editing.id : '') + '"><h2>' + (editing ? '제휴 할인 수정' : '제휴 할인 등록') + '</h2>' +
      '<div class="form-row"><label>제휴처 이름<input name="name" required maxlength="60" value="' + esc(o.name) + '"></label>' +
      '<label>분야 <small>(예: 수영용품, 숙박)</small><input name="category" maxlength="30" value="' + esc(o.category) + '"></label></div>' +
      '<div class="form-row"><label>혜택 <small>(예: 전 품목 15% 할인)</small><input name="benefit" required maxlength="60" value="' + esc(o.benefit) + '"></label>' +
      '<label>공개 등급' + levelSelect('level', o.level) + '</label></div>' +
      '<label>설명 <small>(선택)</small><textarea name="description" rows="2" maxlength="300">' + esc(o.description) + '</textarea></label>' +
      '<div class="form-row"><label>할인 코드 <small>(등급에 맞는 회원에게만 보임)</small><input name="code" maxlength="60" value="' + esc(o.code) + '"></label>' +
      '<label>사용 방법 <small>(선택)</small><input name="howTo" maxlength="200" value="' + esc(o.howTo) + '" placeholder="예: 결제 화면 쿠폰 칸에 입력"></label></div>' +
      '<div class="form-row"><label>제휴처 주소 <small>(https://…)</small><input name="link" maxlength="300" value="' + esc(o.link) + '"></label>' +
      '<label>유효기간 <small>(비우면 상시)</small><input type="date" name="validUntil" value="' + esc(o.validUntil) + '"></label></div>' +
      '<div class="form-row"><label>정렬 순서 <small>(작을수록 앞)</small><input type="number" name="order" value="' + esc(o.order || 0) + '"></label>' +
      '<label class="check"><input type="checkbox" name="open"' + (o.open !== false ? ' checked' : '') + '> 회원에게 공개</label></div>' +
      '<div class="btn-row">' + (editing ? '<button type="button" class="btn btn-outline" id="pf-cancel">취소</button>' : '') + '<button class="btn btn-primary" type="submit">' + (editing ? '수정 완료' : '등록') + '</button></div></form>';

  target().querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => viewPartners(list.find(p => p.id === b.dataset.edit))));
  target().querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('이 제휴 할인을 삭제할까요?')) return;
    const p = list.find(x => x.id === b.dataset.del);
    try { const batch = fs.writeBatch(db); batch.delete(fs.doc(db, 'partners', p.id)); batch.delete(fs.doc(db, 'partnerCodes', p.id)); await batch.commit(); logAdmin('제휴 할인 삭제', p.name); toast('삭제했습니다.'); viewPartners(); }
    catch (err) { toast(errMsg(err)); }
  }));
  const cancel = document.getElementById('pf-cancel');
  if (cancel) cancel.addEventListener('click', () => viewPartners());
  const f = document.getElementById('pf');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const link = f.link.value.trim();
    if (link && !/^https:\/\//.test(link)) { toast('제휴처 주소는 https:// 로 시작해야 합니다.'); return; }
    try {
      const ref = f.dataset.id ? fs.doc(db, 'partners', f.dataset.id) : fs.doc(fs.collection(db, 'partners'));
      const batch = fs.writeBatch(db);
      batch.set(ref, { name: f.name.value.trim(), category: f.category.value.trim(), benefit: f.benefit.value.trim(), description: f.description.value.trim(),
        link, level: f.level.value, validUntil: f.validUntil.value, order: Number(f.order.value) || 0, open: f.open.checked, updatedAt: fs.serverTimestamp() });
      batch.set(fs.doc(db, 'partnerCodes', ref.id), { code: f.code.value.trim(), howTo: f.howTo.value.trim() });
      await batch.commit();
      logAdmin(f.dataset.id ? '제휴 할인 수정' : '제휴 할인 등록', f.name.value.trim(), f.benefit.value.trim());
      toast('저장했습니다.'); viewPartners();
    } catch (err) { toast(errMsg(err)); }
  });
}
