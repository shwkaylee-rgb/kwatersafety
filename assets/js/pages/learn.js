import { enabled, db, fs, state, requireLogin, disabledNotice, callFn, toast, errMsg, esc, textToHTML, qs } from '../app.js';
import { enrollmentId, enrollmentStatus, allChaptersDone, progressPercent, daysLeftInCourse, ENR_STATUS_NAMES } from '../course.js';

const el = document.getElementById('learn');
const WATCH_RATIO = 0.9;   // 영상은 90% 이상 봐야 완료
const courseId = qs('course') || '';
let course, enr, eRef, current = 0, ticker = null, player = null;

async function init() {
  if (!enabled) return disabledNotice(el);
  if (!(await requireLogin())) return;
  try {
    const cSnap = await fs.getDoc(fs.doc(db, 'courses', courseId));
    if (!cSnap.exists()) { el.innerHTML = '<p class="board-empty">과정을 찾을 수 없습니다. <a href="online.html">온라인 학습 목록</a></p>'; return; }
    course = { id: courseId, ...cSnap.data() };
    eRef = fs.doc(db, 'enrollments', enrollmentId(state.user.uid, courseId));
    const eSnap = await fs.getDoc(eRef);
    enr = eSnap.exists() ? eSnap.data() : null;
  } catch (e) { el.innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }
  document.title = course.title + ' | 온라인 학습';

  const st = enrollmentStatus(enr);
  if (st !== 'active' && st !== 'passed' || daysLeftInCourse(enr) < 0) {
    el.innerHTML = '<div class="notice-box">' + (st === 'none' ? '수강 신청이 승인된 뒤에 학습할 수 있습니다.'
      : st === 'expired' || daysLeftInCourse(enr) < 0 ? '수강 기간(' + esc(enr.endDate) + '까지)이 끝났습니다. 다시 신청해 주세요.'
      : '수강할 수 없는 상태입니다. 사무국으로 문의해 주세요.') +
      '</div><p class="center"><a class="btn btn-outline" href="online.html#' + esc(courseId) + '">온라인 학습 목록</a></p>';
    return;
  }
  const firstLeft = (course.chapters || []).findIndex(c => !(enr.progress || {})[c.id]);
  current = firstLeft < 0 ? 0 : firstLeft;
  layout();
  showChapter(current);
}

function layout() {
  el.innerHTML =
    '<div class="learn-head"><div><p class="badge">온라인 학습</p><h2>' + esc(course.title) + '</h2></div>' +
      '<div class="learn-meta" id="meta"></div></div>' +
    '<div class="learn-grid">' +
      '<nav class="learn-nav" aria-label="챕터 목록"><ol id="ch-list"></ol><div id="exam-entry"></div></nav>' +
      '<section class="learn-main" id="main"></section>' +
    '</div>';
  refreshSide();
}

function refreshSide() {
  const st = enrollmentStatus(enr), pct = progressPercent(course, enr);
  document.getElementById('meta').innerHTML =
    '<span class="mstatus mstatus-' + (st === 'passed' ? 'ok' : 'wait') + '">' + ENR_STATUS_NAMES[st] + '</span>' +
    '<span>진도 <b>' + pct + '%</b></span><span>수강 기간 ' + esc(enr.endDate) + '까지 (' + daysLeftInCourse(enr) + '일 남음)</span>' +
    '<div class="bar" aria-hidden="true"><i style="width:' + pct + '%"></i></div>';
  document.getElementById('ch-list').innerHTML = (course.chapters || []).map((c, i) =>
    '<li><button type="button" data-go="' + i + '" class="' + (i === current ? 'is-current ' : '') + ((enr.progress || {})[c.id] ? 'is-done' : '') + '">' +
    '<span class="ch-check" aria-hidden="true">' + ((enr.progress || {})[c.id] ? '✓' : i + 1) + '</span>' +
    '<span class="ch-title">' + esc(c.title) + '<small>' + (c.type === 'video' ? '영상' : '글') + (c.minutes ? ' · ' + c.minutes + '분' : '') + '</small></span></button></li>').join('');
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => showChapter(+b.getAttribute('data-go'))));
  const entry = document.getElementById('exam-entry');
  if (st === 'passed') entry.innerHTML = '<div class="exam-box ok"><b>수료 완료</b><span>' + esc(enr.passedOn) + ' · ' + enr.score + '점 · ' + esc(enr.certNo) + '</span><a class="btn btn-primary btn-sm" href="course-certificate.html?course=' + encodeURIComponent(courseId) + '">수료증 보기</a></div>';
  else if (allChaptersDone(course, enr)) entry.innerHTML = '<div class="exam-box"><b>모든 챕터를 마쳤습니다</b><span>평가 ' + course.passScore + '점 이상이면 수료합니다.</span><button type="button" class="btn btn-primary btn-sm" id="exam-start">평가 시작</button></div>';
  else entry.innerHTML = '<div class="exam-box off"><b>평가</b><span>모든 챕터를 마치면 응시할 수 있습니다.</span></div>';
  const start = document.getElementById('exam-start');
  if (start) start.addEventListener('click', startExam);
}

