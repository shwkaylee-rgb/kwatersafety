/* 게시판 데이터
   새 글은 해당 게시판 배열의 맨 앞에 추가하세요. id는 게시판 안에서 겹치지 않게.
   body는 HTML을 쓸 수 있습니다(줄바꿈은 <br>). */
var BOARDS = {
  notice: { title: '협회 공지사항', posts: [
    { id: 2, date: '2026-08-24', author: '관리자', title: '2025년도 착의생존수영지도자 1기 모집 안내',
      body: '2025년도 착의생존수영지도자 1기 교육생을 아래와 같이 모집합니다.<br><br>' +
            '접수 기간 : 2025년 4월 1일 ~ 4월 6일<br>모집 인원 : 30명<br>접수 방법 : 온라인 접수<br><br>' +
            '※ 본 공고의 접수는 2025년 4월 6일 마감되었습니다.' },
    { id: 1, date: '2025-03-28', author: '관리자', title: '2025년도 착의생존수영 자격제도 운영 안내',
      body: '안녕하십니까. 대한수상안전협회입니다.<br><br>2025년도 착의생존수영 자격제도 실시에 관하여 공지드립니다.<br><br>' +
            '금년에 총 4차례의 착의생존수영 자격시험을 실시할 예정이며, 1차 자격시험의 경우,<br>' +
            '2025년 04월 내 구체적인 일정과 장소 등을 재 공지할 예정임을 알려드립니다.<br><br>' +
            '보다 자세한 사항은 협회 홈페이지에 문의사항을 남겨주시면 신속하게 답변드리겠습니다.<br><br>감사합니다.' }
  ]},
  news: { title: '협회 소식', posts: [
    { id: 2, date: '2026-08-24', author: '관리자', title: '착의생존수영지도자 민간자격 등록 완료',
      body: '착의생존수영지도자 민간자격 등록이 2025년 3월 28일 완료되었습니다.<br><br>' +
            '자격종목 : 착의생존수영지도자<br>등록번호 : 제2025-001890호<br>발급기관 : 사단법인 대한수상안전협회<br><br>' +
            '※ 상기 자격은 자격기본법 규정에 따라 등록한 민간자격으로, 국가로부터 인정받은 공인자격이 아닙니다.' },
    { id: 1, date: '2026-08-24', author: '관리자', title: '사단법인 대한수상안전협회 설립',
      body: '사단법인 대한수상안전협회가 2025년 1월 7일 설립되었습니다.<br><br>' +
            '소재지 : 서울특별시 강남구 학동로101길 11, 607호<br><br>협회의 활동은 협회 소식과 공지사항을 통해 전해드리겠습니다.' }
  ]},
  schedule: { title: '교육일정 공지', posts: [] },
  press: { title: '대외 보도자료', posts: [] }
};

function escapeHTML(s) {
  return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
}
function stripTags(s) { return s.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, ''); }
function postURL(board, id) { return 'post.html?board=' + board + '&id=' + id; }

/* 게시판 목록 (표 형태) */
function renderBoardList(el, board) {
  var b = BOARDS[board];
  if (!b.posts.length) { el.innerHTML = '<p class="board-empty">등록된 게시물이 없습니다.</p>'; return; }
  var total = b.posts.length;
  el.innerHTML =
    '<p class="board-count">전체 <b>' + total + '</b>건</p>' +
    '<table class="board-table"><thead><tr><th class="col-no">번호</th><th>제목</th><th class="col-author">작성자</th><th class="col-date">작성일</th></tr></thead><tbody>' +
    b.posts.map(function (p, i) {
      return '<tr><td class="col-no">' + (total - i) + '</td>' +
        '<td class="col-title"><a href="' + postURL(board, p.id) + '">' + escapeHTML(p.title) + '</a></td>' +
        '<td class="col-author">' + escapeHTML(p.author) + '</td><td class="col-date">' + p.date + '</td></tr>';
    }).join('') + '</tbody></table>';
}

/* 메인페이지 최신글 */
function renderLatest(el, board, count, withSummary) {
  var posts = BOARDS[board].posts.slice(0, count || 4);
  if (!posts.length) { el.innerHTML = '<li class="board-empty">등록된 게시물이 없습니다.</li>'; return; }
  el.innerHTML = posts.map(function (p) {
    return '<li><a href="' + postURL(board, p.id) + '">' +
      '<span class="latest-title">' + escapeHTML(p.title) + '</span>' +
      (withSummary ? '<span class="latest-summary">' + escapeHTML(stripTags(p.body)) + '</span>' : '') +
      '<span class="latest-date">' + p.date + '</span></a></li>';
  }).join('');
}

/* 게시글 보기 */
function renderPost(el) {
  var q = new URLSearchParams(location.search);
  var board = q.get('board'), id = Number(q.get('id'));
  var b = BOARDS[board];
  var idx = b ? b.posts.findIndex(function (p) { return p.id === id; }) : -1;
  if (idx < 0) { el.innerHTML = '<p class="board-empty">게시물을 찾을 수 없습니다.</p>'; return; }
  var p = b.posts[idx], newer = b.posts[idx - 1], older = b.posts[idx + 1];
  el.innerHTML =
    '<article class="post-view">' +
      '<header class="post-head"><h2>' + escapeHTML(p.title) + '</h2>' +
      '<p class="post-meta">' + escapeHTML(p.author) + ' <i>|</i> ' + p.date + '</p></header>' +
      '<div class="post-body">' + p.body + '</div>' +
    '</article>' +
    '<ul class="post-nav">' +
      (newer ? '<li><span>다음글</span><a href="' + postURL(board, newer.id) + '">' + escapeHTML(newer.title) + '</a></li>' : '') +
      (older ? '<li><span>이전글</span><a href="' + postURL(board, older.id) + '">' + escapeHTML(older.title) + '</a></li>' : '') +
    '</ul>' +
    '<p class="center"><a class="btn btn-outline" href="' + board + '.html">목록으로</a></p>';
  document.title = p.title + ' | ' + b.title;
}
