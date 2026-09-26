/* 관리자 > 온라인 학습 탭: 과정 만들기·수정(챕터, 문제 은행), 수강 현황 */
import { db, fs, toast, errMsg, esc, won, fmtDate } from '../app.js';
import { COURSE_DEFAULTS, ENR_STATUS_NAMES, enrollmentStatus, progressPercent, youtubeId, totalMinutes } from '../course.js';
import { addDays, todayYmd } from '../membership.js';

let box;
const rid = p => p + Math.random().toString(36).slice(2, 9);
const view = () => document.getElementById('ol-view');

export async function tabOnline(container) {
  box = container;
  box.innerHTML = '<div id="ol-view"><p class="board-empty">불러오는 중…</p></div>';
  let courses;
  try {
    const snap = await fs.getDocs(fs.collection(db, 'courses'));
    courses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { view().innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }
  view().innerHTML =
    '<div class="admin-toolbar"><p class="form-help">온라인 과정을 저장하면 교육·자격 신청 목록에 자동으로 올라갑니다. 수강생이 신청하면 [신청 관리]에서 <b>승인</b>할 때 수강이 열립니다.</p>' +
    '<button type="button" class="btn btn-primary btn-sm" id="ol-new">새 온라인 과정</button></div>' +
    (courses.length ? '<div class="table-scroll"><table class="board-table"><thead><tr><th>과정명</th><th>수강료</th><th>챕터</th><th>수강 기간</th><th>공개</th><th></th></tr></thead><tbody>' +
      courses.map(c => '<tr><td class="col-title">' + esc(c.title) + '</td><td>' + won(c.fee) + '</td><td>' + (c.chapters || []).length + '개 · ' + totalMinutes(c) + '분</td>' +
        '<td>' + (c.accessDays || '-') + '일</td><td>' + (c.open ? '<span class="mstatus mstatus-ok">공개</span>' : '<span class="mstatus mstatus-off">비공개</span>') + '</td>' +
        '<td class="nowrap"><button type="button" class="link-btn" data-edit="' + c.id + '">수정</button> <button type="button" class="link-btn" data-stat="' + c.id + '">수강 현황</button></td></tr>').join('') +
      '</tbody></table></div>' : '<p class="board-empty">등록된 온라인 과정이 없습니다.</p>');
  document.getElementById('ol-new').addEventListener('click', () => editor(null));
  view().querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editor(courses.find(c => c.id === b.getAttribute('data-edit')))));
  view().querySelectorAll('[data-stat]').forEach(b => b.addEventListener('click', () => stats(courses.find(c => c.id === b.getAttribute('data-stat')))));
}

