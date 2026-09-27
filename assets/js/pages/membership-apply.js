import { enabled, db, fs, state, requireLogin, disabledNotice, toast, errMsg, esc, won, fmtDate } from '../app.js';
import { MEMBERSHIP as M, TIER_NAMES, KIND_NAMES, memberStatus, availableKinds, feeFor, bankText, todayYmd } from '../membership.js';
import { appStatusBadge } from '../membership-ui.js';
import { qualValid, qualTitle } from '../qual.js';

const el = document.getElementById('apply');
const col = () => fs.collection(db, 'membershipApplications');

async function init() {
  if (!enabled) return disabledNotice(el);
  if (!(await requireLogin())) return;

  // 처리 중인 신청이 있으면 새 신청 대신 안내
  let pending = null;
  try {
    const snap = await fs.getDocs(fs.query(col(), fs.where('uid', '==', state.user.uid)));
    pending = snap.docs.map(d => ({ id: d.id, ...d.data() })).find(a => a.status === '접수') || null;
  } catch (e) { console.error(e); el.innerHTML = '<p class="board-empty">신청 정보를 불러오지 못했습니다.</p>'; return; }
  if (pending) return showPending(pending);

  const m = state.membership, kinds = availableKinds(m);
  if (!kinds.length) {
    el.innerHTML = '<div class="notice-box">' + (memberStatus(m) === 'suspended'
      ? '멤버십이 정지된 상태입니다. 사무국으로 문의해 주세요.'
      : '지금은 신청할 수 있는 항목이 없습니다.<br><small>갱신은 만료 ' + M.renewWindowDays + '일 전부터 할 수 있습니다. (만료일 ' + esc(m.endDate) + ')</small>') +
      '</div><p class="center"><a class="btn btn-outline" href="mypage.html">마이페이지로</a></p>';
    return;
  }
  // 협회에서 받은 유효한 자격이 있으면 정회원 자격 칸에 바로 불러올 수 있게
  let myQuals = [];
  try {
    const qs2 = await fs.getDocs(fs.query(fs.collection(db, 'qualifications'), fs.where('uid', '==', state.user.uid)));
    myQuals = qs2.docs.map(d => ({ ...d.data(), certNo: d.id })).filter(q => qualValid(q));
  } catch (e) { console.error(e); }
  showForm(m, kinds, myQuals);
}

function showPending(a) {
  el.innerHTML =
    '<div class="form-card wide"><h2>신청이 접수되어 있습니다</h2>' +
    '<div class="app-card"><header>' + appStatusBadge(a.status) + '<small>' + fmtDate(a.createdAt, true) + '</small></header>' +
    '<p><b>' + KIND_NAMES[a.kind] + ' · ' + TIER_NAMES[a.tier] + '</b></p>' +
    '<p class="pay-line">입금하실 금액 <b>' + won(a.fee) + '</b> · 입금자명 ' + esc(a.depositor) + '</p>' +
    '<p class="form-help">' + esc(bankText()) + '</p>' +
    (a.tier === 'full' && a.kind !== 'renew' ? '<p class="form-help">정회원은 입금과 함께 자격 확인 후 승인됩니다.</p>' : '') +
    '<footer><span></span><button type="button" class="btn btn-outline btn-sm" id="cancel">신청 취소</button></footer></div>' +
    '<p class="center"><a class="btn btn-outline" href="mypage.html">마이페이지로</a></p></div>';
  document.getElementById('cancel').addEventListener('click', async () => {
    if (!confirm('이 멤버십 신청을 취소할까요? 이미 입금하셨다면 사무국으로 연락해 주세요.')) return;
    try { await fs.updateDoc(fs.doc(col(), a.id), { status: '취소' }); toast('신청을 취소했습니다.'); init(); }
    catch (e) { toast(errMsg(e)); }
  });
}

