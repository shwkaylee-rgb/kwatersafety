/* 관리자 > 생존수영 인증 탭
   - 수업: 학교·기관 수업 만들기 → 등록 링크를 학교에 전달 → 보호자가 직접 가입·등록 → 강사 평가(또는 엑셀) → 발급 → 일괄 인쇄
   - 평가 강사: 강사 회원에게 평가 권한 주기
   - 평가 항목: 새 수업의 기본 평가 항목 */
import { db, fs, state, toast, errMsg, esc, fmtDate, today } from '../app.js';
import { makeQrPoster, canvasBlob } from '../swim-qr.js';
import { logAdmin } from '../admin-log.js';
import { loadSwimItems, groupTitle, groupPeriod, regLink, fullyEvaluated, memberUntilOf, formatSwimNo, STUDENT_STATUS, RESULTS, DEFAULT_SWIM_ITEMS } from '../swim.js';

let box, view = 'groups';
const target = () => document.getElementById('sw-view');

export function tabSwim(container) {
  box = container;
  box.innerHTML = '<div class="chips sub-chips">' + [['groups', '수업'], ['evaluators', '평가 강사'], ['items', '평가 항목']].map(([k, v]) =>
    '<button type="button" class="chip' + (k === view ? ' is-active' : '') + '" data-view="' + k + '">' + v + '</button>').join('') +
    '</div><div id="sw-view"><p class="board-empty">불러오는 중…</p></div>';
  box.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { view = b.dataset.view; tabSwim(box); }));
  ({ groups: viewGroups, evaluators: viewEvaluators, items: viewItems })[view]();
}

async function loadEvaluators() {
  const snap = await fs.getDocs(fs.collection(db, 'evaluators'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() })).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
}

