/* 간편 로그인 (네이버) 서버 함수 (서울 리전)
   - socialLogin: 네이버에서 받은 인증 코드를 확인하고 Firebase 로그인 토큰을 돌려줌
       mode 'login' — 연결된 계정이 있으면 그 계정으로, 없으면 새 계정을 만듦
                      (같은 이메일로 이미 가입한 회원이면 새로 만들지 않고 "마이페이지에서 연결" 안내)
       mode 'link'  — 로그인한 회원 계정에 네이버를 연결 (다음부터 네이버로도 같은 계정에 로그인)
   - socialUnlink: 연결 해제 (다른 로그인 방법이 없으면 막음)
   socialLinks/{네이버_고유ID}: { uid, provider, email, linkedAt }
   네이버 Client ID는 functions/.env 의 NAVER_CLIENT_ID, Client Secret은 비밀값 NAVER_CLIENT_SECRET
     npx firebase functions:secrets:set NAVER_CLIENT_SECRET --project kwatersafety
   로그인 토큰을 만들려면 서버 계정에 '서비스 계정 토큰 생성자' 권한이 필요합니다. */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const NAVER_CLIENT_ID = defineString('NAVER_CLIENT_ID', { default: '' });
const NAVER_CLIENT_SECRET = defineSecret('NAVER_CLIENT_SECRET');
const PROVIDER_NAMES = { naver: '네이버' };
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

// 네이버: 인증 코드 → 접근 토큰 → 회원 정보 { id, email, name }
async function naverProfile(code, state) {
  // 에뮬레이터 시험용: 'test:아이디:이메일:이름' (실제 서버에서는 쓰이지 않음)
  if (isEmulator && code.startsWith('test:')) { const [, id, email, name] = code.split(':'); return { id, email: email || '', name: name || '' }; }
  const q = new URLSearchParams({ grant_type: 'authorization_code', client_id: NAVER_CLIENT_ID.value(), client_secret: NAVER_CLIENT_SECRET.value(), code, state });
  const t = await (await fetch('https://nid.naver.com/oauth2.0/token?' + q)).json().catch(() => ({}));
  if (!t.access_token) { console.warn('네이버 토큰 실패', t.error, t.error_description); throw new HttpsError('unauthenticated', '네이버 로그인을 확인하지 못했습니다. 다시 시도해 주세요.'); }
  const me = await (await fetch('https://openapi.naver.com/v1/nid/me', { headers: { Authorization: 'Bearer ' + t.access_token } })).json().catch(() => ({}));
  const r = me.response;
  if (me.resultcode !== '00' || !r || !r.id) { console.warn('네이버 회원 정보 실패', me.resultcode, me.message); throw new HttpsError('unauthenticated', '네이버 회원 정보를 받지 못했습니다.'); }
  return { id: String(r.id), email: r.email || '', name: r.name || r.nickname || '' };
}

const METHOD_NAMES = { password: '이메일·비밀번호', 'google.com': '구글 계정' };

exports.socialLogin = onCall({ secrets: [NAVER_CLIENT_SECRET] }, async req => {
  const { provider, code, state, mode } = req.data || {};
  if (provider !== 'naver') throw new HttpsError('invalid-argument', '지원하지 않는 로그인 방법입니다.');
  if (!code || !state) throw new HttpsError('invalid-argument', '로그인 정보가 없습니다. 다시 시도해 주세요.');
  const p = await naverProfile(String(code), String(state));
  const db = getFirestore(), auth = getAuth();
  const ref = db.doc('socialLinks/' + provider + '_' + p.id), link = await ref.get();
  const linkData = { provider, email: p.email, linkedAt: FieldValue.serverTimestamp() };

  // 로그인한 회원 계정에 연결
  if (mode === 'link') {
    if (!req.auth) throw new HttpsError('unauthenticated', '먼저 로그인해 주세요.');
    if (link.exists && link.data().uid !== req.auth.uid) throw new HttpsError('already-exists', '이 ' + PROVIDER_NAMES[provider] + ' 계정은 이미 다른 회원 계정에 연결되어 있습니다.');
    await ref.set({ uid: req.auth.uid, ...linkData });
    return { status: 'linked', email: p.email };
  }

  // 이미 연결된 계정으로 로그인 (연결된 계정이 탈퇴로 없어졌으면 연결을 정리하고 새로 가입)
  if (link.exists) {
    try { await auth.getUser(link.data().uid); return { status: 'ok', token: await auth.createCustomToken(link.data().uid, { provider }) }; }
    catch (e) { if (e.code !== 'auth/user-not-found') throw e; await ref.delete(); }
  }
  // 같은 이메일로 가입한 회원이 있으면 새 계정을 만들지 않고 연결 방법 안내
  if (p.email) {
    try {
      const u = await auth.getUserByEmail(p.email);
      return { status: 'email-exists', email: p.email, methods: u.providerData.map(x => METHOD_NAMES[x.providerId] || '간편 로그인') };
    } catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
  }
  const u = await auth.createUser({ ...(p.email ? { email: p.email, emailVerified: true } : {}), ...(p.name ? { displayName: p.name.slice(0, 30) } : {}) });
  await ref.set({ uid: u.uid, ...linkData });
  return { status: 'ok', token: await auth.createCustomToken(u.uid, { provider }), created: true };
});

exports.socialUnlink = onCall(async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', '먼저 로그인해 주세요.');
  const provider = String((req.data || {}).provider || '');
  const db = getFirestore();
  const mine = (await db.collection('socialLinks').where('uid', '==', req.auth.uid).get()).docs;
  const target = mine.filter(d => d.data().provider === provider);
  if (!target.length) return { status: 'none' };
  // 비밀번호·구글 로그인이 없고 이 연결이 유일한 로그인 방법이면 해제하지 않음
  const user = await getAuth().getUser(req.auth.uid);
  if (!user.providerData.length && mine.length === target.length) {
    throw new HttpsError('failed-precondition', PROVIDER_NAMES[provider] + '가 유일한 로그인 방법이라 해제할 수 없습니다. 탈퇴하려면 마이페이지의 회원 탈퇴를 이용해 주세요.');
  }
  await Promise.all(target.map(d => d.ref.delete()));
  return { status: 'unlinked' };
});