function showForm(m, kinds, myQuals = []) {
  const p = state.profile || {};
  const kindRadios = kinds.map((k, i) =>
    '<label class="check"><input type="radio" name="kind" value="' + k + '"' + (i === 0 ? ' checked' : '') + '> ' + KIND_NAMES[k] +
    (k === 'renew' ? ' (' + TIER_NAMES[m.tier] + ')' : '') + '</label>').join('');

  el.innerHTML =
    '<form class="form-card wide" id="f" novalidate><h2>멤버십 신청</h2>' +
    (m && m.memberNo ? '<p class="form-help center">현재 ' + TIER_NAMES[m.tier] + ' · ' + esc(m.memberNo) + ' · 만료 ' + esc(m.endDate) + '</p>' : '') +
    (kinds.length > 1 ? '<fieldset class="choice"><legend>신청 유형</legend>' + kindRadios + '</fieldset>' : '<input type="hidden" name="kind" value="' + kinds[0] + '">') +

    '<fieldset class="choice" id="tier-box"><legend>등급</legend>' +
      '<label class="check"><input type="radio" name="tier" value="general" checked> ' + TIER_NAMES.general + ' (' + won(M.tiers.general.fee) + '/년)</label>' +
      '<label class="check"><input type="radio" name="tier" value="full"> ' + TIER_NAMES.full + ' (' + won(M.tiers.full.fee) + '/년, 지도자 자격 보유자)</label>' +
    '</fieldset>' +
    '<div id="alumni-box" class="guardian">' +
      '<label class="check"><input type="checkbox" name="alumni"> 생존수영 능력 인증서를 받은 준회원 출신입니다 (첫해 ' + Math.round(M.alumniDiscount * 100) + '% 할인)</label>' +
      '<label id="alumni-no" hidden>능력 인증서 번호 <small>(사무국이 확인합니다)</small><input name="certNo" maxlength="40"></label>' +
    '</div>' +

    '<h3 class="form-sub">신청자 정보</h3>' +
    '<div class="form-row"><label>이름<input name="name" required maxlength="30" value="' + esc(p.name || '') + '"></label>' +
    '<label>생년월일<input type="date" name="birth" required></label></div>' +
    '<div class="form-row"><label>휴대폰 번호<input type="tel" name="phone" required value="' + esc(p.phone || '') + '" placeholder="010-0000-0000"></label>' +
    '<label>이메일<input type="email" name="email" required value="' + esc(state.user.email || '') + '"></label></div>' +

    '<div id="qual-box" class="guardian" hidden>' +
      '<h3 class="form-sub">보유 자격 (정회원)</h3>' +
      (myQuals.length ? '<p class="form-help">협회 자격 불러오기: ' + myQuals.map((q, i) => '<button type="button" class="btn btn-outline btn-sm" data-myqual="' + i + '">' + esc(qualTitle(q)) + ' ' + esc(q.certNo) + '</button>').join(' ') + '</p>' : '') +
      '<fieldset class="choice"><legend>자격 구분</legend>' +
        '<label class="check"><input type="radio" name="qualType" value="kwsa" checked> 대한수상안전협회 자격</label>' +
        '<label class="check"><input type="radio" name="qualType" value="external"> 다른 기관의 수상안전 자격</label>' +
      '</fieldset>' +
      '<div class="form-row"><label>자격명<input name="qualName" maxlength="60" placeholder="예: 착의생존수영지도자"></label>' +
      '<label>자격번호<input name="qualNo" maxlength="40"></label></div>' +
      '<div class="form-row"><label id="issuer-box" hidden>발급기관<input name="qualIssuer" maxlength="60" placeholder="예: 대한적십자사"></label>' +
      '<label>취득일<input type="date" name="qualDate"></label></div>' +
      '<p class="form-help" id="ext-help" hidden>다른 기관 자격은 사무국이 확인을 위해 자격증 사본을 이메일로 요청할 수 있습니다.</p>' +
      '<div class="agree"><p><strong>정회원 윤리강령</strong><br>안전을 최우선으로 하고, 보유 자격의 범위 안에서만 지도하며, 아동보호 원칙을 지키고, 자격을 정확하게 표기합니다. 위반 시 자격 정지 또는 제명될 수 있으며, 아동 안전 위반은 영구 제명됩니다.</p>' +
      '<label class="check"><input type="checkbox" name="ethics"> 정회원 윤리강령을 지키겠습니다. (필수)</label></div>' +
    '</div>' +

    '<h3 class="form-sub">회비 증빙</h3>' +
    '<fieldset class="choice"><legend class="sr-only">증빙 종류</legend>' +
      '<label class="check"><input type="radio" name="receipt" value="cash" checked> 현금영수증 (개인)</label>' +
      '<label class="check"><input type="radio" name="receipt" value="invoice"> 계산서 (사업자)</label>' +
      '<label class="check"><input type="radio" name="receipt" value="none"> 필요 없음</label>' +
    '</fieldset>' +
    '<label id="cash-box">현금영수증 받을 휴대폰 번호<input type="tel" name="cashPhone" value="' + esc(p.phone || '') + '"></label>' +
    '<div id="invoice-box" class="guardian" hidden>' +
      '<div class="form-row"><label>사업자등록번호<input name="bizNo" placeholder="000-00-00000" maxlength="12"></label>' +
      '<label>상호<input name="bizName" maxlength="60"></label></div>' +
      '<div class="form-row"><label>대표자 이름<input name="bizOwner" maxlength="30"></label>' +
      '<label>계산서 받을 이메일<input type="email" name="bizEmail"></label></div>' +
    '</div>' +

    '<h3 class="form-sub">입금</h3>' +
    '<label>입금자명<input name="depositor" required maxlength="30" value="' + esc(p.name || '') + '"></label>' +
    '<p class="pay-total">입금하실 금액 <b id="fee">-</b></p>' +
    '<p class="form-help">' + esc(bankText()) + '</p>' +

    '<div class="agree">' +
      '<p>수집 항목: 이름, 생년월일, 휴대폰 번호, 이메일, 입금자명, (정회원) 자격 정보, (증빙 신청 시) 현금영수증 번호 또는 사업자 정보<br>' +
      '이용 목적: 회원 자격 관리, 회비 확인, 현금영수증·계산서 발급<br>보유 기간: 회비 관련 기록은 세법에 따라 5년 ' +
      '<a href="privacy.html" target="_blank">개인정보처리방침</a></p>' +
      '<label class="check"><input type="checkbox" name="agree"> 개인정보 수집·이용에 동의합니다. (필수)</label>' +
      '<label class="check"><input type="checkbox" name="terms"> <a href="terms.html" target="_blank">회원 약관</a>에 동의합니다. (필수)</label>' +
    '</div>' +
    '<button class="btn btn-primary btn-block" type="submit">신청서 제출</button>' +
    '</form>';

  const f = document.getElementById('f');
  const val = n => { const x = f.querySelector('[name="' + n + '"]:checked') || f.querySelector('[name="' + n + '"]'); return x ? x.value : ''; };
  const kind = () => val('kind');
  const tier = () => kind() === 'join' ? val('tier') : kind() === 'upgrade' ? 'full' : m.tier;
  const needQual = () => tier() === 'full' && kind() !== 'renew';
  const isAlumni = () => kind() === 'join' && tier() === 'general' && f.alumni.checked;

  f.querySelectorAll('[data-myqual]').forEach(b => b.addEventListener('click', () => {
    const q = myQuals[b.getAttribute('data-myqual')];
    f.querySelector('[name=qualType][value=kwsa]').checked = true;
    f.qualName.value = qualTitle(q); f.qualNo.value = q.certNo; f.qualDate.value = q.issuedOn; sync();
  }));

  function sync() {
    document.getElementById('tier-box').hidden = kind() !== 'join';
    document.getElementById('alumni-box').hidden = !(kind() === 'join' && tier() === 'general');
    document.getElementById('alumni-no').hidden = !isAlumni();
    document.getElementById('qual-box').hidden = !needQual();
    const ext = val('qualType') === 'external';
    document.getElementById('issuer-box').hidden = !ext;
    document.getElementById('ext-help').hidden = !ext;
    document.getElementById('cash-box').hidden = val('receipt') !== 'cash';
    document.getElementById('invoice-box').hidden = val('receipt') !== 'invoice';
    document.getElementById('fee').textContent = won(feeFor(kind(), tier(), { alumni: isAlumni() })) +
      (kind() === 'upgrade' ? ' (정회원 전환 차액)' : '');
  }
  f.addEventListener('change', sync); sync();

  f.addEventListener('submit', async e => {
    e.preventDefault();
    const t = tier(), k = kind(), need = (sel, msg) => { const x = f.querySelector(sel); if (!x.value.trim()) { toast(msg); x.focus(); throw 0; } };
    try {
      need('[name=name]', '이름을 입력해 주세요.'); need('[name=birth]', '생년월일을 입력해 주세요.');
      need('[name=phone]', '휴대폰 번호를 입력해 주세요.'); need('[name=email]', '이메일을 입력해 주세요.');
      if (isAlumni()) need('[name=certNo]', '능력 인증서 번호를 입력해 주세요.');
      if (needQual()) {
        need('[name=qualName]', '자격명을 입력해 주세요.'); need('[name=qualNo]', '자격번호를 입력해 주세요.');
        if (val('qualType') === 'external') need('[name=qualIssuer]', '발급기관을 입력해 주세요.');
        if (!f.ethics.checked) { toast('정회원 윤리강령에 동의해 주세요.'); return; }
      }
      if (val('receipt') === 'cash') need('[name=cashPhone]', '현금영수증 받을 휴대폰 번호를 입력해 주세요.');
      if (val('receipt') === 'invoice') {
        need('[name=bizNo]', '사업자등록번호를 입력해 주세요.'); need('[name=bizName]', '상호를 입력해 주세요.');
        need('[name=bizOwner]', '대표자 이름을 입력해 주세요.'); need('[name=bizEmail]', '계산서 받을 이메일을 입력해 주세요.');
      }
      need('[name=depositor]', '입금자명을 입력해 주세요.');
    } catch (_) { return; }
    if (ageOn(f.birth.value) < 14) { toast('멤버십은 만 14세 이상만 신청할 수 있습니다.'); return; }
    if (!f.agree.checked || !f.terms.checked) { toast('개인정보 수집·이용과 회원 약관에 동의해 주세요.'); return; }

    const rc = val('receipt');
    const data = {
      uid: state.user.uid, kind: k, tier: t, fee: feeFor(k, t, { alumni: isAlumni() }),
      alumni: isAlumni() ? { certNo: f.certNo.value.trim() } : null,
      applicant: { name: f.name.value.trim(), birth: f.birth.value, phone: f.phone.value.trim(), email: f.email.value.trim() },
      qualification: needQual() ? {
        type: val('qualType'), name: f.qualName.value.trim(), number: f.qualNo.value.trim(),
        issuer: val('qualType') === 'external' ? f.qualIssuer.value.trim() : '대한수상안전협회', date: f.qualDate.value
      } : null,
      ethicsAgreed: needQual(),
      receipt: rc === 'cash' ? { type: 'cash', phone: f.cashPhone.value.trim() }
        : rc === 'invoice' ? { type: 'invoice', bizNo: f.bizNo.value.trim(), bizName: f.bizName.value.trim(), bizOwner: f.bizOwner.value.trim(), email: f.bizEmail.value.trim() }
        : { type: 'none' },
      receiptStatus: rc === 'none' ? 'none' : '대기',
      depositor: f.depositor.value.trim(),
      currentMemberNo: (m && m.memberNo) || '', currentEndDate: (m && m.endDate) || '',
      agreePrivacy: true, agreeTerms: true, appliedOn: todayYmd(),
      status: '접수', createdAt: fs.serverTimestamp()
    };
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try { await fs.addDoc(col(), data); toast('신청서를 제출했습니다.'); init(); }
    catch (err) { toast(errMsg(err)); btn.disabled = false; }
  });
}

function ageOn(birth) {
  const b = new Date(birth), t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}
init();