/* ---------- 수업 목록·만들기 ---------- */
async function viewGroups(editing) {
  let groups, studs, evals;
  try {
    const [g, s, e] = await Promise.all([fs.getDocs(fs.collection(db, 'swimGroups')), fs.getDocs(fs.collection(db, 'swimStudents')), loadEvaluators()]);
    groups = g.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.startDate || '').localeCompare(String(a.startDate || '')));
    studs = s.docs.map(d => d.data()); evals = e;
  } catch (err) { target().innerHTML = '<p class="board-empty">' + esc(errMsg(err)) + '</p>'; return; }
  const count = (gid, st) => studs.filter(s => s.groupId === gid && (!st || s.status === st)).length;
  const defaultItems = await loadSwimItems();
  const g0 = editing || { school: '', className: '', place: '', startDate: '', endDate: '', regDeadline: '', regOpen: true, evaluatorUids: [], items: defaultItems };
  target().innerHTML =
    '<p class="form-help">수업을 만들면 <b>등록 링크</b>가 생깁니다. 링크를 학교에 전달하면 보호자가 직접 가입하고 자녀 정보를 등록합니다(법정대리인 동의 포함). 등록한 학생만 평가·발급합니다.</p>' +
    '<div class="table-scroll"><table class="board-table"><thead><tr><th>학교·수업</th><th class="col-date">교육 기간</th><th>등록</th><th>평가 완료</th><th>발급</th><th>상태</th><th></th></tr></thead><tbody>' +
      (groups.length ? groups.map(g => '<tr><td class="col-title">' + esc(groupTitle(g)) + (g.programId ? '<br><small class="guardian-line">협회 교육</small>' : '') + '</td><td class="col-date">' + esc(groupPeriod(g)) + '</td>' +
        '<td>' + count(g.id) + '</td><td>' + count(g.id, 'evaluated') + '</td><td>' + count(g.id, 'issued') + '</td>' +
        '<td>' + (g.status !== 'open' ? '<span class="status status-취소">평가 마감</span>' : g.regOpen ? '<span class="status status-승인">등록 받는 중</span>' : '<span class="status status-접수완료">등록 마감</span>') + '</td>' +
        '<td class="nowrap"><button type="button" class="btn btn-outline btn-sm" data-open="' + g.id + '">관리</button> <button type="button" class="link-btn" data-edit="' + g.id + '">수정</button></td></tr>').join('')
        : '<tr><td colspan="7">만든 수업이 없습니다.</td></tr>') +
    '</tbody></table></div>' +
    '<form class="form-card wide" id="gf" data-id="' + (editing ? editing.id : '') + '"><h2>' + (editing ? '수업 수정' : '새 수업 만들기') + '</h2>' +
      '<div class="form-row"><label>학교·기관 이름<input name="school" required maxlength="60" placeholder="예: 서울OO초등학교" value="' + esc(g0.school) + '"></label>' +
      '<label>학년·반 또는 수업 이름 <small>(선택)</small><input name="className" maxlength="60" placeholder="예: 3학년" value="' + esc(g0.className) + '"></label></div>' +
      '<div class="form-row"><label>교육 시작일<input type="date" name="startDate" value="' + esc(g0.startDate) + '"></label><label>교육 종료일<input type="date" name="endDate" value="' + esc(g0.endDate) + '"></label></div>' +
      '<div class="form-row"><label>장소<input name="place" maxlength="60" value="' + esc(g0.place) + '"></label><label>보호자 등록 마감일 <small>(비우면 마감 없음)</small><input type="date" name="regDeadline" value="' + esc(g0.regDeadline) + '"></label></div>' +
      '<label>평가 항목 <small>(한 줄에 하나. 이미 평가를 시작한 수업은 바꾸지 않는 것이 좋습니다)</small><textarea name="items" rows="5">' + esc((g0.items || defaultItems).join('\n')) + '</textarea></label>' +
      '<fieldset class="choice"><legend>평가 강사</legend>' + (evals.length ? evals.map(e => '<label class="check"><input type="checkbox" name="ev" value="' + e.uid + '"' + ((g0.evaluatorUids || []).includes(e.uid) ? ' checked' : '') + '> ' + esc(e.name) + ' <small>' + esc(e.email) + '</small></label>').join('')
        : '<p class="form-help">지정된 평가 강사가 없습니다. [평가 강사]에서 먼저 추가하세요.</p>') + '</fieldset>' +
      '<label class="check"><input type="checkbox" name="regOpen"' + (g0.regOpen !== false ? ' checked' : '') + '> 보호자 등록 받기</label>' +
      '<div class="btn-row">' + (editing ? '<button type="button" class="btn btn-outline" id="gf-cancel">취소</button>' : '') + '<button class="btn btn-primary" type="submit">' + (editing ? '수정 완료' : '만들기') + '</button></div></form>' +
    '<div class="notice-box left"><h3>보관기간 지난 등록 정리</h3><p>인증서를 받지 못한 등록(평가 전·평가 미완료)은 <b>수업 종료 후 1년</b>이 지나면 보호자 연락처와 함께 삭제합니다. 발급된 인증은 준회원 기간 동안 보관하므로 지우지 않습니다.</p>' +
      '<button type="button" class="btn btn-outline btn-sm" id="sw-purge">보관기간 지난 미발급 등록 삭제</button></div>';

  target().querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => groupView(b.dataset.open)));
  document.getElementById('sw-purge').addEventListener('click', () => purgeUnissued(groups));
  target().querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => { viewGroups(groups.find(g => g.id === b.dataset.edit)); }));
  const cancel = document.getElementById('gf-cancel');
  if (cancel) cancel.addEventListener('click', () => viewGroups());
  const f = document.getElementById('gf');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const items = f.items.value.split('\n').map(x => x.trim()).filter(Boolean);
    if (!items.length) { toast('평가 항목을 하나 이상 적어 주세요.'); return; }
    const data = { school: f.school.value.trim(), className: f.className.value.trim(), place: f.place.value.trim(), startDate: f.startDate.value, endDate: f.endDate.value || f.startDate.value,
      regDeadline: f.regDeadline.value, regOpen: f.regOpen.checked, items, evaluatorUids: [...f.querySelectorAll('[name=ev]:checked')].map(x => x.value), updatedAt: fs.serverTimestamp() };
    try {
      if (f.dataset.id) { await fs.updateDoc(fs.doc(db, 'swimGroups', f.dataset.id), data); logAdmin('생존수영 수업 수정', groupTitle(data), groupPeriod(data)); }
      else { const ref = await fs.addDoc(fs.collection(db, 'swimGroups'), { ...data, status: 'open', createdAt: fs.serverTimestamp() }); logAdmin('생존수영 수업 만들기', groupTitle(data), groupPeriod(data)); toast('만들었습니다. 등록 링크를 학교에 전달해 주세요.'); return groupView(ref.id); }
      toast('저장했습니다.'); viewGroups();
    } catch (err) { toast(errMsg(err)); }
  });
}

