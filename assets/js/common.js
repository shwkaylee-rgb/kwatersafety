/* 공통 레이아웃: 헤더, 푸터, 서브 배너, 서브 탭 메뉴
   메뉴를 수정하려면 MENU 배열만 고치면 모든 페이지에 반영됩니다. */
var MENU = [
  { title: '협회소개', href: 'about.html', children: [
    { title: '협회 소개', href: 'about.html' },
    { title: '이사장 인사말', href: 'greeting.html' },
    { title: '조직도', href: 'organization.html' },
    { title: '협력기관', href: 'partners.html' },
    { title: '오시는 길', href: 'location.html' }
  ]},
  { title: '주요사업', href: 'activities-talent.html', children: [
    { title: '수상안전 인재육성', href: 'activities-talent.html' },
    { title: '생존수영 공공교육', href: 'activities-public.html' },
    { title: '생존수영 교육인증', href: 'activities-certify.html' },
    { title: '생존수영 인증서 등록(보호자)', href: 'swim.html' }
  ]},
  { title: '교육과정', href: 'cert-instructor.html', children: [
    { title: '착의생존수영지도자', href: 'cert-instructor.html' },
    { title: '영유아수상교육전문지도자', href: 'cert-infant.html' },
    { title: '응급처치 이수교육', href: 'cert-firstaid.html' },
    { title: '온라인 학습', href: 'online.html' },
    { title: '교육 신청', href: 'programs.html' }
  ]},
  { title: '회원', href: 'membership.html', children: [
    { title: '회원 안내', href: 'membership.html' },
    { title: '멤버십 신청', href: 'membership-apply.html' }
  ]},
  { title: '알림마당', href: 'notice.html', children: [
    { title: '공지사항', href: 'notice.html' },
    { title: '협회 소식', href: 'news.html' },
    { title: '교육일정', href: 'schedule.html' },
    { title: '보도자료', href: 'press.html' },
    { title: '자료실', href: 'resources.html' }
  ]}
];
// Home 메뉴는 따로 두지 않고 왼쪽 위 로고가 첫 화면으로 가는 역할을 합니다.
// 메뉴 밖 바로가기: 상단 오른쪽 작은 링크와 푸터에 함께 나옵니다.
// (생존수영 인증서 등록은 대표님 결정으로 첫 화면 카드와 주요사업 메뉴에만 둡니다.)
var QUICK = {
  verify: { title: '자격 확인', href: 'verify.html' }
};

var SITE = {
  name: '사단법인 대한수상안전협회',
  tel: '010-3483-9209',
  fax: '0504-413-8600',
  email: 'info@kwasa.or.kr',
  address: '서울특별시 강남구 학동로101길 11, 607호(청담동, 엘프론트 청담)',
  regNo: '110121-0141219'
};

