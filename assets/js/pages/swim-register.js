/* 생존수영 능력 인증 등록 (보호자 또는 만 14세 이상 학생 본인)
   swim.html?g=수업ID — 학교에 전달한 등록 링크. 링크 없이 들어오면 등록 받는 수업 목록에서 고름 */
import { enabled, db, fs, state, ready, disabledNotice, toast, errMsg, esc, qs, today } from '../app.js';
import { groupTitle, groupPeriod, STUDENT_STATUS } from '../swim.js';

const el = document.getElementById('swim');
const here = () => 'swim.html' + (qs('g') ? '?g=' + encodeURIComponent(qs('g')) : '');
const regOpen = g => g && g.regOpen && g.status === 'open' && (!g.regDeadline || g.regDeadline >= today());
function ageOn(birth) {
  const b = new Date(birth), t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}

async function init() {
  if (!enabled) return disabledNotice(el);
  await ready;
  const gid = qs('g');
  if (!gid) return pickGroup();
  let g = null;
  try { const d = await fs.getDoc(fs.doc(db, 'swimGroups', gid)); g = d.exists() ? { id: d.id, ...d.data() } : null; } catch (e) { g = null; }
  if (!g) { el.innerHTML = '<p class="board-empty">수업을 찾을 수 없습니다. 받은 링크를 다시 확인해 주세요. <a href="swim.html">등록 받는 수업 보기</a></p>'; return; }
  const head = '<div class="swim-head"><p class="kicker">생존수영 능력 인증 등록</p><h2>' + esc(groupTitle(g)) + '</h2>' +
    '<p>' + [groupPeriod(g) && '교육 ' + groupPeriod(g), g.place, g.regDeadline && '등록 마감 ' + g.regDeadline].filter(Boolean).map(esc).join(' · ') + '</p></div>';
  if (!state.user) {
    el.innerHTML = head + '<div class="notice-box">' +
      '<p>생존수영 교육을 받은 학생에게 협회가 <b>생존수영 능력 인증서</b>를 발급합니다. 인증서를 받으려면 <b>보호자가 협회 홈페이지에 가입</b>한 뒤 자녀 정보를 등록해 주세요. (만 14세 이상 학생은 본인이 직접 가입해 등록할 수 있습니다.)</p>' +
      '<p class="btn-row"><a class="btn btn-primary" href="signup.html?back=' + encodeURIComponent(here()) + '">회원가입 후 등록</a>' +
      '<a class="btn btn-outline" href="login.html?back=' + encodeURIComponent(here()) + '">이미 회원이면 로그인</a></p></div>';
    return;
  }
  let mine = [];
  try {
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'swimStudents'), fs.where('uid', '==', state.user.uid)));
    mine = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.groupId === g.id);
  } catch (e) { console.error(e); }
  const list = mine.length ? '<h3 class="form-sub">이 수업에 등록한 학생</h3><ul class="swim-mine">' + mine.map(s => '<li><b>' + esc(s.name) + '</b> ' + esc(s.birth) + (s.grade ? ' · ' + esc(s.grade) : '') +
    ' <span class="mstatus mstatus-' + (s.status === 'issued' ? 'ok' : s.status === 'evaluated' ? 'wait' : 'off') + '">' + STUDENT_STATUS[s.status] + '</span>' +
    (s.status === 'registered' ? ' <button type="button" class="link-btn" data-cancel="' + s.id + '">등록 취소</button>' : '') + '</li>').join('') + '</ul>' : '';
  if (!regOpen(g)) { el.innerHTML = head + list + '<div class="notice-box">이 수업은 등록을 받지 않습니다. 궁금한 점은 협회로 문의해 주세요.</div>'; bindCancel(); return; }

  const p = state.profile || {};
  el.innerHTML = head + list +
    '<form class="form-card wide" id="sf"><h3 class="form-sub">' + (mine.length ? '학생 한 명 더 등록' : '학생 정보 등록') + '</h3>' +
      '<fieldset class="choice"><legend>등록하는 사람</legend>' +
        '<label class="check"><input type="radio" name="who" value="guardian" checked> 보호자 (자녀 대신 등록)</label>' +
        '<label class="check"><input type="radio" name="who" value="self"> 학생 본인 (만 14세 이상)</label></fieldset>' +
      '<div class="form-row"><label>학생 이름<input name="name" required maxlength="30"></label>' +
      '<label>학생 생년월일<input type="date" name="birth" required></label></div>' +
      '<label>학년·반 <small>(예: 3학년 2반)</small><input name="grade" maxlength="30"></label>' +
      '<div id="g-box"><div class="form-row"><label>보호자 이름<input name="gname" maxlength="30" value="' + esc(p.name || '') + '"></label>' +
        '<label>학생과의 관계<select name="relation"><option>부</option><option>모</option><option>조부모</option><option>기타 법정대리인</option></select></label></div>' +
        '<label>보호자 휴대폰 번호<input type="tel" name="phone" value="' + esc(p.phone || '') + '" placeholder="010-0000-0000"></label></div>' +
      '<div class="agree"><p><strong>[필수] 개인정보 수집·이용 동의</strong><br>' +
        '수집 항목: 학생 이름·생년월일·학교·학년·반, 생존수영 평가 결과, 보호자 이름·관계·휴대폰 번호<br>' +
        '이용 목적: 생존수영 능력 평가, 인증서 발급, 준회원(인증일로부터 5년) 관리와 안내<br>' +
        '보유 기간: 준회원 기간이 끝날 때까지. 인증서를 받기 전에 등록을 취소하면 바로 파기합니다.<br>' +
        '동의하지 않을 수 있으며, 이 경우 인증서를 발급받을 수 없습니다. <a href="privacy.html" target="_blank">개인정보처리방침</a></p>' +
        '<label class="check" id="legal-box"><input type="checkbox" name="legal"> 저는 이 학생의 법정대리인(보호자)이며, 만 14세 미만 자녀의 개인정보 처리에 동의합니다.</label>' +
        '<label class="check"><input type="checkbox" name="agree"> 위 개인정보 수집·이용에 동의합니다.</label></div>' +
      '<button class="btn btn-primary btn-block" type="submit">등록하기</button></form>';
  bindCancel();
  const f = document.getElementById('sf');
  const who = () => f.querySelector('[name=who]:checked').value;
  const sync = () => {
    const self = who() === 'self';
    document.getElementById('g-box').hidden = self; document.getElementById('legal-box').hidden = self;
    if (self && !f.name.value) f.name.value = p.name || '';
    if (self && !f.birth.value) f.birth.value = p.birth || '';
  };
  f.querySelectorAll('[name=who]').forEach(r => r.addEventListener('change', sync));
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const self = who() === 'self', name = f.name.value.trim(), birth = f.birth.value;
    if (!name || !birth) { toast('학생 이름과 생년월일을 입력해 주세요.'); return; }
    if (self && ageOn(birth) < 14) { toast('만 14세 미만 학생은 보호자가 등록해 주세요.'); return; }
    if (!self && (!f.gname.value.trim() || !f.phone.value.trim())) { toast('보호자 이름과 휴대폰 번호를 입력해 주세요.'); return; }
    if (!self && ageOn(birth) < 14 && !f.legal.checked) { toast('법정대리인 동의에 체크해 주세요.'); return; }
    if (!f.agree.checked) { toast('개인정보 수집·이용에 동의해 주세요.'); return; }
    if (mine.some(s => s.name === name && s.birth === birth)) { toast('이미 등록한 학생입니다.'); return; }
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try {
      const ref = fs.doc(fs.collection(db, 'swimStudents')), batch = fs.writeBatch(db);
      batch.set(ref, { uid: state.user.uid, groupId: g.id, name, birth, grade: f.grade.value.trim(), registrant: self ? 'self' : 'guardian',
        consentAt: fs.serverTimestamp(), status: 'registered', createdAt: fs.serverTimestamp() });
      batch.set(fs.doc(db, 'swimContacts', ref.id), self
        ? { uid: state.user.uid, guardianName: '', relation: '본인', phone: p.phone || '' }
        : { uid: state.user.uid, guardianName: f.gname.value.trim(), relation: f.relation.value, phone: f.phone.value.trim() });
      await batch.commit();
      toast(name + ' 학생을 등록했습니다. 교육 후 평가가 끝나면 인증서를 알려 드립니다.');
      init();
    } catch (err) { toast(errMsg(err)); btn.disabled = false; }
  });
}