/* ---------- 수업 관리: 명단·평가·발급 ---------- */
async function groupView(gid) {
  let g, students, contacts = {};
  try {
    const [gd, sd] = await Promise.all([fs.getDoc(fs.doc(db, 'swimGroups', gid)), fs.getDocs(fs.query(fs.collection(db, 'swimStudents'), fs.where('groupId', '==', gid)))]);
    g = { id: gd.id, ...gd.data() };
    students = sd.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.grade + a.name).localeCompare(String(b.grade + b.name), 'ko'));
    await Promise.all(students.map(async s => { const c = await fs.getDoc(fs.doc(db, 'swimContacts', s.id)); if (c.exists()) contacts[s.id] = c.data(); }));
  } catch (err) { target().innerHTML = '<p class="board-empty">' + esc(errMsg(err)) + '</p>'; return; }
  const items = g.items || [], link = regLink(g.id);
  const ready = students.filter(s => s.status === 'evaluated' && fullyEvaluated(s, items) && !s.certNo);
  const issued = students.filter(s => s.status === 'issued');
  target().innerHTML =
    '<p><button type="button" class="link-btn" id="back">← 수업 목록</button></p>' +
    '<h3 class="list-title">' + esc(groupTitle(g)) + ' <small>' + esc(groupPeriod(g)) + '</small></h3>' +
    '<div class="notice-box left"><h3>보호자 등록 링크</h3><p class="reg-link"><code>' + esc(link) + '</code> <button type="button" class="btn btn-outline btn-sm" id="copy">링크 복사</button></p>' +
      '<p class="form-help">학교 가정통신문·알림장에 이 링크를 넣어 보내 주세요. ' + (g.regOpen ? '지금 등록을 받고 있습니다' + (g.regDeadline ? ' (마감 ' + esc(g.regDeadline) + ')' : '') + '.' : '<b>등록을 받지 않는 상태</b>입니다.') + '</p>' +
      '<div class="qr-box"><div id="qr-out" class="qr-preview"><p class="board-empty">QR 안내 이미지를 만드는 중…</p></div>' +
      '<div class="qr-actions"><p class="form-help">학교 단체 채팅방·가정통신문에 그대로 올릴 수 있는 이미지입니다. 휴대폰 카메라로 QR을 비추면 등록 화면이 열립니다.</p>' +
        '<div class="btn-row left"><button type="button" class="btn btn-primary btn-sm" id="qr-save" disabled>이미지 저장</button>' +
        '<button type="button" class="btn btn-outline btn-sm" id="qr-share" disabled>공유하기</button>' +
        '<button type="button" class="btn btn-outline btn-sm" id="qr-copy" disabled>이미지 복사</button></div></div></div></div>' +
    '<div class="admin-toolbar"><p class="board-count">등록 <b>' + students.length + '</b> · 평가 완료 <b>' + students.filter(s => s.status === 'evaluated').length + '</b> · 발급 <b>' + issued.length + '</b></p>' +
      '<div class="btn-row"><button type="button" class="btn btn-outline btn-sm" id="xl-down">평가용 엑셀 내려받기</button>' +
      '<label class="btn btn-outline btn-sm file-btn">평가 엑셀 올리기<input type="file" id="xl-up" accept=".xlsx,.xls,.csv" hidden></label>' +
      '<button type="button" class="btn btn-outline btn-sm" id="toggle">' + (g.status === 'open' ? '평가 마감' : '평가 다시 열기') + '</button></div></div>' +
    '<div class="table-scroll"><table class="board-table edu-table"><thead><tr><th>이름</th><th>생년월일·학년</th><th>보호자</th>' + items.map(i => '<th>' + esc(i) + '</th>').join('') + '<th>상태</th><th></th></tr></thead><tbody>' +
      (students.length ? students.map(s => { const c = contacts[s.id] || {}, lock = s.status === 'issued';
        return '<tr data-s="' + s.id + '"><td>' + esc(s.name) + (s.registrant === 'self' ? '<br><small>본인 등록</small>' : '') + '</td><td><small>' + esc(s.birth) + '<br>' + esc(s.grade || '') + '</small></td>' +
          '<td><small>' + esc(c.guardianName || '') + (c.relation ? ' (' + esc(c.relation) + ')' : '') + '<br>' + esc(c.phone || '') + '</small></td>' +
          items.map(i => '<td><select data-item="' + esc(i) + '"' + (lock ? ' disabled' : '') + '><option value="">–</option>' + RESULTS.map(r => '<option' + ((s.results || {})[i] === r ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></td>').join('') +
          '<td class="nowrap">' + STUDENT_STATUS[s.status] + (s.certNo ? '<br><small>' + esc(s.certNo) + '</small>' : '') + '</td>' +
          '<td class="nowrap">' + (lock ? '<a class="link-btn" href="swim-certificate.html?id=' + encodeURIComponent(s.id) + '" target="_blank">인증서</a>' : '<button type="button" class="link-btn" data-del="' + s.id + '">삭제</button>') + '</td></tr>'; }).join('')
        : '<tr><td colspan="' + (items.length + 5) + '">아직 등록한 학생이 없습니다.</td></tr>') +
    '</tbody></table></div>' +
    '<div class="notice-box left"><h3>인증서 발급</h3>' +
      '<p>모든 항목의 평가가 끝난 학생 <b>' + ready.length + '</b>명에게 인증번호를 붙이고, 보호자에게 알림·메일을 보냅니다. 발급한 뒤에는 평가 결과를 고칠 수 없습니다.' +
        (students.length - issued.length - ready.length > 0 ? ' 평가가 끝나지 않은 ' + (students.length - issued.length - ready.length) + '명은 이번에 발급하지 않습니다.' : '') + '</p>' +
      '<div class="btn-row left"><label class="inline-field">발급일 <input type="date" id="issue-on" value="' + (g.endDate && g.endDate <= today() ? g.endDate : today()) + '"></label>' +
      '<button type="button" class="btn btn-primary btn-sm" id="issue"' + (ready.length ? '' : ' disabled') + '>' + ready.length + '명 발급</button>' +
      (issued.length ? '<a class="btn btn-outline btn-sm" href="swim-certificate.html?group=' + encodeURIComponent(g.id) + '" target="_blank">인증서 일괄 인쇄 (' + issued.length + '장)</a>' : '') +
      '<button type="button" class="btn btn-outline btn-sm" id="csv">명단 CSV</button></div></div>';

  document.getElementById('back').addEventListener('click', () => viewGroups());
  // QR 안내 이미지: 저장(내려받기) · 공유(휴대폰 공유 창) · 복사(붙여넣기용)
  (async () => {
    const out = document.getElementById('qr-out'), fileName = '생존수영인증등록_' + groupTitle(g).replace(/\s/g, '') + '.png';
    try {
      const canvas = await makeQrPoster(g, link), blob = await canvasBlob(canvas), url = URL.createObjectURL(blob);
      if (!document.body.contains(out)) return;
      out.innerHTML = '<img src="' + url + '" alt="' + esc(groupTitle(g)) + ' 생존수영 인증 등록 QR 안내 이미지">';
      const file = new File([blob], fileName, { type: 'image/png' });
      const save = document.getElementById('qr-save'), share = document.getElementById('qr-share'), copy = document.getElementById('qr-copy');
      save.disabled = false;
      save.addEventListener('click', () => { const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        share.disabled = false;
        share.addEventListener('click', async () => { try { await navigator.share({ files: [file], title: groupTitle(g) + ' 생존수영 인증 등록', text: '생존수영 능력 인증서 등록 안내입니다. ' + link }); } catch (e) { if (e.name !== 'AbortError') toast('공유하지 못했습니다. [이미지 저장]을 이용해 주세요.'); } });
      } else share.title = '이 기기에서는 공유 창을 쓸 수 없습니다. [이미지 저장] 후 보내 주세요.';
      if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        copy.disabled = false;
        copy.addEventListener('click', async () => { try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast('이미지를 복사했습니다. 카카오톡 등에 붙여 넣으세요.'); } catch (e) { toast('복사하지 못했습니다. [이미지 저장]을 이용해 주세요.'); } });
      }
    } catch (e) { out.innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; }
  })();
  document.getElementById('copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(link); toast('링크를 복사했습니다.'); } catch (e) { toast('복사하지 못했습니다. 링크를 직접 선택해 복사해 주세요.'); } });
  document.getElementById('toggle').addEventListener('click', async () => {
    try { await fs.updateDoc(fs.doc(db, 'swimGroups', g.id), { status: g.status === 'open' ? 'closed' : 'open' }); logAdmin(g.status === 'open' ? '생존수영 평가 마감' : '생존수영 평가 다시 열기', groupTitle(g)); groupView(g.id); } catch (e) { toast(errMsg(e)); }
  });
  // 관리자가 표에서 바로 결과 고치기
  target().querySelectorAll('select[data-item]').forEach(sel => sel.addEventListener('change', async () => {
    const s = students.find(x => x.id === sel.closest('tr').dataset.s);
    const results = { ...(s.results || {}) };
    if (sel.value) results[sel.dataset.item] = sel.value; else delete results[sel.dataset.item];
    const status = fullyEvaluated({ results }, items) ? 'evaluated' : 'registered';
    try { await fs.updateDoc(fs.doc(db, 'swimStudents', s.id), { results, status, evaluatedBy: state.user.uid, evaluatedAt: fs.serverTimestamp() }); s.results = results; s.status = status; sel.closest('tr').children[3 + items.length].textContent = STUDENT_STATUS[status]; }
    catch (e) { toast(errMsg(e)); }
  }));
  target().querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    const s = students.find(x => x.id === b.dataset.del);
    if (!confirm(s.name + ' 학생 등록을 삭제할까요? 보호자 연락처도 함께 지워집니다.')) return;
    try { const batch = fs.writeBatch(db); batch.delete(fs.doc(db, 'swimContacts', s.id)); batch.delete(fs.doc(db, 'swimStudents', s.id)); await batch.commit(); logAdmin('생존수영 등록 삭제', s.name + ' · ' + groupTitle(g)); toast('삭제했습니다.'); groupView(g.id); }
    catch (e) { toast(errMsg(e)); }
  }));
  document.getElementById('xl-down').addEventListener('click', async () => {
    try {
      const X = await loadXLSX();
      const rows = [['등록번호', '이름', '생년월일', '학년·반'].concat(items)].concat(students.filter(s => s.status !== 'issued').map(s => [s.id, s.name, s.birth, s.grade || ''].concat(items.map(i => (s.results || {})[i] || ''))));
      const ws = X.utils.aoa_to_sheet(rows); ws['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 12 }, { wch: 12 }].concat(items.map(() => ({ wch: 14 })));
      const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, '평가');
      X.writeFile(wb, '생존수영평가_' + groupTitle(g).replace(/\s/g, '') + '.xlsx');
      toast('항목 칸에 이수 또는 미이수(O·X도 됨)를 적어 올려 주세요. 등록번호 칸은 고치지 마세요.');
    } catch (e) { toast(errMsg(e)); }
  });
  document.getElementById('xl-up').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      const X = await loadXLSX(), wb = X.read(await file.arrayBuffer());
      const rows = X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
      const head = rows[0].map(h => String(h).trim()), idCol = head.indexOf('등록번호');
      if (idCol < 0) { toast('"등록번호" 칸이 없습니다. 내려받은 평가용 엑셀을 써 주세요.'); return; }
      let ok = 0, skip = 0, bad = 0; const writes = [];
      for (const r of rows.slice(1)) {
        const s = students.find(x => x.id === String(r[idCol]).trim());
        if (!s || s.status === 'issued') { if (String(r[idCol]).trim()) skip++; continue; }
        const results = { ...(s.results || {}) };
        items.forEach(i => { const c = head.indexOf(i); if (c < 0) return; const v = normResult(r[c]); if (v === null) bad++; else if (v) results[i] = v; });
        const status = fullyEvaluated({ results }, items) ? 'evaluated' : 'registered';
        writes.push([s.id, { results, status, evaluatedBy: state.user.uid, evaluatedAt: fs.serverTimestamp() }]); ok++;
      }
      for (let i = 0; i < writes.length; i += 400) { const batch = fs.writeBatch(db); writes.slice(i, i + 400).forEach(([id, d]) => batch.update(fs.doc(db, 'swimStudents', id), d)); await batch.commit(); }
      logAdmin('생존수영 평가 엑셀 반영', groupTitle(g), ok + '명');
      toast(ok + '명 반영' + (skip ? ', 모르는 번호·발급 완료 ' + skip + '줄 건너뜀' : '') + (bad ? ', 알 수 없는 값 ' + bad + '칸은 비워 둠' : ''));
      groupView(g.id);
    } catch (err) { toast(errMsg(err)); }
  });
  document.getElementById('issue').addEventListener('click', async () => {
    const on = document.getElementById('issue-on').value || today();
    if (!confirm(ready.length + '명에게 ' + on + ' 날짜로 인증서를 발급할까요?')) return;
    try { await issueCerts(g, ready, on); logAdmin('생존수영 인증서 발급', groupTitle(g), ready.length + '명 · 발급일 ' + on); toast(ready.length + '명에게 발급했습니다.'); groupView(g.id); } catch (e) { toast(errMsg(e)); }
  });
  document.getElementById('csv').addEventListener('click', () => {
    const rows = [['인증번호', '이름', '생년월일', '학년·반', '보호자', '관계', '연락처'].concat(items, ['상태', '발급일', '준회원 기간'])].concat(students.map(s => {
      const c = contacts[s.id] || {};
      return [s.certNo || '', s.name, s.birth, s.grade || '', c.guardianName || '', c.relation || '', c.phone || ''].concat(items.map(i => (s.results || {})[i] || ''), [STUDENT_STATUS[s.status], s.issuedOn || '', s.memberUntil || '']);
    }));
    const text = '﻿' + rows.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = '생존수영인증_' + groupTitle(g).replace(/\s/g, '') + '.csv'; a.click(); URL.revokeObjectURL(a.href);
  });
}

