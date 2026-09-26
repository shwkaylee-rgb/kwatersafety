/* 관리자 > 교육 이수 탭: 대면 교육·자격 과정별 수강생 명단, 이수·미이수·점수 기록, 이수번호 발급
   completions/{신청서ID}_{과정ID}: { uid, applicationId, programId, programTitle, category, programDate,
     name, birth, result: '이수'|'미이수', score, comment, completedOn, certNo } */
import { db, fs, toast, errMsg, esc } from '../app.js';
import { todayYmd } from '../membership.js';

let box;
const view = () => document.getElementById('edu-view');
export const completionId = (appId, programId) => appId + '_' + programId;

export async function tabEdu(container) {
  box = container;
  box.innerHTML = '<div id="edu-view"><p class="board-empty">불러오는 중…</p></div>';
  let programs, apps, comps;
  try {
    const [pSnap, aSnap, cSnap] = await Promise.all([
      fs.getDocs(fs.collection(db, 'programs')), fs.getDocs(fs.collection(db, 'applications')), fs.getDocs(fs.collection(db, 'completions'))
    ]);
    programs = pSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.type !== 'online');
    apps = aSnap.docs.map(d => ({ id: d.id, items: [], ...d.data() })).filter(a => a.status === '승인');
    comps = Object.fromEntries(cSnap.docs.map(d => [d.id, d.data()]));
  } catch (e) { view().innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }

  // 과정별 승인된 수강생 수·이수 수
  const roster = pid => apps.filter(a => a.items.some(i => i.programId === pid && i.type !== 'online'));
  view().innerHTML =
    '<p class="form-help">신청 관리에서 <b>승인</b>한 수강생이 과정별로 모입니다. 교육이 끝나면 과정을 골라 이수 결과를 기록하세요. 이수 처리하면 이수번호가 붙고, 회원은 마이페이지에서 이수증을 받을 수 있습니다.</p>' +
    '<div class="table-scroll"><table class="board-table"><thead><tr><th>구분</th><th>과정명</th><th class="col-date">일정</th><th>수강생</th><th>이수</th><th></th></tr></thead><tbody>' +
    (programs.length ? programs.map(p => {
      const r = roster(p.id), done = r.filter(a => (comps[completionId(a.id, p.id)] || {}).result === '이수').length;
      return '<tr><td>' + esc(p.category) + '</td><td class="col-title">' + esc(p.title) + '</td><td class="col-date">' + esc(p.date || '') + '</td>' +
        '<td>' + r.length + '명</td><td>' + done + '명</td><td>' + (r.length ? '<button type="button" class="btn btn-outline btn-sm" data-roster="' + p.id + '">이수 처리</button>' : '<span class="muted">수강생 없음</span>') + '</td></tr>';
    }).join('') : '<tr><td colspan="6">등록된 대면 과정이 없습니다.</td></tr>') +
    '</tbody></table></div>';
  view().querySelectorAll('[data-roster]').forEach(b => b.addEventListener('click', () => rosterView(programs.find(p => p.id === b.getAttribute('data-roster')), roster(b.getAttribute('data-roster')), comps)));
}