function bindCancel() {
  el.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('등록을 취소할까요? 입력한 정보는 바로 삭제됩니다.')) return;
    try {
      const batch = fs.writeBatch(db);
      batch.delete(fs.doc(db, 'swimContacts', b.dataset.cancel)); batch.delete(fs.doc(db, 'swimStudents', b.dataset.cancel));
      await batch.commit(); toast('등록을 취소했습니다.'); init();
    } catch (err) { toast(errMsg(err)); }
  }));
}

// 링크 없이 들어온 경우: 등록 받는 수업 목록에서 학교 이름으로 찾기
async function pickGroup() {
  let groups = [];
  try {
    const snap = await fs.getDocs(fs.query(fs.collection(db, 'swimGroups'), fs.where('regOpen', '==', true)));
    groups = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(regOpen).sort((a, b) => groupTitle(a).localeCompare(groupTitle(b), 'ko'));
  } catch (e) { console.error(e); }
  el.innerHTML = '<div class="swim-head"><p class="kicker">생존수영 능력 인증 등록</p><h2>학교(수업) 고르기</h2>' +
    '<p>학교에서 받은 등록 링크가 있으면 그 링크로 들어오시면 됩니다. 없으면 아래에서 학교 이름으로 찾아 주세요.</p></div>' +
    '<div class="form-card wide"><label>학교·기관 이름<input id="q" placeholder="예: 서울OO초등학교" autocomplete="off"></label><ul class="swim-groups" id="gl"></ul></div>';
  const draw = () => {
    const q = document.getElementById('q').value.replace(/\s/g, '');
    const list = groups.filter(g => !q || groupTitle(g).replace(/\s/g, '').includes(q));
    document.getElementById('gl').innerHTML = list.length ? list.map(g => '<li><a href="swim.html?g=' + encodeURIComponent(g.id) + '"><b>' + esc(groupTitle(g)) + '</b><small>' +
      esc([groupPeriod(g), g.regDeadline && '마감 ' + g.regDeadline].filter(Boolean).join(' · ')) + '</small></a></li>').join('')
      : '<li class="board-empty">' + (groups.length ? '찾는 학교가 없습니다.' : '지금 등록을 받는 수업이 없습니다.') + '</li>';
  };
  document.getElementById('q').addEventListener('input', draw); draw();
}
init();