// 엑셀 값 → 이수 / 미이수 / ''(빈칸) / null(알 수 없음)
function normResult(v) {
  const x = String(v == null ? '' : v).trim().toUpperCase();
  if (!x) return '';
  if (['이수', 'O', '○', 'Y', '통과', '1'].includes(x)) return '이수';
  if (['미이수', 'X', '×', 'N', '미통과', '0'].includes(x)) return '미이수';
  return null;
}
function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = () => res(window.XLSX); s.onerror = () => rej(new Error('엑셀 기능을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'));
    document.head.appendChild(s);
  });
}

// 발급: 인증번호를 한 번에 예약한 뒤 나눠서 기록, 보호자에게 알림(메일도 발송)
async function issueCerts(g, list, on) {
  const year = on.slice(0, 4), ctrRef = fs.doc(db, 'counters', 'swimCert');
  let start = 0;
  await fs.runTransaction(db, async tx => {
    const cs = await tx.get(ctrRef);
    let c = cs.exists() ? cs.data() : { year, seq: 0 };
    if (c.year !== year) c = { year, seq: 0 };
    start = c.seq + 1;
    tx.set(ctrRef, { year, seq: c.seq + list.length });
  });
  const until = memberUntilOf(on);
  for (let i = 0; i < list.length; i += 200) {
    const batch = fs.writeBatch(db);
    list.slice(i, i + 200).forEach((s, k) => {
      const certNo = formatSwimNo(year, start + i + k);
      batch.update(fs.doc(db, 'swimStudents', s.id), { certNo, issuedOn: on, memberUntil: until, status: 'issued', issuedAt: fs.serverTimestamp() });
      batch.set(fs.doc(fs.collection(db, 'notifications')), { uid: s.uid, type: 'swim', title: s.name + ' 학생의 생존수영 능력 인증서가 발급되었습니다',
        body: groupTitle(g) + ' · 인증번호 ' + certNo + '\n' + until + '까지 대한수상안전협회 준회원으로 등록됩니다.', link: 'swim-certificate.html?id=' + encodeURIComponent(s.id), read: false, createdAt: fs.serverTimestamp() });
    });
    await batch.commit();
  }
  await fs.updateDoc(fs.doc(db, 'swimGroups', g.id), { lastIssuedOn: on });
}

