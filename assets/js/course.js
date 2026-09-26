/* 온라인 학습 공통 계산
   courses/{courseId}: { title, fee, accessDays, validityMonths, passScore, questionCount, retryMinutes, chapters: [{id,title,type,minutes}], open }
   enrollments/{uid}_{courseId}: { status: active|passed|cancelled, startDate, endDate, endAt, progress: {chapterId: true}, passedOn, validUntil, certNo, score } */
import { todayYmd, addDays, daysBetween } from './membership.js';

export const COURSE_DEFAULTS = { accessDays: 90, validityMonths: 12, passScore: 80, questionCount: 10, retryMinutes: 10 };
export const ENR_STATUS_NAMES = { active: '수강 중', passed: '수료', expired: '기간 만료', cancelled: '취소', none: '미수강' };

export const enrollmentId = (uid, courseId) => uid + '_' + courseId;

// 표시용 상태: 수강 기간이 지났는데 수료하지 못했으면 '기간 만료'
export function enrollmentStatus(e, today = todayYmd()) {
  if (!e) return 'none';
  if (e.status === 'passed') return 'passed';
  if (e.status === 'cancelled') return 'cancelled';
  return today <= e.endDate ? 'active' : 'expired';
}

// 수료가 사전요건으로 인정되는지 (수료 + 인정 기간 안)
export function completionValid(e, today = todayYmd()) {
  if (!e || e.status !== 'passed') return false;
  return !e.validUntil || today <= e.validUntil;
}

export function progressPercent(course, e) {
  const chs = (course && course.chapters) || [];
  if (!chs.length) return 0;
  const done = chs.filter(c => e && e.progress && e.progress[c.id]).length;
  return Math.round(done / chs.length * 100);
}
export function allChaptersDone(course, e) {
  const chs = (course && course.chapters) || [];
  return chs.length > 0 && chs.every(c => e && e.progress && e.progress[c.id]);
}
export function daysLeftInCourse(e, today = todayYmd()) { return e ? daysBetween(today, e.endDate) : 0; }

// 승인 시 새 수강 기간: 오늘부터 accessDays일 (마지막 날 23:59:59 한국 시간까지)
export function newAccessPeriod(course, today = todayYmd()) {
  const days = Number(course.accessDays) || COURSE_DEFAULTS.accessDays;
  const endDate = addDays(today, days - 1);
  return { startDate: today, endDate, endAt: new Date(endDate + 'T23:59:59+09:00') };
}

// 유튜브 주소 또는 ID → 영상 ID
export function youtubeId(v) {
  const s = String(v || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/);
  return m ? m[1] : '';
}
export function totalMinutes(course) {
  return ((course && course.chapters) || []).reduce((s, c) => s + (Number(c.minutes) || 0), 0);
}
