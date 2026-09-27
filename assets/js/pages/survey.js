/* 사전 설문(건강 문진표) 작성: survey.html?app=신청서ID&program=과정ID */
import { enabled, db, fs, state, requireLogin, disabledNotice, toast, errMsg, esc, qs } from '../app.js';
import { surveyId, surveyQuestions, renderSurvey, bindSurvey, readSurvey, SENSITIVE_CONSENT as C } from '../survey.js';

const el = document.getElementById('survey');

async function init() {
  if (!enabled) return disabledNotice(el);
  if (!(await requireLogin())) return;
  const appId = qs('app') || '', programId = qs('program') || '';
  let app, program, old;
  try {
    const a = await fs.getDoc(fs.doc(db, 'applications', appId || '-'));
    app = a.exists() ? a.data() : null;
    if (app) {
      const [p, s] = await Promise.all([fs.getDoc(fs.doc(db, 'programs', programId || '-')), fs.getDoc(fs.doc(db, 'surveys', surveyId(appId, programId))).catch(() => null)]);
      program = p.exists() ? { id: p.id, ...p.data() } : null;
      old = s && s.exists() ? s.data() : null;
    }
  } catch (e) { app = null; }
  const item = app && (app.items || []).find(i => i.programId === programId);
  if (!app || !item || !program || !program.surveyOn || !['승인', '접수완료'].includes(app.status)) {
    el.innerHTML = '<p class="board-empty">작성할 사전 설문이 없습니다. <a href="mypage.html#survey">마이페이지로</a></p>';
    return;
  }
  // 이미 제출했으면 제출할 때의 문항으로 수정
  const questions = old && old.questions ? old.questions : surveyQuestions(program);
  const who = app.applicant || {};
  el.innerHTML =
    '<form class="form-card wide sv-form" id="sf">' +
      '<h2>사전 설문 (건강 문진표)</h2>' +
      '<p class="sv-meta"><b>' + esc(item.title) + '</b>' + (item.date ? ' · ' + esc(item.date) : '') + '<br>참가자 <b>' + esc(who.name) + '</b>' +
        (who.guardianName ? ' (보호자 ' + esc(who.guardianName) + ' 작성)' : '') + '</p>' +
      '<p class="form-help">안전한 수상 교육을 위해 교육 전에 작성해 주세요. 지도자와 협회 담당자만 보며, ' + C.period + ' 동안 보관합니다.' +
        (old ? ' <b>이미 제출했습니다. 고칠 내용이 있으면 수정해서 다시 제출하세요.</b>' : '') + '</p>' +
      renderSurvey(questions, old ? old.answers : {}) +
      '<div class="agree sensitive"><p><strong>[필수] 민감정보(건강 정보) 수집·이용 동의</strong><br>' +
        '수집 항목: ' + C.items + '<br>이용 목적: ' + C.purpose + '<br>보유 기간: ' + C.period + '<br>' + C.refuse + '</p>' +
        '<label class="check"><input type="checkbox" name="consent"' + (old ? ' checked' : '') + '> 위 민감정보 수집·이용에 동의합니다.</label></div>' +
      '<div class="btn-row"><a class="btn btn-outline" href="mypage.html#survey">취소</a><button class="btn btn-primary" type="submit">' + (old ? '수정해서 제출' : '제출') + '</button></div>' +
    '</form>';
  const f = document.getElementById('sf');
  bindSurvey(f, questions);
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const r = readSurvey(f, questions);
    if (r.error) { toast('"' + r.error + '" 문항에 답해 주세요.'); return; }
    if (!f.consent.checked) { toast('민감정보 수집·이용에 동의해 주세요.'); return; }
    const btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try {
      await fs.setDoc(fs.doc(db, 'surveys', surveyId(appId, programId)), {
        uid: state.user.uid, applicationId: appId, programId, programTitle: item.title, programDate: item.date || '',
        participantName: who.name || '', answers: r.answers, questions,
        consentSensitive: true, consentAt: old && old.consentAt ? old.consentAt : fs.serverTimestamp(),
        eduEnd: program.endDate || '', submittedAt: fs.serverTimestamp()
      });
      toast('제출했습니다. 감사합니다.');
      setTimeout(() => { location.href = 'mypage.html#survey'; }, 900);
    } catch (err) { toast(errMsg(err)); btn.disabled = false; }
  });
}
init();