/* ---------- 협회 교육과 연결: 승인된 수강생에게 등록 링크 알림 ---------- */
export async function groupFromProgram(program, apps) {
  const ref = await fs.addDoc(fs.collection(db, 'swimGroups'), {
    school: '협회 교육', className: program.title, place: program.place || '', startDate: program.endDate || '', endDate: program.endDate || '',
    regDeadline: '', regOpen: true, status: 'open', items: await loadSwimItems(), evaluatorUids: [], programId: program.id, createdAt: fs.serverTimestamp()
  });
  const uids = [...new Set(apps.map(a => a.uid).filter(Boolean))];
  for (let i = 0; i < uids.length; i += 400) {
    const batch = fs.writeBatch(db);
    uids.slice(i, i + 400).forEach(uid => batch.set(fs.doc(fs.collection(db, 'notifications')), { uid, type: 'swim', title: '「' + program.title + '」 생존수영 능력 인증서 발급을 위해 학생 정보를 등록해 주세요',
      body: '교육을 받은 학생(자녀) 정보를 등록하면 평가 후 인증서를 발급해 드립니다.', link: 'swim.html?g=' + ref.id, read: false, createdAt: fs.serverTimestamp() }));
    await batch.commit();
  }
  return { id: ref.id, notified: uids.length };
}