/* ---------- 과정 편집 ---------- */
async function editor(course) {
  const id = course ? course.id : rid('course-');
  const c = Object.assign({ title: '', description: '', fee: 0, open: false, chapters: [] }, COURSE_DEFAULTS, course || {});
  let chapters = [], questions = [];
  if (course) {
    try {
      const [chSnap, exSnap] = await Promise.all([fs.getDocs(fs.collection(db, 'courses', id, 'chapters')), fs.getDoc(fs.doc(db, 'courseExams', id))]);
      const body = Object.fromEntries(chSnap.docs.map(d => [d.id, d.data()]));
      chapters = (c.chapters || []).map(m => ({ ...m, ...(body[m.id] || {}) }));
      questions = (exSnap.exists() && exSnap.data().questions) || [];
    } catch (e) { toast(errMsg(e)); return; }
  }

  function chapterRow(ch, i) {
    return '<div class="ed-row" data-i="' + i + '">' +
      '<div class="ed-head"><b>챕터 ' + (i + 1) + '</b><span>' +
        '<button type="button" class="link-btn" data-ch-up="' + i + '">위로</button> <button type="button" class="link-btn" data-ch-down="' + i + '">아래로</button> ' +
        '<button type="button" class="link-btn" data-ch-del="' + i + '">삭제</button></span></div>' +
      '<div class="form-row"><label>제목<input data-ch="title" value="' + esc(ch.title) + '"></label>' +
      '<label>유형<select data-ch="type"><option value="video"' + (ch.type === 'video' ? ' selected' : '') + '>영상 (유튜브)</option><option value="text"' + (ch.type === 'text' ? ' selected' : '') + '>글</option></select></label></div>' +
      '<div class="form-row"><label>' + (ch.type === 'video' ? '유튜브 주소 <small>(일부 공개 영상)</small><input data-ch="video" value="' + esc(ch.video || '') + '" placeholder="https://youtu.be/...">' : '예상 학습 시간은 오른쪽에 적어 주세요') + '</label>' +
      '<label>예상 시간(분)<input type="number" min="1" data-ch="minutes" value="' + esc(ch.minutes || '') + '"></label></div>' +
      '<label>' + (ch.type === 'video' ? '영상 아래 설명 <small>(선택)</small>' : '본문 <small>(줄바꿈 그대로 표시, http 주소는 자동 링크)</small>') +
      '<textarea rows="' + (ch.type === 'video' ? 3 : 8) + '" data-ch="body">' + esc(ch.body || '') + '</textarea></label>' +
      '</div>';
  }
  function questionRow(q, i) {
    return '<div class="ed-row" data-i="' + i + '">' +
      '<div class="ed-head"><b>문항 ' + (i + 1) + '</b><button type="button" class="link-btn" data-q-del="' + i + '">삭제</button></div>' +
      '<label>문제<textarea rows="2" data-q="question">' + esc(q.question) + '</textarea></label>' +
      '<div class="form-row">' + [0, 1, 2, 3].map(k => '<label>보기 ' + (k + 1) + '<input data-q="opt' + k + '" value="' + esc((q.options || [])[k] || '') + '"></label>').join('') + '</div>' +
      '<div class="form-row"><label>정답<select data-q="answer">' + [0, 1, 2, 3].map(k => '<option value="' + k + '"' + (q.answer === k ? ' selected' : '') + '>보기 ' + (k + 1) + '</option>').join('') + '</select></label>' +
      '<label>해설 <small>(틀렸을 때 보여 줌)</small><input data-q="explanation" value="' + esc(q.explanation || '') + '"></label></div>' +
      '</div>';
  }
  // 화면의 입력값을 배열에 반영
  function collect() {
    view().querySelectorAll('#ed-chapters .ed-row').forEach(r => {
      const ch = chapters[+r.getAttribute('data-i')];
      r.querySelectorAll('[data-ch]').forEach(x => { ch[x.getAttribute('data-ch')] = x.value; });
    });
    view().querySelectorAll('#ed-questions .ed-row').forEach(r => {
      const q = questions[+r.getAttribute('data-i')];
      q.question = r.querySelector('[data-q=question]').value;
      q.options = [0, 1, 2, 3].map(k => r.querySelector('[data-q=opt' + k + ']').value);
      q.answer = +r.querySelector('[data-q=answer]').value;
      q.explanation = r.querySelector('[data-q=explanation]').value;
    });
  }
  function drawLists() {
    document.getElementById('ed-chapters').innerHTML = chapters.length ? chapters.map(chapterRow).join('') : '<p class="board-empty">챕터를 추가해 주세요.</p>';
    document.getElementById('ed-questions').innerHTML = questions.length ? questions.map(questionRow).join('') : '<p class="board-empty">평가 문항을 추가해 주세요.</p>';
    document.getElementById('q-count').textContent = questions.length;
    const move = (i, d) => { collect(); const j = i + d; if (j < 0 || j >= chapters.length) return; [chapters[i], chapters[j]] = [chapters[j], chapters[i]]; drawLists(); };
    view().querySelectorAll('[data-ch-up]').forEach(b => b.addEventListener('click', () => move(+b.getAttribute('data-ch-up'), -1)));
    view().querySelectorAll('[data-ch-down]').forEach(b => b.addEventListener('click', () => move(+b.getAttribute('data-ch-down'), 1)));
    view().querySelectorAll('[data-ch-del]').forEach(b => b.addEventListener('click', () => { collect(); chapters.splice(+b.getAttribute('data-ch-del'), 1); drawLists(); }));
    view().querySelectorAll('[data-q-del]').forEach(b => b.addEventListener('click', () => { collect(); questions.splice(+b.getAttribute('data-q-del'), 1); drawLists(); }));
    view().querySelectorAll('[data-ch=type]').forEach(s => s.addEventListener('change', () => { collect(); drawLists(); }));
  }

  view().innerHTML =
    '<p><button type="button" class="link-btn" id="ed-back">← 과정 목록</button></p>' +
    '<form class="form-card wide" id="ed" novalidate><h2>' + (course ? '온라인 과정 수정' : '새 온라인 과정') + '</h2>' +
      '<div class="notice-box left import-box"><b>과정 파일 불러오기</b>' +
        '<p class="form-help">미리 만들어 둔 과정 파일(.json)을 고르면 아래 칸이 모두 채워집니다. 내용을 확인한 뒤 [저장]을 눌러야 반영됩니다.</p>' +
        '<input type="file" id="ed-import" accept=".json,application/json"></div>' +
      '<label>과정명<input name="title" value="' + esc(c.title) + '" placeholder="예: 착의생존수영지도자 사전 온라인 과정"></label>' +
      '<label>소개<textarea name="description" rows="3">' + esc(c.description) + '</textarea></label>' +
      '<div class="form-row"><label>수강료(원)<input type="number" name="fee" min="0" step="1000" value="' + esc(c.fee) + '"></label>' +
      '<label>수강 가능 기간(일) <small>승인일부터</small><input type="number" name="accessDays" min="1" value="' + esc(c.accessDays) + '"></label></div>' +
      '<div class="form-row"><label>수료 인정 기간(개월) <small>비우면 무기한</small><input type="number" name="validityMonths" min="0" value="' + esc(c.validityMonths || '') + '"></label>' +
      '<label>합격 점수(100점 만점)<input type="number" name="passScore" min="1" max="100" value="' + esc(c.passScore) + '"></label></div>' +
      '<div class="form-row"><label>출제 문항 수 <small>문제 은행에서 무작위</small><input type="number" name="questionCount" min="1" value="' + esc(c.questionCount) + '"></label>' +
      '<label>재응시 간격(분)<input type="number" name="retryMinutes" min="0" value="' + esc(c.retryMinutes) + '"></label></div>' +
      '<label class="check"><input type="checkbox" name="open"' + (c.open ? ' checked' : '') + '> 공개 (체크하면 신청 목록에 보임)</label>' +
      '<h3 class="form-sub">챕터</h3><div id="ed-chapters"></div>' +
      '<p class="btn-row left"><button type="button" class="btn btn-outline btn-sm" id="add-video">+ 영상 챕터</button><button type="button" class="btn btn-outline btn-sm" id="add-text">+ 글 챕터</button></p>' +
      '<h3 class="form-sub">평가 문제 은행 (<span id="q-count">0</span>문항)</h3>' +
      '<p class="form-help">출제 문항 수보다 넉넉하게(2배 정도) 만들어 두면 응시할 때마다 다른 문제가 나옵니다. 정답은 서버에만 저장되고 수강생에게는 보이지 않습니다.</p>' +
      '<div id="ed-questions"></div>' +
      '<p class="btn-row left"><button type="button" class="btn btn-outline btn-sm" id="add-q">+ 문항</button></p>' +
      '<div class="btn-row"><button type="submit" class="btn btn-primary">저장</button></div>' +
    '</form>';
  drawLists();
  document.getElementById('ed-back').addEventListener('click', () => tabOnline(box));
  document.getElementById('add-video').addEventListener('click', () => { collect(); chapters.push({ id: rid('c'), title: '', type: 'video', video: '', minutes: '', body: '' }); drawLists(); });
  document.getElementById('add-text').addEventListener('click', () => { collect(); chapters.push({ id: rid('c'), title: '', type: 'text', minutes: '', body: '' }); drawLists(); });
  document.getElementById('add-q').addEventListener('click', () => { collect(); questions.push({ id: rid('q'), question: '', options: ['', '', '', ''], answer: 0, explanation: '' }); drawLists(); });

  // 과정 파일(.json) 불러오기: 입력칸을 채우기만 하고, 저장은 관리자가 확인 후 직접
  document.getElementById('ed-import').addEventListener('change', async ev => {
    const file = ev.target.files[0];
    if (!file) return;
    let d;
    try { d = JSON.parse(await file.text()); } catch (err) { toast('과정 파일을 읽지 못했습니다. 파일 형식을 확인해 주세요.'); return; }
    if (!Array.isArray(d.chapters) || !Array.isArray(d.questions)) { toast('챕터(chapters)와 문항(questions)이 있는 과정 파일이 아닙니다.'); return; }
    if ((chapters.length || questions.length) && !confirm('지금 입력된 챕터와 문항을 파일 내용으로 바꿀까요?')) { ev.target.value = ''; return; }
    const f = document.getElementById('ed');
    ['title', 'description', 'fee', 'accessDays', 'validityMonths', 'passScore', 'questionCount', 'retryMinutes'].forEach(k => { if (d[k] !== undefined) f[k].value = d[k]; });
    if (d.open !== undefined) f.open.checked = !!d.open;
    chapters = d.chapters.map(ch => ({ id: rid('c'), title: ch.title || '', type: ch.type === 'video' ? 'video' : 'text', video: ch.video || '', minutes: ch.minutes || '', body: ch.body || '' }));
    questions = d.questions.map(q => ({ id: rid('q'), question: q.question || '', options: [0, 1, 2, 3].map(k => (q.options || [])[k] || ''), answer: Number(q.answer) || 0, explanation: q.explanation || '' }));
    drawLists();
    toast('챕터 ' + chapters.length + '개, 문항 ' + questions.length + '개를 불러왔습니다. 확인 후 [저장]을 눌러 주세요.');
  });

  document.getElementById('ed').addEventListener('submit', async e => {
    e.preventDefault(); collect();
    const f = e.target, num = n => Number(f[n].value) || 0;
    const meta = {
      title: f.title.value.trim(), description: f.description.value, fee: num('fee'), accessDays: num('accessDays') || COURSE_DEFAULTS.accessDays,
      validityMonths: num('validityMonths'), passScore: num('passScore') || COURSE_DEFAULTS.passScore,
      questionCount: num('questionCount') || COURSE_DEFAULTS.questionCount, retryMinutes: num('retryMinutes'), open: f.open.checked
    };
    if (!meta.title) { toast('과정명을 입력해 주세요.'); return; }
    if (!chapters.length) { toast('챕터를 하나 이상 추가해 주세요.'); return; }
    const badVideo = chapters.find(ch => ch.type === 'video' && !youtubeId(ch.video));
    if (badVideo) { toast('"' + (badVideo.title || '제목 없는 챕터') + '"의 유튜브 주소를 확인해 주세요.'); return; }
    if (chapters.some(ch => !ch.title.trim())) { toast('챕터 제목을 모두 입력해 주세요.'); return; }
    const badQ = questions.findIndex(q => !q.question.trim() || q.options.some(o => !o.trim()));
    if (badQ >= 0) { toast('문항 ' + (badQ + 1) + '의 문제와 보기 4개를 모두 입력해 주세요.'); return; }
    if (meta.open && questions.length < meta.questionCount) { toast('공개하려면 문제 은행이 출제 문항 수(' + meta.questionCount + ')보다 많아야 합니다.'); return; }

    const batch = fs.writeBatch(db);
    batch.set(fs.doc(db, 'courses', id), {
      ...meta, chapters: chapters.map(ch => ({ id: ch.id, title: ch.title.trim(), type: ch.type, minutes: Number(ch.minutes) || 0 })),
      updatedAt: fs.serverTimestamp()
    });
    chapters.forEach(ch => batch.set(fs.doc(db, 'courses', id, 'chapters', ch.id), ch.type === 'video' ? { video: youtubeId(ch.video), body: ch.body || '' } : { body: ch.body || '' }));
    (course && course.chapters || []).filter(old => !chapters.some(ch => ch.id === old.id)).forEach(old => batch.delete(fs.doc(db, 'courses', id, 'chapters', old.id)));
    batch.set(fs.doc(db, 'courseExams', id), { questions: questions.map(q => ({ id: q.id, question: q.question.trim(), options: q.options.map(o => o.trim()), answer: q.answer, explanation: q.explanation.trim() })) });
    // 교육·자격 신청 목록에 온라인 과정으로 등록
    batch.set(fs.doc(db, 'programs', 'online-' + id), {
      type: 'online', courseId: id, category: '온라인 학습', title: meta.title, fee: meta.fee,
      date: '승인 후 ' + meta.accessDays + '일간 수강', place: '온라인', description: meta.description, open: meta.open, order: -1
    });
    try { await batch.commit(); toast('저장했습니다.'); tabOnline(box); } catch (err) { toast(errMsg(err)); }
  });
}

