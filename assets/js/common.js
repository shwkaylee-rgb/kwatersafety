/* 공통 레이아웃: 헤더, 푸터, 서브 배너, 서브 탭 메뉴
   메뉴를 수정하려면 MENU 배열만 고치면 모든 페이지에 반영됩니다. */
var MENU = [
  { title: 'Home', href: 'index.html' },
  { title: '협회소개', href: 'about.html', children: [
    { title: '대한수상안전협회 소개', href: 'about.html' },
    { title: '이사장 인사말', href: 'greeting.html' },
    { title: '조직도', href: 'organization.html' },
    { title: '오시는길', href: 'location.html' },
    { title: '회원 안내', href: 'membership.html' }
  ]},
  { title: '활동영역', href: 'activities-talent.html', children: [
    { title: '수상안전 인재육성', href: 'activities-talent.html' },
    { title: '생존수영 공공교육', href: 'activities-public.html' },
    { title: '생존수영 교육인증', href: 'activities-certify.html' },
    { title: '인증서 등록(보호자)', href: 'swim.html' }
  ]},
  { title: '자격제도', href: 'cert-instructor.html', children: [
    { title: '착의생존수영지도자', href: 'cert-instructor.html' },
    { title: '수상인명구조사', href: 'cert-lifeguard.html' },
    { title: '응급처치 이수교육', href: 'cert-firstaid.html' },
    { title: '온라인 학습', href: 'online.html' },
    { title: '자격 확인', href: 'verify.html' },
    { title: '교육·자격 신청', href: 'programs.html' }
  ]},
  { title: '공지사항', href: 'notice.html', children: [
    { title: '협회 공지사항', href: 'notice.html' },
    { title: '협회 소식', href: 'news.html' },
    { title: '교육일정 공지', href: 'schedule.html' },
    { title: '대외 보도자료', href: 'press.html' }
  ]},
  { title: '협력기관', href: 'partners.html' }
];

var SITE = {
  name: '사단법인 대한수상안전협회',
  tel: '010-3483-9209',
  fax: '0504-413-8600',
  email: 'info@kwasa.or.kr',
  ceoEmail: 'shm812@kwatersafety.com',
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

  // 로그인·회원가입·장바구니 링크 (로그인 상태에 따라 app.js가 내용을 바꿉니다)
  var UTIL = '<a href="login.html" data-auth="out">로그인</a>' +
    '<a href="signup.html" data-auth="out">회원가입</a>' +
    '<a href="mypage.html" data-auth="in" hidden>마이페이지<b class="notice-count" data-notice-count hidden></b></a>' +
    '<a href="admin.html" data-auth="admin" hidden>관리자</a>' +
    '<a href="#" data-auth="in" data-logout hidden>로그아웃</a>' +
    '<a href="cart.html" class="util-cart">장바구니 <b data-cart-count>0</b></a>';

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
      tabs.className = 'sub-tabs';
      tabs.setAttribute('aria-label', cur.top.title + ' 하위 메뉴');
      tabs.innerHTML = '<ul class="container">' + cur.top.children.map(function (c) {
        return '<li' + (c === cur.sub ? ' class="is-active"' : '') + '><a href="' + c.href + '">' + c.title + '</a></li>';
      }).join('') + '</ul>';
      main.parentNode.insertBefore(tabs, main);
    }
    document.title = title + ' | ' + SITE.name;
  }

  // 푸터
  var footer = document.createElement('footer');
  footer.className = 'site-footer';
  footer.innerHTML =
    '<div class="container">' +
      '<div class="footer-top">' +
        '<img class="footer-logo" src="assets/img/logo-footer.png" alt="' + SITE.name + '">' +
        '<ul class="footer-sitemap">' + MENU.slice(1).map(function (m) {
          var sub = m.children ? '<ul>' + m.children.map(function (c) {
            return '<li><a href="' + c.href + '">' + c.title + '</a></li>';
          }).join('') + '</ul>' : '';
          return '<li><a class="fs-title" href="' + m.href + '">' + m.title + '</a>' + sub + '</li>';
        }).join('') + '</ul>' +
      '</div>' +
      '<div class="footer-info">' +
        '<p class="footer-links"><a href="privacy.html"><b>개인정보처리방침</b></a><i>|</i><a href="terms.html">회원 약관</a><i>|</i><a href="membership.html">회원 안내</a></p>' +
        '<p>' + SITE.name + ' <i>|</i> 전화 : <a href="tel:' + SITE.tel + '">' + SITE.tel + '</a> <i>|</i> 팩스 : ' + SITE.fax +
        ' <i>|</i> 이메일 : <a href="mailto:' + SITE.email + '">' + SITE.email + '</a></p>' +
        '<p>주소 : ' + SITE.address + ' <i>|</i> 등록번호 : ' + SITE.regNo + '</p>' +
        '<p>대표자 이메일 : ' + SITE.ceoEmail + '</p>' +
        '<p class="copyright">Copyright ⓒ ' + new Date().getFullYear() + ' ' + SITE.name + ' All rights reserved.</p>' +
      '</div>' +
    '</div>';
  body.appendChild(footer);
})();
