/* 사전 설문 공통: 문항 목록, 입력 화면, 답변 읽기, 요약
   surveys/{신청서ID}_{과정ID}: { uid, applicationId, programId, programTitle, participantName, answers, questions,
     consentSensitive, consentAt, eduEnd, submittedAt } */
import { esc } from './app.js';
import { STANDARD_SURVEY } from './survey-config.js';
export { SENSITIVE_CONSENT, SURVEY_KEEP_DAYS } from './survey-config.js';

export const surveyId = (appId, programId) => appId + '_' + programId;
export const EXTRA_TYPES = { text: '한 줄 답', textarea: '여러 줄 답', radio: '하나 고르기', check: '여러 개 고르기' };

// 과정의 전체 문항 = 표준 + 과정별 추가
export function surveyQuestions(program) {
  const extra = ((program && program.surveyExtra) || []).map((q, i) => ({ ...q, id: 'x' + i, extra: true }));
  return STANDARD_SURVEY.concat(extra);
}

export function renderSurvey(questions, answers = {}) {
  return questions.map(q => {
    const a = answers[q.id] || {}, name = 'q_' + q.id, req = q.required ? ' <b class="req">*</b>' : '';
    let input;
    if (q.type === 'radio' || q.type === 'check') {
      const picked = [].concat(a.value || []);
      input = '<div class="sv-options">' + q.options.map(o => '<label class="check"><input type="' + (q.type === 'radio' ? 'radio' : 'checkbox') + '" name="' + name + '" value="' + esc(o) + '"' +
        (picked.includes(o) ? ' checked' : '') + '> ' + esc(o) + '</label>').join('') + '</div>' +
        (q.detailOn ? '<input class="sv-detail" name="' + name + '_detail" maxlength="200" placeholder="내용을 적어 주세요" value="' + esc(a.detail || '') + '"' + (q.detailOn.some(o => picked.includes(o)) ? '' : ' hidden') + '>' : '');
    } else if (q.type === 'textarea') input = '<textarea name="' + name + '" rows="3" maxlength="1000">' + esc(a.value || '') + '</textarea>';
    else input = '<input name="' + name + '" maxlength="200" placeholder="' + esc(q.placeholder || '') + '" value="' + esc(a.value || '') + '">';
    return '<fieldset class="sv-q" data-q="' + q.id + '"><legend>' + esc(q.label) + req + '</legend>' + input + '</fieldset>';
  }).join('');
}

// 보기에 따라 상세 입력칸 보이기, '해당 없음'은 다른 보기와 함께 고를 수 없게
export function bindSurvey(form, questions) {
  questions.forEach(q => {
    if (q.type !== 'radio' && q.type !== 'check') return;
    const boxes = [...form.querySelectorAll('[name="q_' + q.id + '"]')], detail = form.querySelector('[name="q_' + q.id + '_detail"]');
    const sync = e => {
      if (q.exclusive && e && e.target.checked) {
        if (e.target.value === q.exclusive) boxes.forEach(b => { if (b !== e.target) b.checked = false; });
        else boxes.forEach(b => { if (b.value === q.exclusive) b.checked = false; });
      }
      if (detail) detail.hidden = !boxes.some(b => b.checked && q.detailOn.includes(b.value));
    };
    boxes.forEach(b => b.addEventListener('change', sync));
  });
}

// 답변 읽기: { answers } 또는 { error: '문항 이름' }
export function readSurvey(form, questions) {
  const answers = {};
  for (const q of questions) {
    const name = 'q_' + q.id;
    let value;
    if (q.type === 'radio') value = (form.querySelector('[name="' + name + '"]:checked') || {}).value || '';
    else if (q.type === 'check') value = [...form.querySelectorAll('[name="' + name + '"]:checked')].map(b => b.value);
    else value = form.querySelector('[name="' + name + '"]').value.trim();
    if (q.required && (!value || (Array.isArray(value) && !value.length))) return { error: q.label };
    const d = form.querySelector('[name="' + name + '_detail"]');
    const detail = d && !d.hidden ? d.value.trim() : '';
    if (d && !d.hidden && !detail) return { error: q.label + ' (내용)' };
    answers[q.id] = detail ? { value, detail } : { value };
  }
  return { answers };
}

// 요약 (관리자 보기·인쇄용). flagged: 지도자가 주의해서 볼 답
export function summarize(questions, answers = {}) {
  return questions.map(q => {
    const a = answers[q.id] || {}, v = [].concat(a.value || []);
    return { label: q.label, value: v.join(', ') + (a.detail ? ' — ' + a.detail : ''), flagged: !!(q.flag && v.some(x => q.flag.includes(x))) };
  });
}
