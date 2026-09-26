/* 멤버십 공통 계산 (상태, 기간, 금액)
   memberships/{uid} 문서: { tier, memberNo, startDate, endDate ('YYYY-MM-DD'), suspended, ... }
   상태는 저장하지 않고 만료일로 계산합니다. */
import { MEMBERSHIP as M } from './membership-config.js';
export { M as MEMBERSHIP };

export const TIER_NAMES = { general: M.tiers.general.name, full: M.tiers.full.name };
export const KIND_NAMES = { join: '신규 가입', renew: '갱신', upgrade: '정회원 전환' };
export const STATUS_NAMES = { active: '활성', grace: '유예', expired: '만료', suspended: '정지', none: '비회원' };

const pad = n => String(n).padStart(2, '0');
export function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
export function parseYmd(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
// 시작일로부터 1년 뒤의 전날 (예: 2026-10-01 → 2027-09-30)
export function oneYearFrom(s) { const d = parseYmd(s); d.setFullYear(d.getFullYear() + 1); d.setDate(d.getDate() - 1); return ymd(d); }
export function daysBetween(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / 86400000); }
export function todayYmd() { return ymd(new Date()); }

// 현재 상태: active(활성) / grace(만료 후 유예) / expired(만료) / suspended(정지) / none(가입 이력 없음)
export function memberStatus(m, today = todayYmd()) {
  if (!m || !m.endDate) return 'none';
  if (m.suspended) return 'suspended';
  if (today <= m.endDate) return 'active';
  if (daysBetween(m.endDate, today) <= M.graceDays) return 'grace';
  return 'expired';
}
// 혜택(교육비 할인)을 받을 수 있는 상태인지: 활성·유예
export function hasBenefits(m, today) { const s = memberStatus(m, today); return s === 'active' || s === 'grace'; }
export function discountRate(m, today) { return hasBenefits(m, today) ? M.tiers[m.tier].discount : 0; }
export function daysLeft(m, today = todayYmd()) { return m && m.endDate ? daysBetween(today, m.endDate) : 0; }

// 지금 신청할 수 있는 것: ['join'] / ['renew'] / ['renew','upgrade'] / ['upgrade'] / []
export function availableKinds(m, today = todayYmd()) {
  const s = memberStatus(m, today);
  if (s === 'suspended') return [];
  if (s === 'none' || s === 'expired') return ['join'];
  const kinds = [];
  if (s === 'grace' || daysLeft(m, today) <= M.renewWindowDays) kinds.push('renew');
  if (m.tier === 'general') kinds.push('upgrade');
  return kinds;
}

// 신청 금액
export function feeFor(kind, tier, { alumni = false } = {}) {
  if (kind === 'upgrade') return M.tiers.full.fee - M.tiers.general.fee;
  const fee = M.tiers[tier].fee;
  return kind === 'join' && tier === 'general' && alumni ? Math.round(fee * (1 - M.alumniDiscount)) : fee;
}

// 관리자 활성화 시 새 기간 계산
export function nextPeriod(kind, m, today = todayYmd()) {
  if (kind === 'upgrade' && m) return { startDate: m.startDate, endDate: m.endDate };
  if (kind === 'renew' && m && m.endDate && daysBetween(m.endDate, today) <= M.graceDays) {
    // 만료 전이나 유예 기간 안: 기존 만료일 다음 날부터 1년 (기간이 이어짐)
    const start = addDays(m.endDate, 1);
    return { startDate: m.startDate, endDate: oneYearFrom(start) };
  }
  return { startDate: today, endDate: oneYearFrom(today) };
}

// 회원번호: KWSA-G-2026-0001 (일련번호는 등급과 관계없이 연도별로 하나)
export function formatMemberNo(tier, year, seq) {
  return M.numberPrefix + '-' + M.tiers[tier].code + '-' + year + '-' + String(seq).padStart(4, '0');
}
// 정회원 전환 시 회원번호의 등급 글자만 바꿈
export function retierMemberNo(no, tier) {
  const parts = no.split('-'); parts[1] = M.tiers[tier].code; return parts.join('-');
}

export function bankText() {
  const b = M.bank;
  return b.account ? b.name + ' ' + b.account + ' (예금주 ' + b.holder + ')' : '입금 계좌는 신청 접수 후 사무국이 문자 또는 이메일로 안내합니다.';
}
