/* 관리자 > 활동 기록 탭: 누가 언제 무엇을 처리했는지 기간·관리자·작업별로 보기, CSV */
import { db, fs, toast, errMsg, esc, fmtDate, today } from '../app.js';
import { addDays } from '../membership.js';

const PAGE = 200;
let box, range = null;

export async function tabLogs(container) {
  box = container;
  range = range || { from: addDays(today(), -30), to: today() };
  box.innerHTML =
    '<p class="form-help">관리자가 처리한 상태 변경·발급·삭제 등이 자동으로 남습니다. 기록은 고치거나 지울 수 없습니다.</p>' +
    '<div class="admin-toolbar"><div class="btn-row left">' +
      '<label class="inline-field">시작 <input type="date" id="lg-from" value="' + range.from + '"></label>' +
      '<label class="inline-field">끝 <input type="date" id="lg-to" value="' + range.to + '"></label>' +
      '<button type="button" class="btn btn-outline btn-sm" id="lg-load">조회</button></div></div>' +
    '<div id="lg-view"><p class="board-empty">불러오는 중…</p></div>';
  document.getElementById('lg-load').addEventListener('click', () => {
    range = { from: document.getElementById('lg-from').value, to: document.getElementById('lg-to').value };
    if (!range.from || !range.to || range.from > range.to) { toast('기간을 확인해 주세요.'); return; }
    tabLogs(box);
  });
  load();
}

async function load(more) {
  const view = document.getElementById('lg-view');
  let logs = more ? more.logs : [], last = null, hasMore = false;
  try {
    const cons = [fs.where('at', '>=', new Date(range.from + 'T00:00:00+09:00')), fs.where('at', '<=', new Date(range.to + 'T23:59:59+09:00')), fs.orderBy('at', 'desc')];
    if (more) cons.push(fs.startAfter(more.last));
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'adminLogs'), ...cons, fs.limit(PAGE)));
    logs = logs.concat(snap.docs.map(d => d.data()));
    last = snap.docs[snap.docs.length - 1]; hasMore = snap.size === PAGE;
  } catch (e) { view.innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }

  const admins = [...new Set(logs.map(l => l.name))].sort(), actions = [...new Set(logs.map(l => l.action))].sort();
  let who = '', what = '';
  function draw() {
    const list = logs.filter(l => (!who || l.name === who) && (!what || l.action === what));
    view.innerHTML =
      '<div class="admin-toolbar"><div class="btn-row left">' +
        '<select id="lg-who"><option value="">모든 관리자</option>' + admins.map(a => '<option' + (a === who ? ' selected' : '') + '>' + esc(a) + '</option>').join('') + '</select>' +
        '<select id="lg-what"><option value="">모든 작업</option>' + actions.map(a => '<option' + (a === what ? ' selected' : '') + '>' + esc(a) + '</option>').join('') + '</select>' +
        '<span class="board-count">' + list.length + '건</span></div>' +
        '<button type="button" class="btn btn-outline btn-sm" id="lg-csv">CSV 내려받기</button></div>' +
      '<div class="table-scroll"><table class="board-table"><thead><tr><th class="col-date">일시</th><th>관리자</th><th>작업</th><th>대상</th><th>내용</th></tr></thead><tbody>' +
        (list.length ? list.map(l => '<tr><td class="col-date">' + fmtDate(l.at, true) + '</td><td>' + esc(l.name) + '</td><td class="nowrap">' + esc(l.action) + '</td>' +
          '<td class="col-title">' + esc(l.target) + '</td><td><small>' + esc(l.detail) + '</small></td></tr>').join('') : '<tr><td colspan="5">기록이 없습니다.</td></tr>') +
      '</tbody></table></div>' +
      (hasMore ? '<p class="btn-row"><button type="button" class="btn btn-outline btn-sm" id="lg-more">더 보기</button></p>' : '');
    document.getElementById('lg-who').addEventListener('change', e => { who = e.target.value; draw(); });
    document.getElementById('lg-what').addEventListener('change', e => { what = e.target.value; draw(); });
    const moreBtn = document.getElementById('lg-more');
    if (moreBtn) moreBtn.addEventListener('click', () => load({ logs, last }));
    document.getElementById('lg-csv').addEventListener('click', () => {
      const rows = [['일시', '관리자', '작업', '대상', '내용']].concat(list.map(l => [fmtDate(l.at, true), l.name, l.action, l.target, l.detail]));
      const text = '﻿' + rows.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
      a.download = '관리자활동기록_' + range.from + '_' + range.to + '.csv'; a.click(); URL.revokeObjectURL(a.href);
    });
  }
  draw();
}
