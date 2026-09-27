import { enabled, auth, db, fa, fs, ready, state, disabledNotice, toast, errMsg, esc, qs } from '../app.js';
import { saveConsent, MKT_TEXT } from '../marketing.js';
import { socialEnabled, startSocial, naverButton } from '../social.js';

const el = document.getElementById('signup');
// 가입 후 돌아갈 페이지 (예: 생존수영 인증 등록 링크). 같은 사이트 안의 페이지만 허용
const back = /^[\w-]+\.html(\?[^#]*)?$/.test(qs('back') || '') ? qs('back') : '';
const after = welcome => back || ('mypage.html' + (welcome ? '?welcome=1' : ''));

const agreeHTML =
  '<div class="agree">' +
    '<p><strong>개인정보 수집·이용 안내</strong><br>수집 항목: 이름, 이메일, 휴대폰 번호<br>이용 목적: 회원 관리, 교육·자격 신청 접수 및 안내<br>' +
    '보유 기간: 회원 탈퇴 시까지<br><a href="privacy.html" target="_blank">개인정보처리방침 전문 보기</a></p>' +
    '<label class="check"><input type="checkbox" name="over14" required> 만 14세 이상입니다. (필수)</label>' +
    '<label class="check"><input type="checkbox" name="agree" required> 개인정보 수집·이용에 동의합니다. (필수)</label>' +
    '<div class="mkt-choice"><p><strong>[선택] 소식지·행사 안내 수신</strong><br><small>' + MKT_TEXT + '</small></p>' +
      '<label class="check"><input type="checkbox" name="mktEmail"> 이메일로 받기</label>' +
      '<label class="check"><input type="checkbox" name="mktSms"> 문자로 받기</label></div>' +
    '<p class="form-help">만 14세 미만 자녀의 교육 신청은 보호자가 가입한 뒤 신청서에서 "보호자가 자녀 대신 신청"을 선택해 주세요.</p>' +
  '</div>';

function checkAgree(f) {
  if (!f.over14.checked) { toast('만 14세 이상만 가입할 수 있습니다.'); f.over14.focus(); return false; }
  if (!f.agree.checked) { toast('개인정보 수집·이용에 동의해 주세요.'); f.agree.focus(); return false; }
  return true;
}

async function saveProfile(user, name, phone, f) {
  await fs.setDoc(fs.doc(db, 'users', user.uid), {
    name, phone, email: user.email || (f && f.email ? f.email.value.trim() : ''), agreePrivacy: true, over14: true, createdAt: fs.serverTimestamp()
  });
  // 선택 동의: 하나라도 체크했을 때만 기록 (실패해도 가입은 그대로)
  if (f && (f.mktEmail.checked || f.mktSms.checked)) {
    try { await saveConsent(user.uid, { email: f.mktEmail.checked, sms: f.mktSms.checked }, null); } catch (e) { console.warn(e); }
  }
}

async function init() {
  if (!enabled) return disabledNotice(el);
  await ready;
  if (state.user && state.profile) { location.replace(after(false)); return; }
  if (state.user) return completeForm();

  el.innerHTML =
    '<form class="form-card" id="f" novalidate>' +
      '<h2>회원가입</h2>' +
      '<label>이름<input name="name" maxlength="30" autocomplete="name"></label>' +
      '<label>이메일<input type="email" name="email" autocomplete="email"></label>' +
      '<label>비밀번호 <small>(6자 이상)</small><input type="password" name="password" minlength="6" autocomplete="new-password"></label>' +
      '<label>비밀번호 확인<input type="password" name="password2" minlength="6" autocomplete="new-password"></label>' +
      '<label>휴대폰 번호<input type="tel" name="phone" placeholder="010-0000-0000" autocomplete="tel"></label>' +
      agreeHTML +
      '<button class="btn btn-primary btn-block" type="submit">가입하기</button>' +
      '<p class="divider"><span>또는</span></p>' +
      '<button class="btn btn-google btn-block" type="button" id="google"><span class="g-icon" aria-hidden="true">G</span> 구글 계정으로 가입</button>' +
      (socialEnabled('naver') ? naverButton('naver', '네이버로 가입') + '<p class="form-help center">네이버로 가입하면 다음 화면에서 동의와 휴대폰 번호를 확인합니다.</p>' : '') +
      '<p class="form-links">이미 회원이신가요? <a href="login.html' + (back ? '?back=' + encodeURIComponent(back) : '') + '">로그인</a></p>' +
    '</form>';
  const f = document.getElementById('f');

  f.addEventListener('submit', async e => {
    e.preventDefault();
    const name = f.name.value.trim(), email = f.email.value.trim(), phone = f.phone.value.trim();
    if (!name || !email || !phone || !f.password.value) { toast('모든 항목을 입력해 주세요.'); return; }
    if (f.password.value !== f.password2.value) { toast('비밀번호가 서로 다릅니다.'); return; }
    if (!checkAgree(f)) return;
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try {
      const cred = await fa.createUserWithEmailAndPassword(auth, email, f.password.value);
      await fa.updateProfile(cred.user, { displayName: name });
      await saveProfile(cred.user, name, phone, f);
      location.replace(after(true));
    } catch (err) { toast(errMsg(err)); btn.disabled = false; }
  });

  const naver = document.getElementById('naver');
  if (naver) naver.addEventListener('click', () => { try { startSocial('naver', 'login', back); } catch (e) { toast(e.message); } });

  // 구글 가입: 동의를 먼저 받고, 로그인 후 바로 프로필 저장
  document.getElementById('google').addEventListener('click', async () => {
    if (!checkAgree(f)) return;
    try {
      const cred = await fa.signInWithPopup(auth, new fa.GoogleAuthProvider());
      const exists = (await fs.getDoc(fs.doc(db, 'users', cred.user.uid))).exists();
      if (!exists) await saveProfile(cred.user, cred.user.displayName || cred.user.email.split('@')[0], f.phone.value.trim(), f);
      location.replace(after(!exists));
    } catch (err) { toast(errMsg(err)); }
  });
}

// 구글 로그인은 했지만 아직 동의·정보 입력을 하지 않은 회원
function completeForm() {
  const u = state.user;
  el.innerHTML =
    '<form class="form-card" id="f" novalidate>' +
      '<h2>가입 마무리</h2>' +
      '<p class="form-help" style="text-align:center">서비스 이용을 위해 아래 정보를 확인하고 동의해 주세요.</p>' +
      (u.email ? '<label>이메일<input value="' + esc(u.email) + '" disabled></label>'
        : '<label>이메일 <small>(알림 메일·문의 답변을 받을 주소)</small><input type="email" name="email" autocomplete="email"></label>') +
      '<label>이름<input name="name" maxlength="30" value="' + esc(u.displayName || '') + '"></label>' +
      '<label>휴대폰 번호<input type="tel" name="phone" placeholder="010-0000-0000" autocomplete="tel"></label>' +
      agreeHTML +
      '<button class="btn btn-primary btn-block" type="submit">가입 완료</button>' +
      '<p class="form-links"><button type="button" class="link-btn" id="cancel">가입하지 않고 로그아웃</button></p>' +
    '</form>';
  const f = document.getElementById('f');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const name = f.name.value.trim();
    if (!name) { toast('이름을 입력해 주세요.'); return; }
    if (!u.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value.trim())) { toast('이메일을 입력해 주세요.'); return; }
    if (!checkAgree(f)) return;
    try { await saveProfile(u, name, f.phone.value.trim(), f); location.replace(after(true)); }
    catch (err) { toast(errMsg(err)); }
  });
  // 동의하지 않으면 방금 만들어진 로그인 계정도 지움
  document.getElementById('cancel').addEventListener('click', async () => {
    try { await u.delete(); } catch (e) { await fa.signOut(auth); }
    location.href = 'index.html';
  });
}
init();
