/* Firebase 연결, 로그인 상태, 게시판·장바구니 공통 함수
   모든 페이지에서 불러오며, 페이지별 스크립트는 여기서 필요한 함수를 import 합니다. */
import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
export const enabled = !!firebaseConfig.apiKey;

export let auth = null, db = null, fa = {}, fs = {};
let fbApp = null, fnClient = null;
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
if (enabled) {
  const [appMod, authMod, fsMod] = await Promise.all([
    import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')
  ]);
  // 내 컴퓨터(localhost)에서 열면 실제 Firebase 대신 테스트용 에뮬레이터에 연결 (`npm run emulators`)
  const app = fbApp = appMod.initializeApp(isLocal ? { ...firebaseConfig, projectId: 'demo-kwasa' } : firebaseConfig);
  auth = authMod.getAuth(app);
  db = fsMod.getFirestore(app);
  if (isLocal) {
    authMod.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    fsMod.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    console.info('[테스트 모드] Firebase 에뮬레이터에 연결했습니다.');
  }
  fa = authMod; fs = fsMod;
}

// 서버 함수 호출 (온라인 학습 평가 등). 필요할 때만 불러옴
export async function callFn(name, data) {
  if (!fnClient) {
    const m = await import(SDK + 'firebase-functions.js');
    const f = m.getFunctions(fbApp, 'asia-northeast3');
    if (isLocal) m.connectFunctionsEmulator(f, '127.0.0.1', 5001);
    fnClient = { m, f };
  }
  const res = await fnClient.m.httpsCallable(fnClient.f, name)(data);
  return res.data;
}

/* ---------- 유틸 ---------- */
export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// 일반 텍스트를 안전한 HTML로 (줄바꿈, 링크)
export function textToHTML(s) {
  return esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, '<br>');
}
export function today() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
export function fmtDate(v, withTime) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  const d = v.toDate ? v.toDate() : new Date(v), p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + (withTime ? ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) : '');
}
export function won(n) { return Number(n || 0) ? Number(n).toLocaleString('ko-KR') + '원' : '무료'; }
export function qs(name) { return new URLSearchParams(location.search).get(name); }

export function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

// Firebase 오류 메시지를 한국어로
export function errMsg(e) {
  const code = (e && e.code) || '';
  // 서버 함수가 보낸 오류는 이미 한국어 안내문이므로 그대로 보여줌
  if (code.startsWith('functions/') && e.message && code !== 'functions/internal') return e.message;
  const map = {
    'auth/invalid-email': '이메일 형식이 올바르지 않습니다.',
    'auth/email-already-in-use': '이미 가입된 이메일입니다.',
    'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/wrong-password': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/user-not-found': '가입되지 않은 이메일입니다.',
    'auth/too-many-requests': '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    'auth/popup-closed-by-user': '로그인 창이 닫혔습니다.',
    'auth/unauthorized-domain': '이 주소는 Firebase에 승인된 도메인이 아닙니다. (Authentication > 설정 > 승인된 도메인)',
    'auth/requires-recent-login': '보안을 위해 다시 로그인한 뒤 시도해 주세요.',
    'permission-denied': '권한이 없습니다.'
  };
  return map[code] || ('오류가 발생했습니다. ' + (e && e.message ? '(' + e.message + ')' : ''));
}

export function disabledNotice(el) {
  el.innerHTML = '<div class="notice-box">아직 회원 기능이 연결되지 않았습니다.<br>' +
    '<small>관리자: assets/js/firebase-config.js 에 Firebase 설정을 입력해 주세요.</small></div>';
}

/* ---------- 로그인 상태 ---------- */
export const state = { user: null, profile: null, isAdmin: false, membership: null };
const listeners = [];
let resolveReady;
export const ready = new Promise(r => { resolveReady = r; });
export function onAuth(cb) { listeners.push(cb); }