function stopTracking() { if (ticker) { clearInterval(ticker); ticker = null; } if (player && player.destroy) { try { player.destroy(); } catch (e) {} } player = null; }

async function showChapter(i) {
  stopTracking();
  current = i;
  const ch = course.chapters[i], done = !!(enr.progress || {})[ch.id];
  refreshSide();
  const main = document.getElementById('main');
  main.innerHTML = '<p class="board-empty">불러오는 중…</p>';
  let body;
  try { const s = await fs.getDoc(fs.doc(db, 'courses', courseId, 'chapters', ch.id)); body = s.exists() ? s.data() : {}; }
  catch (e) { main.innerHTML = '<p class="board-empty">' + esc(errMsg(e)) + '</p>'; return; }

  const nav = '<div class="ch-nav">' + (i > 0 ? '<button type="button" class="btn btn-outline btn-sm" id="prev">← 이전 챕터</button>' : '<span></span>') +
    (i < course.chapters.length - 1 ? '<button type="button" class="btn btn-outline btn-sm" id="next">다음 챕터 →</button>' : '') + '</div>';
  main.innerHTML = '<h3 class="ch-heading"><small>챕터 ' + (i + 1) + '</small>' + esc(ch.title) + '</h3>' +
    (ch.type === 'video'
      ? '<div class="video-wrap"><div id="yt"></div></div><p class="watch-status" id="watch">' + (done ? '✓ 완료한 챕터입니다.' : '영상을 ' + Math.round(WATCH_RATIO * 100) + '% 이상 시청하면 완료됩니다.') + '</p>' +
        (body.body ? '<div class="ch-body">' + textToHTML(body.body) + '</div>' : '')
      : '<div class="ch-body">' + textToHTML(body.body || '') + '</div><div id="read-end"></div>' +
        '<p class="center"><button type="button" class="btn btn-primary" id="read-done" disabled>' + (done ? '✓ 완료한 챕터입니다' : '끝까지 읽으면 [학습 완료]를 누를 수 있습니다') + '</button></p>') +
    nav;
  const prev = document.getElementById('prev'), next = document.getElementById('next');
  if (prev) prev.addEventListener('click', () => showChapter(i - 1));
  if (next) next.addEventListener('click', () => showChapter(i + 1));
  if (ch.type === 'video') startVideo(ch, body.video, done);
  else if (!done) {
    // 본문 끝이 화면에 들어오면(끝까지 읽으면) [학습 완료]를 누를 수 있게
    const btn = document.getElementById('read-done'), end = document.getElementById('read-end');
    const check = () => {
      if (!document.body.contains(end)) { window.removeEventListener('scroll', check); return; }
      if (end.getBoundingClientRect().top <= window.innerHeight + 40) {
        btn.disabled = false; btn.textContent = '학습 완료';
        window.removeEventListener('scroll', check); window.removeEventListener('resize', check);
      }
    };
    window.addEventListener('scroll', check, { passive: true }); window.addEventListener('resize', check);
    check();
    btn.addEventListener('click', () => markDone(ch));
  }
}