/* ---------- 평가 강사 ---------- */
async function viewEvaluators() {
  let list;
  try { list = await loadEvaluators(); } catch (e) { target().innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }
  target().innerHTML =
    '<p class="form-help">평가 강사는 배정된 수업의 학생 이름·생년월일·학년과 평가 결과만 볼 수 있습니다. 보호자 연락처는 볼 수 없습니다. 강사는 홈페이지에 먼저 회원가입해야 합니다.</p>' +
    '<form class="form-card wide" id="ef"><div class="form-row"><label>강사 회원 이메일<input type="email" name="email" required></label>' +
      '<div class="btn-row"><button class="btn btn-primary" type="submit">평가 강사로 지정</button></div></div></form>' +
    '<div class="table-scroll"><table class="board-table"><thead><tr><th>이름</th><th>이메일</th><th class="col-date">지정일</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map(e => '<tr><td>' + esc(e.name) + '</td><td class="col-title">' + esc(e.email) + '</td><td class="col-date">' + fmtDate(e.createdAt) + '</td>' +
        '<td><button type="button" class="link-btn" data-del="' + e.uid + '">해제</button></td></tr>').join('') : '<tr><td colspan="4">지정된 평가 강사가 없습니다.</td></tr>') +
    '</tbody></table></div><p class="form-help">강사는 로그인한 뒤 <a href="evaluate.html" target="_blank">evaluate.html</a>(마이페이지 [평가하기])에서 평가합니다.</p>';
  const f = document.getElementById('ef');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const snap = await fs.getDocs(fs.query(fs.collection(db, 'users'), fs.where('email', '==', f.email.value.trim())));
      if (!snap.size) { toast('그 이메일로 가입한 회원이 없습니다. 강사가 먼저 회원가입해야 합니다.'); return; }
      const u = snap.docs[0];
      await fs.setDoc(fs.doc(db, 'evaluators', u.id), { name: u.data().name || '', email: u.data().email, createdAt: fs.serverTimestamp() });
      logAdmin('평가 강사 지정', u.data().name + ' · ' + u.data().email);
      toast(u.data().name + '님을 평가 강사로 지정했습니다. 수업 [수정]에서 배정해 주세요.'); viewEvaluators();
    } catch (err) { toast(errMsg(err)); }
  });
  target().querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('평가 강사 지정을 해제할까요? 배정된 모든 수업에서도 빠집니다.')) return;
    try {
      const gs = await fs.getDocs(fs.query(fs.collection(db, 'swimGroups'), fs.where('evaluatorUids', 'array-contains', b.dataset.del)));
      const batch = fs.writeBatch(db);
      gs.docs.forEach(d => batch.update(d.ref, { evaluatorUids: fs.arrayRemove(b.dataset.del) }));
      batch.delete(fs.doc(db, 'evaluators', b.dataset.del));
      await batch.commit(); const e0 = list.find(x => x.uid === b.dataset.del) || {}; logAdmin('평가 강사 해제', (e0.name || '') + ' · ' + (e0.email || '')); toast('해제했습니다.'); viewEvaluators();
    } catch (err) { toast(errMsg(err)); }
  }));
}