function rosterView(program, apps, comps) {
  const today = todayYmd();
  const rows = apps.map(a => ({ a, c: comps[completionId(a.id, program.id)] || null }))
    .sort((x, y) => String(x.a.applicant.name).localeCompare(String(y.a.applicant.name), 'ko'));
  view().innerHTML =
    '<p><button type="button" class="link-btn" id="edu-back">← 과정 목록</button></p>' +
    '<h3 class="list-title">' + esc(program.title) + ' · 수강생 ' + rows.length + '명</h3>' +
    '<div class="admin-toolbar"><label class="inline-field">이수일 <input type="date" id="edu-date" value="' + today + '"></label>' +
      '<div class="btn-row"><button type="button" class="btn btn-outline btn-sm" id="edu-all">결과 없는 수강생 모두 "이수"로</button>' +
      '<button type="button" class="btn btn-outline btn-sm" id="edu-csv">CSV 내려받기</button></div></div>' +
    '<div class="table-scroll"><table class="board-table edu-table"><thead><tr><th>이름</th><th>생년월일</th><th>결과</th><th>점수</th><th>평가 의견</th><th>이수번호</th><th></th></tr></thead><tbody>' +
    rows.map(({ a, c }) => '<tr data-app="' + a.id + '">' +
      '<td>' + esc(a.applicant.name) + (a.applicant.guardianName ? '<br><small>보호자 ' + esc(a.applicant.guardianName) + '</small>' : '') + '</td>' +
      '<td>' + esc(a.applicant.birth || '') + '</td>' +
      '<td><select data-f="result"><option value="">대기</option><option' + (c && c.result === '이수' ? ' selected' : '') + '>이수</option><option' + (c && c.result === '미이수' ? ' selected' : '') + '>미이수</option></select></td>' +
      '<td><input type="number" min="0" max="100" class="mini-input" data-f="score" placeholder="선택" value="' + (c && c.score != null ? c.score : '') + '"></td>' +
      '<td><input class="mini-input wide" data-f="comment" placeholder="선택" value="' + esc(c ? c.comment || '' : '') + '"></td>' +
      '<td class="nowrap">' + esc(c && c.certNo || '') + (c && c.completedOn ? '<br><small>' + esc(c.completedOn) + '</small>' : '') + '</td>' +
      '<td><button type="button" class="btn btn-primary btn-sm" data-save="' + a.id + '">저장</button></td></tr>').join('') +
    '</tbody></table></div>';
  document.getElementById('edu-back').addEventListener('click', () => tabEdu(box));

  async function save(a, result, score, comment) {
    const ref = fs.doc(db, 'completions', completionId(a.id, program.id));
    const completedOn = document.getElementById('edu-date').value || todayYmd();
    await fs.runTransaction(db, async tx => {
      const cur = await tx.get(ref), ctrRef = fs.doc(db, 'counters', 'eduCert');
      const old = cur.exists() ? cur.data() : null;
      let certNo = old && old.certNo || '';
      if (result === '이수' && !certNo) {
        const year = completedOn.slice(0, 4), cs = await tx.get(ctrRef);
        let ctr = cs.exists() ? cs.data() : { year, seq: 0 };
        if (ctr.year !== year) ctr = { year, seq: 0 };
        ctr = { year, seq: ctr.seq + 1 };
        tx.set(ctrRef, ctr);
        certNo = 'KWSA-ED-' + year + '-' + String(ctr.seq).padStart(4, '0');
      }
      const data = {
        uid: a.uid, applicationId: a.id, programId: program.id, programTitle: program.title, category: program.category || '',
        programDate: program.date || '', name: a.applicant.name, birth: a.applicant.birth || '',
        result, score: score === '' ? null : Math.max(0, Math.min(100, Number(score))), comment,
        completedOn: result === '이수' ? (old && old.result === '이수' && old.completedOn ? old.completedOn : completedOn) : '',
        certNo: result === '이수' ? certNo : '', updatedAt: fs.serverTimestamp()
      };
      if (result === '미이수' && old && old.certNo) data.revokedCertNo = old.certNo;   // 이수 → 미이수로 바꾸면 이전 번호는 기록으로만 남김
      tx.set(ref, data);
      comps[completionId(a.id, program.id)] = data;
    });
  }
  const rowVal = tr => ({ result: tr.querySelector('[data-f=result]').value, score: tr.querySelector('[data-f=score]').value.trim(), comment: tr.querySelector('[data-f=comment]').value.trim() });

  view().querySelectorAll('[data-save]').forEach(b => b.addEventListener('click', async () => {
    const tr = b.closest('tr'), a = apps.find(x => x.id === b.getAttribute('data-save')), v = rowVal(tr);
    if (!v.result) { toast('결과(이수/미이수)를 골라 주세요.'); return; }
    b.disabled = true;
    try { await save(a, v.result, v.score, v.comment); toast(a.applicant.name + '님: ' + v.result + ' 저장'); rosterView(program, apps, comps); }
    catch (e) { toast(errMsg(e)); b.disabled = false; }
  }));
  document.getElementById('edu-all').addEventListener('click', async () => {
    const targets = rows.filter(({ c }) => !c || !c.result);
    if (!targets.length) { toast('결과가 없는 수강생이 없습니다.'); return; }
    if (!confirm('결과가 없는 수강생 ' + targets.length + '명을 모두 "이수" 처리하고 이수번호를 발급할까요?')) return;
    try {
      for (const { a } of targets) {
        const tr = view().querySelector('tr[data-app="' + a.id + '"]'), v = rowVal(tr);
        await save(a, '이수', v.score, v.comment);
      }
      toast(targets.length + '명을 이수 처리했습니다.'); rosterView(program, apps, comps);
    } catch (e) { toast(errMsg(e)); }
  });
  document.getElementById('edu-csv').addEventListener('click', () => {
    const lines = [['이름', '생년월일', '보호자', '휴대폰', '이메일', '결과', '점수', '평가 의견', '이수번호', '이수일']].concat(rows.map(({ a }) => {
      const c = comps[completionId(a.id, program.id)] || {};
      return [a.applicant.name, a.applicant.birth || '', a.applicant.guardianName || '', a.applicant.phone || '', a.applicant.email || '', c.result || '대기', c.score != null ? c.score : '', c.comment || '', c.certNo || '', c.completedOn || ''];
    }));
    const text = '﻿' + lines.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const el = document.createElement('a'); el.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    el.download = '이수현황_' + program.title + '_' + todayYmd() + '.csv'; el.click(); URL.revokeObjectURL(el.href);
  });
}
