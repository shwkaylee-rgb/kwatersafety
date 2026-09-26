/* 온라인 학습 평가 서버 함수 (서울 리전)
   - startExam: 수강 자격·챕터 완료를 확인하고, 정답을 뺀 문항을 무작위로 출제
   - submitExam: 서버에서 채점하고 합격 시 수료번호를 발급
   정답(courseExams)과 합격 기록은 보안 규칙상 회원이 직접 읽거나 쓸 수 없고, 이 함수만 다룹니다. */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
setGlobalOptions({ region: 'asia-northeast3', maxInstances: 5 });
const db = getFirestore();

const ATTEMPT_LIMIT_MIN = 120;   // 문항을 받은 뒤 이 시간 안에 제출해야 함

// 한국 시간 기준 날짜 'YYYY-MM-DD'
function kstYmd(d = new Date()) {
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  return k.toISOString().slice(0, 10);
}
function addMonths(ymd, months) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}
function shuffle(a) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}

// 공통: 로그인, 수강 중, 기간 안인지 확인
async function loadEnrollment(uid, courseId) {
  const [cSnap, eSnap] = await Promise.all([
    db.doc(`courses/${courseId}`).get(),
    db.doc(`enrollments/${uid}_${courseId}`).get()
  ]);
  if (!cSnap.exists) throw new HttpsError('not-found', '과정을 찾을 수 없습니다.');
  if (!eSnap.exists) throw new HttpsError('permission-denied', '수강 신청이 승인된 과정이 아닙니다.');
  const course = cSnap.data(), enr = eSnap.data();
  if (!['active', 'passed'].includes(enr.status)) throw new HttpsError('permission-denied', '수강할 수 없는 상태입니다.');
  if (enr.endAt && enr.endAt.toMillis() < Date.now()) throw new HttpsError('failed-precondition', '수강 기간이 끝났습니다.');
  return { course, enr, eRef: eSnap.ref };
}

exports.startExam = onCall(async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const uid = req.auth.uid, courseId = String(req.data && req.data.courseId || '');
  const { course, enr } = await loadEnrollment(uid, courseId);
  if (enr.status === 'passed') throw new HttpsError('failed-precondition', '이미 수료한 과정입니다.');

  const chapters = course.chapters || [];
  const progress = enr.progress || {};
  const left = chapters.filter(c => !progress[c.id]);
  if (left.length) throw new HttpsError('failed-precondition', `아직 마치지 않은 챕터가 ${left.length}개 있습니다.`);

  // 재응시 간격
  const retryMin = Number(course.retryMinutes) || 0;
  if (retryMin && enr.lastSubmittedAt && Date.now() - enr.lastSubmittedAt.toMillis() < retryMin * 60000) {
    const wait = Math.ceil((retryMin * 60000 - (Date.now() - enr.lastSubmittedAt.toMillis())) / 60000);
    throw new HttpsError('resource-exhausted', `${wait}분 뒤에 다시 응시할 수 있습니다.`);
  }

  const examSnap = await db.doc(`courseExams/${courseId}`).get();
  const bank = (examSnap.exists && examSnap.data().questions) || [];
  if (!bank.length) throw new HttpsError('failed-precondition', '평가 문항이 아직 준비되지 않았습니다.');
  const count = Math.min(Number(course.questionCount) || bank.length, bank.length);
  const picked = shuffle(bank).slice(0, count);
  // 보기 순서도 응시마다 섞음. order[k] = 화면의 k번째 보기가 원래 몇 번째 보기인지
  const orders = picked.map(q => shuffle(q.options.map((_, k) => k)));

  const ref = await db.collection('examAttempts').add({
    uid, courseId, questionIds: picked.map(q => q.id),
    optionOrders: Object.fromEntries(picked.map((q, i) => [q.id, orders[i]])),
    status: 'started', startedAt: FieldValue.serverTimestamp()
  });
  return {
    attemptId: ref.id, passScore: course.passScore, total: picked.length,
    questions: picked.map((q, i) => ({ id: q.id, question: q.question, options: orders[i].map(k => q.options[k]) }))   // 정답·해설 제외
  };
});

exports.submitExam = onCall(async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const uid = req.auth.uid, attemptId = String(req.data && req.data.attemptId || '');
  const answers = (req.data && req.data.answers) || {};
  const aRef = db.doc(`examAttempts/${attemptId}`);
  const aSnap = await aRef.get();
  if (!aSnap.exists || aSnap.data().uid !== uid) throw new HttpsError('not-found', '응시 기록을 찾을 수 없습니다.');
  const attempt = aSnap.data();
  if (attempt.status !== 'started') throw new HttpsError('failed-precondition', '이미 제출한 평가입니다.');
  if (attempt.startedAt && Date.now() - attempt.startedAt.toMillis() > ATTEMPT_LIMIT_MIN * 60000) {
    await aRef.update({ status: 'expired' });
    throw new HttpsError('deadline-exceeded', '제출 시간이 지났습니다. 평가를 다시 시작해 주세요.');
  }
  const { course, eRef } = await loadEnrollment(uid, attempt.courseId);
  const bank = ((await db.doc(`courseExams/${attempt.courseId}`).get()).data() || {}).questions || [];
  const byId = Object.fromEntries(bank.map(q => [q.id, q]));

  const results = attempt.questionIds.map(id => {
    const q = byId[id] || {};
    // 화면에서 고른 번호를 원래 보기 번호로 되돌려 채점
    const order = (attempt.optionOrders || {})[id];
    const shown = Number.isInteger(answers[id]) ? answers[id] : -1;
    const chosen = shown < 0 ? -1 : order ? order[shown] : shown;
    const correct = chosen === q.answer;
    return { id, correct, explanation: correct ? '' : (q.explanation || '') };
  });
  const right = results.filter(r => r.correct).length;
  const score = Math.round(right / results.length * 100);
  const passed = score >= (Number(course.passScore) || 80);
  const today = kstYmd();

  let certNo = '';
  await db.runTransaction(async tx => {
    const eSnap = await tx.get(eRef);
    const ctrRef = db.doc('counters/courseCert');
    const ctrSnap = passed ? await tx.get(ctrRef) : null;
    tx.update(aRef, { status: 'submitted', answers, score, passed, correctCount: right, submittedAt: FieldValue.serverTimestamp() });
    const upd = { lastSubmittedAt: FieldValue.serverTimestamp(), attemptCount: FieldValue.increment(1), bestScore: Math.max(score, eSnap.data().bestScore || 0) };
    if (passed && eSnap.data().status !== 'passed') {
      const year = today.slice(0, 4);
      let ctr = ctrSnap.exists ? ctrSnap.data() : { year, seq: 0 };
      if (ctr.year !== year) ctr = { year, seq: 0 };
      ctr = { year, seq: ctr.seq + 1 };
      tx.set(ctrRef, ctr);
      certNo = `KWSA-OL-${year}-${String(ctr.seq).padStart(4, '0')}`;
      Object.assign(upd, {
        status: 'passed', score, passedOn: today, passedAt: FieldValue.serverTimestamp(), certNo,
        validUntil: Number(course.validityMonths) ? addMonths(today, Number(course.validityMonths)) : ''
      });
    }
    tx.update(eRef, upd);
  });
  return { score, passed, passScore: course.passScore, correctCount: right, total: results.length, certNo, results };
});