/* ---------- 기본 평가 항목 ---------- */
async function viewItems() {
  const items = await loadSwimItems();
  target().innerHTML = '<form class="form-card wide" id="if"><h2>기본 평가 항목</h2>' +
    '<p class="form-help">새로 만드는 수업에 들어가는 항목입니다. 이미 만든 수업은 그 수업의 [수정]에서 바꿉니다. 한 줄에 하나씩 적어 주세요.</p>' +
    '<textarea name="items" rows="7">' + esc(items.join('\n')) + '</textarea>' +
    '<div class="btn-row"><button type="button" class="btn btn-outline" id="reset">처음 항목으로</button><button class="btn btn-primary" type="submit">저장</button></div></form>';
  const f = document.getElementById('if');
  document.getElementById('reset').addEventListener('click', () => { f.items.value = DEFAULT_SWIM_ITEMS.join('\n'); });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const list = f.items.value.split('\n').map(x => x.trim()).filter(Boolean);
    if (!list.length) { toast('항목을 하나 이상 적어 주세요.'); return; }
    try { await fs.setDoc(fs.doc(db, 'settings', 'swimItems'), { items: list, updatedAt: fs.serverTimestamp() }); logAdmin('생존수영 기본 평가 항목 변경', '', list.join(', ')); toast('저장했습니다.'); }
    catch (err) { toast(errMsg(err)); }
  });
}