/* ---------- 수강 현황 ---------- */
async function stats(course) {
  view().innerHTML = '<p class="board-empty">불러오는 중…</p>';
  let enrs, attempts;
  try {
    const [eSnap, aSnap] = await Promise.all([
      fs.getDocs(fs.query(fs.collection(db, 'enrollments'), fs.where('courseId', '==', course.id))),
      fs.getDocs(fs.query(fs.collection(db, 'examAttempts'), fs.where('courseId', '==', course.id)))
    ]);
    enrs = eSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
    attempts = aSnap.docs.map(d => d.data()).filter(a => a.status === 'submitted');
  } catch (e) { view().innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }
  const tries = uid => attempts.filter(a => a.uid === uid);
  view().innerHTML =
    '<p><button type="button" class="link-btn" id="st-back">← 과정 목록</button></p>' +
    '<h3 class="list-title">' + esc(course.title) + ' · 수강생 ' + enrs.length + '명 · 수료 ' + enrs.filter(e => e.status === 'passed').length + '명</h3>' +
    (enrs.length ? '<div class="table-scroll"><table class="board-table"><thead><tr><th>이름</th><th>상태</th><th>진도</th><th class="col-date">수강 기간</th><th>응시</th><th>최고 점수</th><th>수료번호</th><th></th></tr></thead><tbody>' +
      enrs.map(e => {
        const s = enrollmentStatus(e), t = tries(e.uid);
        return '<tr><td>' + esc(e.name) + '<br><small>' + esc(e.email) + '</small></td><td>' + ENR_STATUS_NAMES[s] + '</td><td>' + progressPercent(course, e) + '%</td>' +
          '<td class="col-date">' + esc(e.startDate) + '<br>~ ' + esc(e.endDate) + '</td><td>' + t.length + '회</td><td>' + (t.length ? Math.max(...t.map(a => a.score)) + '점' : '-') + '</td>' +
          '<td class="nowrap">' + esc(e.certNo || '') + (e.passedOn ? '<br><small>' + esc(e.passedOn) + '</small>' : '') + '</td>' +
          '<td class="nowrap"><button type="button" class="link-btn" data-extend="' + e.docId + '">기간 +30일</button>' +
          (e.status === 'passed' ? '<br><button type="button" class="link-btn" data-revoke="' + e.docId + '">수료 취소</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="board-empty">아직 수강생이 없습니다.</p>') +
    '<p class="btn-row left"><button type="button" class="btn btn-outline btn-sm" id="st-csv">CSV 내려받기</button></p>';
  document.getElementById('st-back').addEventListener('click', () => tabOnline(box));
  view().querySelectorAll('[data-extend]').forEach(b => b.addEventListener('click', async () => {
    const e = enrs.find(x => x.docId === b.getAttribute('data-extend'));
    const base = e.endDate < todayYmd() ? todayYmd() : e.endDate, endDate = addDays(base, 30);
    try { await fs.updateDoc(fs.doc(db, 'enrollments', e.docId), { endDate, endAt: new Date(endDate + 'T23:59:59+09:00') }); toast('수강 기간을 ' + endDate + '까지 늘렸습니다.'); stats(course); }
    catch (err) { toast(errMsg(err)); }
  }));
  view().querySelectorAll('[data-revoke]').forEach(b => b.addEventListener('click', async () => {
    const e = enrs.find(x => x.docId === b.getAttribute('data-revoke'));
    if (!confirm(e.name + '님의 수료를 취소할까요? 사전요건 인정도 함께 사라집니다.')) return;
    try { await fs.updateDoc(fs.doc(db, 'enrollments', e.docId), { status: 'active', revokedCertNo: e.certNo || '', certNo: '', passedOn: '', validUntil: '', revokedOn: todayYmd() }); toast('수료를 취소했습니다.'); stats(course); }
    catch (err) { toast(errMsg(err)); }
  }));
  document.getElementById('st-csv').addEventListener('click', () => {
    const rows = [['이름', '이메일', '상태', '진도(%)', '수강 시작', '수강 종료', '응시 횟수', '최고 점수', '수료번호', '수료일', '인정 만료']].concat(enrs.map(e => {
      const t = tries(e.uid);
      return [e.name, e.email, ENR_STATUS_NAMES[enrollmentStatus(e)], progressPercent(course, e), e.startDate, e.endDate, t.length, t.length ? Math.max(...t.map(a => a.score)) : '', e.certNo || '', e.passedOn || '', e.validUntil || ''];
    }));
    const text = '﻿' + rows.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    a.download = '수강현황_' + course.title + '_' + todayYmd() + '.csv'; a.click(); URL.revokeObjectURL(a.href);
  });
}