if (enabled) {
  fa.onAuthStateChanged(auth, async user => {
    state.user = user; state.profile = null; state.isAdmin = false; state.membership = null;
    if (user) {
      // 멤버십은 따로 읽어서, 실패해도 로그인 처리에는 영향이 없게 함
      try {
        const ms = await fs.getDoc(fs.doc(db, 'memberships', user.uid));
        state.membership = ms.exists() ? ms.data() : null;
      } catch (e) { console.warn('멤버십 정보를 읽지 못했습니다.', e); }
      let loaded = false;
      try {
        const [p, a] = await Promise.all([
          fs.getDoc(fs.doc(db, 'users', user.uid)),
          fs.getDoc(fs.doc(db, 'admins', user.uid))
        ]);
        state.profile = p.exists() ? p.data() : null;
        state.isAdmin = a.exists();
        loaded = true;
      } catch (e) { console.error(e); }
      // 로그인 페이지에서 구글로 처음 들어온 경우 등, 동의·회원정보가 없으면 가입 마무리 화면으로
      const page = location.pathname.split('/').pop();
      if (loaded && !state.profile && page !== 'signup.html' && page !== 'privacy.html') {
        location.replace('signup.html');
        return;
      }
    }
    updateHeader();
    listeners.forEach(cb => cb(state));
    resolveReady(state);
  });
} else {
  resolveReady(state);
}

export function displayName() {
  return (state.profile && state.profile.name) || (state.user && (state.user.displayName || state.user.email)) || '';
}

// 로그인이 필요한 페이지: 로그인 안 되어 있으면 로그인 페이지로
export async function requireLogin() {
  await ready;
  if (!state.user) { location.href = 'login.html?back=' + encodeURIComponent(location.pathname.split('/').pop() + location.search); return false; }
  return true;
}

export async function logout() {
  if (enabled) await fa.signOut(auth);
  location.href = 'index.html';
}

let cartUnsub = null;
function updateHeader() {
  const u = state.user;
  document.querySelectorAll('[data-auth]').forEach(el => {
    const t = el.getAttribute('data-auth');
    el.hidden = t === 'out' ? !!u : t === 'in' ? !u : !(u && state.isAdmin);
  });
  if (cartUnsub) { cartUnsub(); cartUnsub = null; }
  const setCount = n => document.querySelectorAll('[data-cart-count]').forEach(el => { el.textContent = n; });
  if (u) cartUnsub = fs.onSnapshot(fs.collection(db, 'users', u.uid, 'cart'), snap => setCount(snap.size), () => setCount(0));
  else setCount(0);
}
document.querySelectorAll('[data-logout]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); logout(); }));

/* ---------- 게시판 ---------- */
export const BOARD_TITLES = { notice: '협회 공지사항', news: '협회 소식', schedule: '교육일정 공지', press: '대외 보도자료' };

function staticPosts(board) {
  const b = (window.BOARDS || {})[board];
  return b ? b.posts.map(p => ({ id: String(p.id), board, title: p.title, author: p.author, date: p.date, bodyHTML: p.body, isStatic: true })) : [];
}
function fromDoc(d) {
  const p = d.data();
  return { id: d.id, board: p.board, title: p.title, author: p.author, date: p.date || fmtDate(p.createdAt), body: p.body, bodyHTML: textToHTML(p.body), createdAt: p.createdAt };
}
const sortKey = p => (p.date || '') + (p.createdAt && p.createdAt.toMillis ? String(p.createdAt.toMillis()).padStart(15, '0') : '');

// 게시판 글 목록 (최신순). Firebase 설정 전, 또는 기존 글을 아직 가져오지 않아
// Firebase 게시판이 통째로 비어 있을 때는 posts.js 내용을 보여줍니다.
export async function listPosts(board) {
  if (!enabled) return staticPosts(board);
  const snap = await fs.getDocs(fs.query(fs.collection(db, 'posts'), fs.where('board', '==', board)));
  if (snap.empty) {
    const any = await fs.getDocs(fs.query(fs.collection(db, 'posts'), fs.limit(1)));
    if (any.empty) return staticPosts(board);
  }
  return snap.docs.map(fromDoc).sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
}
export async function getPost(board, id) {
  if (!enabled) return staticPosts(board).find(p => p.id === id) || null;
  const d = await fs.getDoc(fs.doc(db, 'posts', id));
  return d.exists() ? fromDoc(d) : null;
}
export function postURL(board, id) { return 'post.html?board=' + board + '&id=' + encodeURIComponent(id); }

/* ---------- 장바구니 ---------- */
export async function addToCart(program) {
  if (!(await requireLogin())) return;
  await fs.setDoc(fs.doc(db, 'users', state.user.uid, 'cart', program.id), {
    programId: program.id, title: program.title, category: program.category,
    date: program.date || '', fee: Number(program.fee) || 0,
    type: program.type || '', courseId: program.courseId || '',
    requiresCourse: program.requiresCourse || '', requiresCourseTitle: program.requiresCourseTitle || '',
    addedAt: fs.serverTimestamp()
  });
  toast('장바구니에 담았습니다.');
}