// 보관기간(수업 종료 후 1년) 지난 미발급 등록과 보호자 연락처 삭제
export const UNISSUED_KEEP_DAYS = 365;
async function purgeUnissued(groups) {
  const limit = new Date(); limit.setDate(limit.getDate() - UNISSUED_KEEP_DAYS);
  const cut = limit.getFullYear() + '-' + String(limit.getMonth() + 1).padStart(2, '0') + '-' + String(limit.getDate()).padStart(2, '0');
  const expired = new Set(groups.filter(g => (g.endDate || g.startDate) && (g.endDate || g.startDate) < cut).map(g => g.id));
  try {
    const snap = await fs.getDocs(fs.collection(db, 'swimStudents'));
    const old = snap.docs.filter(d => expired.has(d.data().groupId) && d.data().status !== 'issued');
    if (!old.length) { toast('보관기간이 지난 미발급 등록이 없습니다.'); return; }
    if (!confirm('수업 종료 후 1년이 지난 미발급 등록 ' + old.length + '건을 보호자 연락처와 함께 영구 삭제할까요?')) return;
    for (let i = 0; i < old.length; i += 200) {
      const batch = fs.writeBatch(db);
      old.slice(i, i + 200).forEach(d => { batch.delete(d.ref); batch.delete(fs.doc(db, 'swimContacts', d.id)); });
      await batch.commit();
    }
    logAdmin('생존수영 미발급 등록 일괄 삭제', '수업 종료 후 1년 지난 등록', old.length + '건');
    toast(old.length + '건을 삭제했습니다.'); viewGroups();
  } catch (err) { toast(errMsg(err)); }
}