// 유튜브 IFrame API로 재생하고, 실제로 본 초(秒)를 모아 90% 이상이면 완료 처리
function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  return new Promise(res => {
    window.onYouTubeIframeAPIReady = res;
    if (!document.getElementById('yt-api')) { const s = document.createElement('script'); s.id = 'yt-api'; s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s); }
  });
}
async function startVideo(ch, videoId, done) {
  if (!videoId) { document.getElementById('yt').innerHTML = '<p class="board-empty">영상이 준비되지 않았습니다.</p>'; return; }
  await loadYouTubeApi();
  const key = 'kwasa-watch-' + courseId + '-' + ch.id;
  let seen = new Set();
  try { seen = new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch (e) {}
  player = new YT.Player('yt', { host: 'https://www.youtube-nocookie.com', videoId, playerVars: { rel: 0, modestbranding: 1 } });
  if (done) return;
  ticker = setInterval(() => {
    if (!player || !player.getPlayerState || player.getPlayerState() !== YT.PlayerState.PLAYING) return;
    seen.add(Math.floor(player.getCurrentTime()));
    const dur = Math.floor(player.getDuration() || 0);
    const pct = dur ? Math.min(100, Math.round(seen.size / dur * 100)) : 0;
    const w = document.getElementById('watch');
    if (w) w.textContent = '시청 ' + pct + '% · ' + Math.round(WATCH_RATIO * 100) + '% 이상 보면 완료됩니다.';
    try { localStorage.setItem(key, JSON.stringify([...seen])); } catch (e) {}
    if (dur && seen.size >= dur * WATCH_RATIO) { clearInterval(ticker); ticker = null; markDone(ch); }
  }, 1000);
}

async function markDone(ch) {
  if (enr.status !== 'active' || (enr.progress || {})[ch.id]) return;
  try {
    await fs.updateDoc(eRef, { ['progress.' + ch.id]: true, lastStudiedAt: fs.serverTimestamp() });
    enr.progress = { ...(enr.progress || {}), [ch.id]: true };
    toast('「' + ch.title + '」 챕터를 완료했습니다.');
    const w = document.getElementById('watch'); if (w) w.textContent = '✓ 완료한 챕터입니다.';
    const b = document.getElementById('read-done'); if (b) { b.disabled = true; b.textContent = '✓ 완료한 챕터입니다'; }
    refreshSide();
  } catch (e) { toast(errMsg(e)); }
}

/* ---------- 평가 ---------- */
async function startExam() {
  stopTracking();
  const main = document.getElementById('main');
  main.innerHTML = '<p class="board-empty">문항을 준비하는 중…</p>';
  let exam;
  try { exam = await callFn('startExam', { courseId }); }
  catch (e) { main.innerHTML = '<div class="notice-box">' + esc(errMsg(e)) + '</div>'; return; }
  main.innerHTML = '<h3 class="ch-heading"><small>평가</small>' + esc(course.title) + '</h3>' +
    '<p class="form-help">총 ' + exam.total + '문항 · ' + exam.passScore + '점 이상이면 수료합니다. 2시간 안에 제출해 주세요.</p>' +
    '<form id="exam" class="exam-form">' + exam.questions.map((q, n) =>
      '<fieldset class="exam-q"><legend><b>' + (n + 1) + '.</b> ' + esc(q.question) + '</legend>' +
      q.options.map((o, k) => '<label class="check"><input type="radio" name="' + esc(q.id) + '" value="' + k + '"> ' + esc(o) + '</label>').join('') +
      '</fieldset>').join('') +
    '<button type="submit" class="btn btn-primary btn-block">제출하고 채점하기</button></form>';
  document.getElementById('exam').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, answers = {};
    exam.questions.forEach(q => { const x = f.querySelector('[name="' + q.id + '"]:checked'); if (x) answers[q.id] = +x.value; });
    const empty = exam.questions.length - Object.keys(answers).length;
    if (empty && !confirm('답하지 않은 문항이 ' + empty + '개 있습니다. 그래도 제출할까요?')) return;
    f.querySelector('[type=submit]').disabled = true;
    let r;
    try { r = await callFn('submitExam', { attemptId: exam.attemptId, answers }); }
    catch (err) { toast(errMsg(err)); f.querySelector('[type=submit]').disabled = false; return; }
    const wrong = r.results.filter(x => !x.correct);
    main.innerHTML = '<div class="exam-result ' + (r.passed ? 'ok' : 'no') + '">' +
      '<p class="score">' + r.score + '<small>점</small></p>' +
      '<p><b>' + (r.passed ? '합격했습니다! 수료를 축하합니다.' : '아쉽게도 합격 점수(' + r.passScore + '점)에 미치지 못했습니다.') + '</b></p>' +
      '<p class="form-help">' + r.total + '문항 중 ' + r.correctCount + '문항 정답' + (r.certNo ? ' · 수료번호 ' + esc(r.certNo) : '') + '</p>' +
      (r.passed ? '<p class="btn-row"><a class="btn btn-primary" href="course-certificate.html?course=' + encodeURIComponent(courseId) + '">수료증 보기</a></p>'
        : '<p class="form-help">챕터를 다시 복습한 뒤 ' + (course.retryMinutes ? course.retryMinutes + '분 후 ' : '') + '다시 응시할 수 있습니다.</p>') +
      '</div>' +
      (wrong.length ? '<h4 class="list-title">틀린 문항 해설</h4><ol class="explain-list">' + wrong.map(x => {
        const q = exam.questions.find(qq => qq.id === x.id);
        return '<li><b>' + esc(q.question) + '</b>' + (x.explanation ? '<p>' + esc(x.explanation) + '</p>' : '') + '</li>';
      }).join('') + '</ol>' : '');
    const s = await fs.getDoc(eRef); enr = s.data(); refreshSide();
  });
}

init();
