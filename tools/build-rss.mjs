/* RSS 피드(rss.xml) 생성 스크립트
   게시판 글(Firestore posts 컬렉션)을 공개 REST API로 읽어 저장소 루트의 rss.xml을 만듭니다.
   posts는 firestore.rules에서 누구나 읽을 수 있어 비밀값·서비스 계정이 필요 없습니다.
   GitHub Actions(.github/workflows/rss.yml)가 2시간마다 실행하고, 바뀌었을 때만 커밋합니다.
   로컬에서는 저장소 루트에서 `node tools/build-rss.mjs` 로 실행하세요. (Node 18 이상) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://kwasa.or.kr/';
const SITE_NAME = '사단법인 대한수상안전협회';
const PROJECT_ID = 'kwatersafety';
const BOARDS = { notice: '협회 공지사항', news: '협회 소식', schedule: '교육일정 공지', press: '대외 보도자료' };
const MAX_ITEMS = 30;      // 피드에 싣는 최근 글 수
const SUMMARY_LEN = 200;   // 본문 요약 글자 수

const API = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/posts`;

// Firestore REST 값 → 일반 값
function val(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  return undefined;
}

async function fetchPosts() {
  const out = [];
  let pageToken = '';
  do {
    const url = API + '?pageSize=300' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const res = await fetch(url);
    if (!res.ok) throw new Error('Firestore 읽기 실패: ' + res.status + ' ' + (await res.text()).slice(0, 300));
    const j = await res.json();
    for (const d of j.documents || []) {
      const f = d.fields || {};
      out.push({
        id: d.name.split('/').pop(),
        board: val(f.board), title: val(f.title) || '', body: val(f.body) || '',
        date: val(f.date) || '', createdAt: val(f.createdAt) || d.createTime,
        updated: d.updateTime
      });
    }
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return out;
}

const decode = s => s
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
// HTML 태그를 걷어내고 공백을 정리한 요약
function summary(body) {
  const text = decode(String(body).replace(/<br\s*\/?>/gi, ' ').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ').trim();
  return [...text].length > SUMMARY_LEN ? [...text].slice(0, SUMMARY_LEN).join('') + '…' : text;
}
// XML에 쓸 수 없는 제어 문자 제거 + 이스케이프
const x = s => String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 게시판에 보이는 날짜(date, YYYY-MM-DD)를 한국 시간 기준 발행일로. 없으면 작성 시각.
function pubDate(p) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? new Date(p.date + 'T09:00:00+09:00') : new Date(p.createdAt);
  return isNaN(d) ? null : d;
}
// 사이트와 같은 정렬: 날짜 → 작성 시각, 최신순
const sortKey = p => (p.date || '') + (p.createdAt || '');

const posts = (await fetchPosts())
  .filter(p => BOARDS[p.board] && p.title)
  .sort((a, b) => sortKey(b).localeCompare(sortKey(a)))
  .slice(0, MAX_ITEMS);

// lastBuildDate는 실행 시각이 아니라 글의 마지막 수정 시각 → 글이 그대로면 파일도 그대로(불필요한 커밋 방지)
const lastChange = posts.reduce((m, p) => (p.updated > m ? p.updated : m), '');
const lastBuild = lastChange ? new Date(lastChange) : new Date('2025-01-07T00:00:00+09:00');

const item = p => {
  const link = SITE_URL + 'post.html?board=' + p.board + '&id=' + encodeURIComponent(p.id);
  const d = pubDate(p);
  return [
    '    <item>',
    `      <title>${x(p.title)}</title>`,
    `      <link>${x(link)}</link>`,
    `      <guid isPermaLink="true">${x(link)}</guid>`,
    `      <category>${x(BOARDS[p.board])}</category>`,
    d ? `      <pubDate>${d.toUTCString()}</pubDate>` : '',
    `      <description>${x(summary(p.body))}</description>`,
    '    </item>'].filter(Boolean).join('\n');
};

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
  '  <channel>',
  `    <title>${x(SITE_NAME)}</title>`,
  `    <link>${SITE_URL}</link>`,
  `    <atom:link href="${SITE_URL}rss.xml" rel="self" type="application/rss+xml"/>`,
  `    <description>${x(SITE_NAME + ' 공지사항·협회 소식·교육일정·보도자료')}</description>`,
  '    <language>ko</language>',
  `    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>`,
  ...posts.map(item),
  '  </channel>',
  '</rss>', ''].join('\n');

fs.writeFileSync(path.join(ROOT, 'rss.xml'), xml);
console.log('rss.xml 생성: 글 ' + posts.length + '개');
