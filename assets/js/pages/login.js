import { enabled, auth, fa, ready, state, disabledNotice, toast, errMsg, qs } from '../app.js';
import { socialEnabled, startSocial, naverButton } from '../social.js';

const el = document.getElementById('login');
// 외부 주소로 튕기지 않도록 같은 사이트 안의 페이지 이름만 허용
const back = /^[\w-]+\.html(\?[^#]*)?$/.test(qs('back') || '') ? qs('back') : 'index.html';

async function init() {
  if (!enabled) return disabledNotice(el);
  await ready;
  if (state.user) { location.replace(back); return; }

  el.innerHTML =
    '<form class="form-card" id="f">' +
      '<h2>로그인</h2>' +
      '<label>이메일<input type="email" name="email" required autocomplete="email"></label>' +
      '<label>비밀번호<input type="password" name="password" required autocomplete="current-password"></label>' +
      '<button class="btn btn-primary btn-block" type="submit">로그인</button>' +
      '<button class="btn btn-google btn-block" type="button" id="google"><span class="g-icon" aria-hidden="true">G</span> 구글 계정으로 로그인</button>' +
      (socialEnabled('naver') ? naverButton('naver', '네이버로 로그인') : '') +
      '<p class="form-links"><a href="signup.html' + (qs('back') === back ? '?back=' + encodeURIComponent(back) : '') + '">회원가입</a><i>|</i><button type="button" class="link-btn" id="reset">비밀번호 찾기</button></p>' +
    '</form>';
  const f = document.getElementById('f');

  f.addEventListener('submit', async e => {
    e.preventDefault();
    try { await fa.signInWithEmailAndPassword(auth, f.email.value.trim(), f.password.value); location.replace(back); }
    catch (err) { toast(errMsg(err)); }
  });
  document.getElementById('google').addEventListener('click', async () => {
    try { await fa.signInWithPopup(auth, new fa.GoogleAuthProvider()); location.replace(back); }
    catch (err) { toast(errMsg(err)); }
  });
  const naver = document.getElementById('naver');
  if (naver) naver.addEventListener('click', () => { try { startSocial('naver', 'login', back); } catch (e) { toast(e.message); } });
  document.getElementById('reset').addEventListener('click', async () => {
    const email = f.email.value.trim();
    if (!email) { toast('이메일을 먼저 입력해 주세요.'); f.email.focus(); return; }
    try { await fa.sendPasswordResetEmail(auth, email); toast('비밀번호 재설정 메일을 보냈습니다.'); }
    catch (err) { toast(errMsg(err)); }
  });
}
init();