(function () {
  var here = location.pathname.split('/').pop() || 'index.html';
  var body = document.body;
  var isHome = body.hasAttribute('data-home');

  function findCurrent() {
    for (var i = 0; i < MENU.length; i++) {
      var m = MENU[i];
      if (m.href === here) return { top: m, sub: m.children ? m.children[0] : null };
      if (m.children) for (var j = 0; j < m.children.length; j++) {
        if (m.children[j].href === here) return { top: m, sub: m.children[j] };
      }
    }
    // 게시글 보기 페이지는 소속 게시판을 현재 위치로 간주
    var board = body.getAttribute('data-board');
    if (board) { here = board + '.html'; return findCurrent(); }
    return null;
  }
  var cur = findCurrent();

  // 로그인·회원가입·장바구니·자격 확인 링크 (로그인 상태에 따라 app.js가 내용을 바꿉니다)
  var UTIL = '<a href="login.html" data-auth="out">로그인</a>' +
    '<a href="signup.html" data-auth="out">회원가입</a>' +
    '<a href="mypage.html" data-auth="in" hidden>마이페이지<b class="notice-count" data-notice-count hidden></b></a>' +
    '<a href="admin.html" data-auth="admin" hidden>관리자</a>' +
    '<a href="#" data-auth="in" data-logout hidden>로그아웃</a>' +
    '<a href="cart.html" class="util-cart">장바구니 <b data-cart-count>0</b></a>' +
    '<a href="' + QUICK.verify.href + '">' + QUICK.verify.title + '</a>';

  function navHTML() {
    return MENU.map(function (m) {
      var active = cur && cur.top === m ? ' is-active' : '';
      var sub = m.children ? '<ul class="gnb-sub">' + m.children.map(function (c) {
        return '<li><a href="' + c.href + '">' + c.title + '</a></li>';
      }).join('') + '</ul>' : '';
      return '<li class="gnb-item' + active + '"><a href="' + m.href + '">' + m.title + '</a>' + sub + '</li>';
    }).join('');
  }

  // 헤더
  var header = document.createElement('header');
  header.className = 'site-header' + (isHome ? ' is-overlay' : '');
  header.innerHTML =
    '<div class="header-inner">' +
      '<a class="logo" href="index.html" aria-label="' + SITE.name + '">' +
        '<img class="logo-white" src="assets/img/logo-white.png" alt="' + SITE.name + '">' +
        '<img class="logo-color" src="assets/img/logo-color.png" alt="' + SITE.name + '">' +
      '</a>' +
      '<nav class="gnb" aria-label="주 메뉴"><ul>' + navHTML() + '</ul></nav>' +
      '<div class="util">' + UTIL + '</div>' +
      '<button class="menu-toggle" type="button" aria-label="메뉴 열기" aria-expanded="false"><span></span><span></span><span></span></button>' +
    '</div>';
  body.insertBefore(header, body.firstChild);

  // 모바일 메뉴
  var mnav = document.createElement('div');
  mnav.className = 'mobile-nav';
  mnav.innerHTML =
    '<div class="mobile-nav-head"><img src="assets/img/logo-mobile.png" alt="' + SITE.name + '">' +
    '<button class="mobile-close" type="button" aria-label="메뉴 닫기">&times;</button></div>' +
    '<div class="mobile-util">' + UTIL + '</div>' +
    '<ul>' + MENU.map(function (m) {
      var sub = m.children ? '<ul>' + m.children.map(function (c) {
        return '<li><a href="' + c.href + '">' + c.title + '</a></li>';
      }).join('') + '</ul>' : '';
      return '<li><a href="' + m.href + '">' + m.title + '</a>' + sub + '</li>';
    }).join('') + '</ul>';
  body.appendChild(mnav);
  var toggle = header.querySelector('.menu-toggle');
  function setMenu(open) {
    body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', open);
  }
  toggle.addEventListener('click', function () { setMenu(true); });
  mnav.querySelector('.mobile-close').addEventListener('click', function () { setMenu(false); });

  // 스크롤 시 헤더 배경 전환
  function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll); onScroll();

  // 서브페이지: 상단 배너 + 탭 메뉴
  var main = document.querySelector('main');
  // 메뉴에 없는 페이지(로그인, 장바구니 등)는 data-page-title로 배너 제목을 지정
  var pageTitle = body.getAttribute('data-page-title');
  if (!cur && pageTitle) cur = { top: { title: pageTitle }, sub: null };
  if (!isHome && cur && main) {
    var title = cur.sub ? cur.sub.title : cur.top.title;
    var banner = document.createElement('section');
    banner.className = 'sub-banner';
    banner.innerHTML =
      '<div class="container"><p class="sub-banner-cat">' + cur.top.title + '</p>' +
      '<h1>' + title + '</h1>' +
      '<p class="breadcrumb"><a href="index.html">Home</a> &gt; ' + cur.top.title +
      (cur.sub && cur.sub.title !== cur.top.title ? ' &gt; ' + cur.sub.title : '') + '</p></div>';
    main.parentNode.insertBefore(banner, main);
    if (cur.top.children) {
      var tabs = document.createElement('nav');
      tabs.className = 'sub-tabs' + (cur.top.children.length > 6 ? ' is-many' : '');
      tabs.setAttribute('aria-label', cur.top.title + ' 하위 메뉴');
      tabs.innerHTML = '<ul class="container">' + cur.top.children.map(function (c) {
        return '<li' + (c === cur.sub ? ' class="is-active"' : '') + '><a href="' + c.href + '">' + c.title + '</a></li>';
      }).join('') + '</ul>';
      main.parentNode.insertBefore(tabs, main);
      // 휴대폰처럼 탭이 옆으로 넘칠 때 지금 보고 있는 탭이 보이도록
      var act = tabs.querySelector('.is-active'), tul = tabs.querySelector('ul');
      if (act && tul.scrollWidth > tul.clientWidth) tul.scrollLeft = act.offsetLeft - (tul.clientWidth - act.offsetWidth) / 2;
    }
    document.title = title + ' | ' + SITE.name;
  }

  // 공식 채널 아이콘: 주소는 tools/build.js 의 OFFICIAL_CHANNELS 한 곳에서 관리하고,
  // build가 <meta name="kwsa-channels">로 페이지에 넣어 줍니다. 주소가 없으면 아무것도 그리지 않습니다.
  var CHANNEL_ICONS = {
    blog: { label: '블로그', svg: '<path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm4 5v8h2.6v-4.3L13.4 16H16V8h-2.6v4.3L10.6 8z"/>' },
    instagram: { label: '인스타그램', svg: '<path d="M12 7.3A4.7 4.7 0 1 0 12 16.7 4.7 4.7 0 0 0 12 7.3zm0 7.7a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm4.9-8.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zM12 4.6c2.4 0 2.7 0 3.6.1 2.4.1 3.6 1.3 3.7 3.7.1.9.1 1.2.1 3.6s0 2.7-.1 3.6c-.1 2.4-1.3 3.6-3.7 3.7-.9.1-1.2.1-3.6.1s-2.7 0-3.6-.1c-2.4-.1-3.6-1.3-3.7-3.7-.1-.9-.1-1.2-.1-3.6s0-2.7.1-3.6c.1-2.4 1.3-3.6 3.7-3.7.9-.1 1.2-.1 3.6-.1zM12 3c-2.4 0-2.8 0-3.7.1-3.3.1-5 1.9-5.2 5.2C3 9.2 3 9.6 3 12s0 2.8.1 3.7c.1 3.3 1.9 5 5.2 5.2.9.1 1.3.1 3.7.1s2.8 0 3.7-.1c3.3-.1 5-1.9 5.2-5.2.1-.9.1-1.3.1-3.7s0-2.8-.1-3.7c-.1-3.3-1.9-5-5.2-5.2C14.8 3 14.4 3 12 3z"/>' },
    youtube: { label: '유튜브', svg: '<path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8c1.6.4 7.8.4 7.8.4s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z"/>' }
  };
  function channelsHTML() {
    var meta = document.querySelector('meta[name="kwsa-channels"]'), ch;
    if (!meta) return '';
    try { ch = JSON.parse(meta.getAttribute('content')); } catch (e) { return ''; }
    var html = Object.keys(CHANNEL_ICONS).filter(function (k) { return /^https?:\/\//.test(ch[k] || ''); }).map(function (k) {
      var url = String(ch[k]).replace(/"/g, '&quot;').replace(/</g, '&lt;');
      return '<a href="' + url + '" target="_blank" rel="noopener" aria-label="' + SITE.name + ' ' + CHANNEL_ICONS[k].label + '" title="' + CHANNEL_ICONS[k].label + '">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">' + CHANNEL_ICONS[k].svg + '</svg></a>';
    }).join('');
    return html ? '<p class="footer-channels">' + html + '</p>' : '';
  }

  // 푸터
  var footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML =
    '<div class="container">' +
      '<div class="footer-top">' +
        '<img class="footer-logo" src="assets/img/logo-footer.png" alt="' + SITE.name + '">' +
        '<ul class="footer-sitemap">' + MENU.map(function (m) {
          var sub = m.children ? '<ul>' + m.children.map(function (c) {
            return '<li><a href="' + c.href + '">' + c.title + '</a></li>';
          }).join('') + '</ul>' : '';
          return '<li><a class="fs-title" href="' + m.href + '">' + m.title + '</a>' + sub + '</li>';
        }).join('') + '</ul>' +
      '</div>' +
      '<div class="footer-info">' +
        '<p class="footer-links"><a href="privacy.html"><b>개인정보처리방침</b></a><i>|</i><a href="terms.html">회원 약관</a><i>|</i><a href="membership.html">회원 안내</a><i>|</i><a href="' + QUICK.verify.href + '">' + QUICK.verify.title + '</a></p>' +
        '<p>' + SITE.name + ' <i>|</i> 전화 : <a href="tel:' + SITE.tel + '">' + SITE.tel + '</a> <i>|</i> 팩스 : ' + SITE.fax +
        ' <i>|</i> 이메일 : <a href="mailto:' + SITE.email + '">' + SITE.email + '</a></p>' +
        '<p>주소 : ' + SITE.address + ' <i>|</i> 등록번호 : ' + SITE.regNo + '</p>' +
        channelsHTML() +
        '<p class="copyright">Copyright ⓒ ' + new Date().getFullYear() + ' ' + SITE.name + ' All rights reserved.</p>' +
      '</div>' +
    '</div>';
  body.appendChild(footer);
})();
