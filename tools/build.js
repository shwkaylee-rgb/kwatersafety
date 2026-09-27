/* 사이트 HTML 페이지 생성 스크립트
   페이지 내용(본문)을 고칠 때는 이 파일을 수정한 뒤 저장소 루트에서 `node tools/build.js`를 실행하세요.
   공통 헤더·푸터·메뉴는 assets/js/common.js, 회비·할인율은 assets/js/membership-config.js 에 있습니다. */
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const OUT=path.join(__dirname,'..');
(async()=>{
const {MEMBERSHIP:M}=await import(pathToFileURL(path.join(OUT,'assets/js/membership-config.js')).href);
// 온라인 학습 반영 개인정보처리방침 시행일 (공개 7일 전 공지 후 확정)
const ONLINE_POLICY_DATE='2026년 10월 11일';
const krw=n=>n.toLocaleString('ko-KR')+'원', pct=r=>Math.round(r*100)+'%';
const shell=(title,content,{home=false,page='',posts=false,pageTitle='',extra=''}={})=>`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="사단법인 대한수상안전협회 - 생명보다 더 소중한 가치는 없습니다. 생존수영 교육, 자격제도, 수상안전 문화 확산">
  <meta property="og:title" content="사단법인 대한수상안전협회">
  <meta property="og:image" content="assets/img/og-image.png">
  <link rel="icon" href="assets/img/logo-mobile.png">
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body${home?' data-home':''}${pageTitle?` data-page-title="${pageTitle}"`:''}>
${extra}<main>
${content}
</main>
<script src="assets/js/common.js"></script>${posts?'\n<script src="assets/js/posts.js"></script>':''}
<script type="module" src="assets/js/app.js"></script>${page?`\n<script type="module" src="assets/js/pages/${page}.js"></script>`:''}
</body>
</html>
`;
const T='사단법인 대한수상안전협회';
const P={};

P['index.html']=shell(T,`  <section class="hero">
    <div class="container">
      <p class="hero-eyebrow">생명보다 더 소중한 가치는 없습니다</p>
      <h1>대한수상안전협회</h1>
      <p class="hero-desc">대한수상안전협회는 대한민국을 넘어 전 세계의<br>
        수상안전과 재난안전의 필요성을 알리기 위해 최선을 다하고 있습니다.<br>
        끊임없는 연구를 통해 보다 많은 사람을<br>
        생명의 위협으로부터 지킬 수 있도록 최선을 다하겠습니다.</p>
    </div>
    <a class="scroll-down" href="#activities" aria-label="아래로 스크롤"></a>
  </section>

  <section class="section section-soft" id="activities">
    <div class="container">
      <div class="section-head">
        <p class="eyebrow">ACTIVITIES</p>
        <h2>활동영역</h2>
        <p class="keywords"><span>생존수영 교육</span><span>능력 인증제</span><span>교구개발 및 시범사업운영 등</span></p>
        <p>아래의 다양한 활동을 통해 '대한수상안전협회'는 생존수영 교육부터 인증제를 통한 저변 확대를 기대하며<br>
          이에 필요한 교구 개발, 판매 및 시범사업운영 등을 하고 있습니다.</p>
      </div>
      <div class="activity-grid">
        <article class="activity-card">
          <span class="activity-num">01</span>
          <p class="sub">생존수영 지도자 자격제 등</p>
          <h3>생존수영 교육</h3>
          <p>생존수영 분야 전문가를 육성하고자 직접 자격제도를 운영하여 대한민국 생존수영 발전에 이바지하고자 합니다.</p>
        </article>
        <article class="activity-card">
          <span class="activity-num">02</span>
          <p class="sub">생존수영 능력 인증제 등</p>
          <h3>생존수영 저변 확대</h3>
          <p>영유아부터 성인까지 생존수영 능력 인증제를 실시하여, 교육 목표 달성부터 생존수영 실제 능력 습득 등 저변 확대에 앞장서고자 합니다.</p>
        </article>
        <article class="activity-card">
          <span class="activity-num">03</span>
          <p class="sub">생존수영 교구 개발, 판매 및</p>
          <h3>시범사업 운영, 포럼 개최</h3>
          <p>생존수영에 필요한 교구부터 입수를 어려워하는 친구들까지 생존수영을 익힐 수 있도록 다양한 교구 개발과 시범사업(행사)를 추진중에 있습니다.</p>
        </article>
      </div>
      <p class="center" style="margin-top:50px"><a class="btn btn-primary" href="activities-talent.html">더 알아보기</a></p>
    </div>
  </section>

  <section class="mission">
    <div class="container">
      <p class="quote">- 생명보다 더 소중한 가치는 없습니다 -</p>
      <h2>대한수상안전협회</h2>
      <h3>보다 안전한 세상을 만드는데 앞장서겠습니다</h3>
      <p>대한수상안전협회는 대한민국을 넘어 전세계의 수상 안전과 재난 안전의 필요성을 알리기 위해 최선을 다하고 있습니다.<br>
        끊임없는 연구를 통해 보다 많은 사람을 생명의 위협으로부터 지킬 수 있도록 최선을 다하겠습니다.</p>
    </div>
  </section>

  <section class="section">
    <div class="container latest-grid">
      <div>
        <div class="latest-box-head"><h3>공지사항</h3><a href="notice.html">더보기 +</a></div>
        <ul class="latest-list" id="latest-notice"></ul>
      </div>
      <div>
        <div class="latest-box-head"><h3>협회소식</h3><a href="news.html">더보기 +</a></div>
        <ul class="latest-list" id="latest-news"></ul>
      </div>
    </div>
  </section>`,{home:true,page:'home',posts:true});

P['about.html']=shell(T,`  <section class="page container">
    <div class="about-intro">
      <img src="assets/img/about-main.png" alt="대한수상안전협회 엠블럼">
      <div>
        <h2>'수상안전 사고 예방을 위해 우리는 함께합니다'</h2>
        <p>대한수상안전협회는 끊임없이 발생하고 있는 국내 수상 사고의 예방과
          사고 시 대응 방안을 연구, 발표하고 이를 알리기 위해 국내 유수의 전문가들이 함께하고 있습니다.</p>
        <p>이를 넘어 전 세계 수상 안전 협회와의 소통을 통해 수상 안전사고로부터
          생명을 보호하고 지킬 수 있도록 최선을 다하고 있습니다.</p>
      </div>
    </div>
    <h2 class="page-title">주요 사업</h2>
    <div class="vision-grid">
      <div class="vision-item"><h3>수영시설을 안전하게 관리하는 기반 구축</h3><ul><li>이동형, 조립형 수영장 등 안전점검</li><li>수영시설 정보관리 및 인증 프로세스 구축 등</li></ul></div>
      <div class="vision-item"><h3>이동형 생존수영 및 수영시설 법과 제도개선</h3><ul><li>이동형, 조립형 수영장 등 수영시설 안전인증 시범사업 추진</li><li>수영시설 등 안전관리 법령 개정안 수립 등</li></ul></div>
      <div class="vision-item"><h3>수상안전에 대한 교육과 연구 활성화</h3><ul><li>수상안전 관련 교육 전문성 강화 및 교재 개발</li><li>수상 안전 수칙 표준 가이드 개발 등</li></ul></div>
      <div class="vision-item"><h3>수상안전 문화 확산</h3><ul><li>수상안전 및 수영시설 등 운영자와 이용자에게 안전문화 전파</li><li>SNS를 활용한 대국민 수상안전 문화 확산</li></ul></div>
    </div>
    <img class="page-img" src="assets/img/about-vision.png" alt="대한수상안전협회 비전">
  </section>`);

P['greeting.html']=shell(T,`  <section class="page container">
    <img class="page-img narrow" src="assets/img/greeting.png" alt="이사장 인사말">
  </section>`);

P['organization.html']=shell(T,`  <section class="page container">
    <img class="page-img" src="assets/img/org-chart.png" alt="대한수상안전협회 조직도">
  </section>`);

P['location.html']=shell(T,`  <section class="page container">
    <div class="location-box">
      <p class="addr">서울특별시 강남구 학동로101길 11, 607호(청담동, 엘프론트 청담)</p>
      <p class="contact">전화 010-3483-9209 <i>|</i> 팩스 0504-413-8600 <i>|</i> support@kwatersafety.com</p>
      <p style="margin-top:30px;font-weight:600">지도 바로가기 <span style="color:#999;font-weight:400">(버튼을 클릭해 주세요)</span></p>
      <div class="map-links">
        <a href="https://place.map.kakao.com/1122517152" target="_blank" rel="noopener"><img src="assets/img/map-kakao.png" alt="">카카오맵</a>
        <a href="https://naver.me/GMmLgqFA" target="_blank" rel="noopener"><img src="assets/img/map-naver.png" alt="">네이버지도</a>
      </div>
    </div>
  </section>`);

const toggleScript=`<script>document.querySelectorAll('.more-toggle').forEach(function(b){var t=document.getElementById(b.getAttribute('aria-controls'));b.addEventListener('click',function(){var o=t.hidden;t.hidden=!o;b.textContent=o?'접기':'더보기';b.setAttribute('aria-expanded',o);});});</script>`;

P['activities-talent.html']=shell(T,`  <section class="page container">
    <p class="page-lead">대한수상안전협회는 생존수영 분야 전문가를 육성하여 교육의 질적 향상을 도모하기 위해, 착의생존수영지도자 자격제도를 개설하여 운영중에 있습니다. 이 뿐만 아니라, 수상 인명 구조사 자격제도와 응급처치교육 이수교육을 운영함으로써, 대한민국 수상안전 분야를 선도하는 협회로 성장하고 있습니다.</p>
    <button class="more-toggle" type="button" aria-controls="more1" aria-expanded="false">더보기</button>
    <div class="feature-list" id="more1" hidden>
      <article><h3>착의생존수영지도자 자격제도</h3><p>착의생존수영지도자자격제도는 “맨몸 또는 기구를 이용한 생존뜨기, 구명조끼를 착용하고 체온 유지하기, 잠수하기, 이동하기, 수상 안전 수칙 등 종합적인 수상 안전 수칙을 숙지하고 생존 수영 교육 프로그램 개발, 보급, 수행, 사무, 교육 컨설팅 등의 업무를 수행할 수 있는 전문가를 양성·인증할 수 있는 자격제도입니다.</p></article>
      <article><h3>수상 인명 구조사 자격제도</h3><p>수상 인명 구조사 자격제도는 수상 인명 구조에 필요한 지식·기술·체력 및 수상 인명 구조 장비 활용 능력을 보유한 자로서 수상 레저 이용 시설을 포함한 수상 인명 구조 활동이 필요한 모든 장소에서 그 능력을 발휘할 수 있는 자격을 인정받아 실제 인명 구조에 투입할 수 있는 전문가를 양성·인증할 수 있는 자격제도입니다.</p></article>
      <article><h3>응급처치 이수교육</h3><p>응급처치 이수 교육은 우리가 활동하고 있는 모든 사회적, 물리적 공간에서 발생할 수 있는 인명 사고에 대해 누구나 대응할 수 있는 최소한의 역량을 갖추도록 하는 것으로서 심폐소생술, 응급 상황 발생 시 대응 방안 등을 실제 상황을 가정하여 행동 중심의 교육을 진행하고 있습니다.</p></article>
    </div>
    <div class="card-grid">
      <a href="cert-instructor.html"><figure><img src="assets/img/act-cert1.png" alt=""><figcaption>착의생존수영지도자 자격제도</figcaption></figure></a>
      <a href="cert-lifeguard.html"><figure><img src="assets/img/act-cert2.png" alt=""><figcaption>수상인명구조사 자격제도</figcaption></figure></a>
      <a href="cert-firstaid.html"><figure><img src="assets/img/act-cert3.png" alt=""><figcaption>응급처치 이수교육</figcaption></figure></a>
    </div>
  </section>
  ${toggleScript}`);

P['activities-public.html']=shell(T,`  <section class="page container">
    <p class="page-lead">대한수상안전협회는 초등학교 의무교육과목 중 하나인 생존수영에 대한 공공 서비스 및 위탁교육을 진행하고 있습니다. 학생들을 수영장으로 인솔하여 지도하는 것이 아닌, 국내 최고 수준의 안전한 이동형 수영장과 설비를 기반으로 직접 학교에 찾아가 시설을 설치하고 교육을 실시하여, 수영 실기 교육이 어려운 학교를 대상으로 이동형 생존수영 교실을 통해 모든 학생들의 교육 복지 실현을 이뤄내는데 힘쓰고 있습니다.</p>
    <button class="more-toggle" type="button" aria-controls="more1" aria-expanded="false">더보기</button>
    <div class="more-text" id="more1" hidden>
      <p>이뿐만 아니라, 전국의 특수아동을 위한 맞춤형 생존수영 교육 프로그램과 설비를 갖추어 진정한 교육 복지 실현을 이뤄내고자 국내 유일 10가지 이상의 맞춤형 교육 프로그램을 개발·도입하였고, 이를 통해 주요 협력사인 에쓰엔피씨와 한국수난학회에 생존수영 교육 프로그램을 제안하고 있습니다.</p>
      <p>그 밖에 생존수영의 중요성을 널리 알리기 위해, 전국 자치단체와 협력하여 생존수영캠프(교실) 등의 행사를 추진 중에 있으며, 교육 진행 시 발생할 수 있는 여러 안전사고를 사전에 예방하기 위한 매뉴얼을 연구·개발·보급하여, 안전한 교육 진행을 위해 최선을 다하고 있습니다.</p>
      <p>외에도 물 적응에 어려움을 겪는 아이들을 위해 국내 최초로 실용신안을 획득한 생존수영 영법 보조기구 “플러미”를 제작하여 실제 교육현장에서 적극 활용함으로써, 모든 아이들이 함께할 수 있는 교육환경을 만들고 있습니다.</p>
    </div>
    <div class="card-grid">
      <figure><img src="assets/img/act-pub1.png" alt=""><figcaption>생존수영 프로그램 연구·개발</figcaption></figure>
      <figure><img src="assets/img/act-pub2.png" alt=""><figcaption>생존수영캠프(교실) 운영</figcaption></figure>
      <figure><img src="assets/img/act-pub3.png" alt=""><figcaption>생존수영 영법 보조기구 개발·보급</figcaption></figure>
    </div>
  </section>
  ${toggleScript}`);

P['activities-certify.html']=shell(T,`  <section class="page container">
    <div class="certify">
      <img src="assets/img/act-certify.png" alt="생존수영 능력 인증서">
      <div>
        <p>대한수상안전협회는 생존수영 교육 참여 학생의 적극적인 참여를 유도하고 동기부여를 고취시키기 위해
          <strong>우수한 성적으로 교육을 이수한 학생을 대상으로 생존수영 능력 인증서를 발급</strong>하고 있습니다.</p>
        <p>생존수영능력 인증서를 발급받은 아이들은 대한수상안전협회의 준회원으로 5년간 등록되어,
          협회에서 주관하는 행사에 참여할 수 있는 권리와 협회에서 발급하는 자격제도에 참여 시 가산점을 부여받는 등
          다양한 혜택을 제공받게 됩니다.</p>
        <p>이를 통해 성인이 되어서도 생존수영에 지속적으로 관심을 가질 수 있는 환경을 마련하였고,
          준회원으로 5년간 등록된 이후에는 직접 안내문을 보내 드려, <a href="membership.html">일반회원·정회원</a>으로 가입하거나 준회원 자격을 마칠 수 있도록 하였습니다. 준회원 출신은 일반회원 첫해 회비를 할인받습니다.</p>
        <p>생존수영능력 인증제를 통해 우리 아이들이 어릴 때부터 수상 안전 사고 대처 능력을 갖게 하고,
          연간 수상 안전 사망 사고가 없는 사회를 만들 수 있도록 최선을 다하겠습니다.</p>
      </div>
    </div>
  </section>`);

for(const [f,img,alt] of [['cert-instructor.html','cert-instructor.png','착의생존수영지도자 자격 안내'],['cert-lifeguard.html','cert-lifeguard.png','수상인명구조사 자격 안내'],['cert-firstaid.html','cert-firstaid.png','응급처치 이수교육 안내']])
  P[f]=shell(T,`  <section class="page container">
    <img class="page-img narrow" src="assets/img/${img}" alt="${alt}">
  </section>`);

for(const b of ['notice','news','schedule','press'])
  P[b+'.html']=shell(T,`  <section class="page container">
    <div id="board" data-board="${b}"></div>
  </section>`,{page:'board',posts:true});

P['post.html']=shell(T,`  <section class="page container">
    <div id="post"></div>
  </section>`,{page:'post',posts:true,
  extra:`<script>document.body.setAttribute('data-board', new URLSearchParams(location.search).get('board') || 'notice');</script>\n`});

P['partners.html']=shell(T,`  <section class="page container">
    <p class="page-lead">대한수상안전협회는 국내 수상안전을 선도하고<br>생존수영 분야의 선두 기업들과 함께합니다.</p>
    <div class="partner-grid">
      <div class="row"><img src="assets/img/partner1.png" alt="협력기관"><img src="assets/img/partner2.png" alt="협력기관"></div>
      <div class="row"><img src="assets/img/partner3.png" alt="협력기관"><img src="assets/img/partner4.png" alt="협력기관"></div>
    </div>
  </section>`);

P['privacy.html']=shell(T,`  <section class="page container">
    <article class="policy">
      <p class="policy-lead">사단법인 대한수상안전협회(이하 "협회")는 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고 이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이 개인정보 처리방침을 수립·공개합니다.</p>
      <p class="policy-date">시행일: ${ONLINE_POLICY_DATE} (개정) · 이전 방침: 2026년 10월 4일 개정본</p>

      <nav class="policy-toc" aria-label="목차"><ol>
        <li><a href="#p1">개인정보의 처리 목적</a></li>
        <li><a href="#p2">처리하는 개인정보의 항목</a></li>
        <li><a href="#p3">개인정보의 처리 및 보유 기간</a></li>
        <li><a href="#p4">개인정보의 파기 절차 및 방법</a></li>
        <li><a href="#p5">개인정보의 제3자 제공</a></li>
        <li><a href="#p6">개인정보 처리업무의 위탁</a></li>
        <li><a href="#p7">개인정보의 국외 이전</a></li>
        <li><a href="#p8">만 14세 미만 아동의 개인정보 처리</a></li>
        <li><a href="#p9">정보주체와 법정대리인의 권리·의무 및 행사방법</a></li>
        <li><a href="#p10">개인정보의 안전성 확보조치</a></li>
        <li><a href="#p11">개인정보 자동 수집 장치의 설치·운영 및 거부</a></li>
        <li><a href="#p12">개인정보 보호책임자</a></li>
        <li><a href="#p13">권익침해 구제방법</a></li>
        <li><a href="#p14">개인정보 처리방침의 변경</a></li>
      </ol></nav>

      <h2 id="p1">제1조 (개인정보의 처리 목적)</h2>
      <p>협회는 다음의 목적을 위하여 개인정보를 처리합니다. 처리한 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행합니다.</p>
      <ol>
        <li><b>회원 가입 및 관리:</b> 회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리, 서비스 부정이용 방지, 각종 고지·통지</li>
        <li><b>교육·자격 신청 접수:</b> 교육 및 자격시험 신청 접수, 신청자 본인 확인, 일정·장소·입금 등 안내, 교육 이수 및 자격 취득 여부 확인</li>
        <li><b>멤버십(일반회원·정회원) 관리:</b> 가입·갱신 신청 접수, 정회원 자격 확인, 회비 입금 확인, 회원번호·회원증 발급, 등급별 혜택 제공, 갱신 안내</li>
        <li><b>회비·교육비 증빙 발급:</b> 회비와 교육비에 대한 현금영수증 및 계산서 발급</li>
        <li><b>온라인 학습 운영:</b> 수강 승인과 수강 기간 관리, 학습 진도 확인, 평가 채점, 수료 확인과 수료증 발급, 자격 교육의 사전요건 확인</li>
        <li><b>게시판 운영:</b> 댓글 작성자 표시 및 게시판 관리</li>
        <li><b>민원 처리:</b> 민원인의 신원 확인, 민원사항 확인, 사실조사를 위한 연락·통지, 처리결과 통보</li>
      </ol>

      <h2 id="p2">제2조 (처리하는 개인정보의 항목)</h2>
      <div class="table-wrap"><table class="policy-table">
        <thead><tr><th>구분</th><th>처리 항목</th><th>수집 방법</th></tr></thead>
        <tbody>
          <tr><td>회원가입 (이메일)</td><td>[필수] 이름, 이메일, 비밀번호, 휴대폰 번호, 만 14세 이상 여부</td><td rowspan="2">홈페이지 회원가입</td></tr>
          <tr><td>회원가입 (구글 계정)</td><td>[필수] 이름, 이메일(구글 계정에서 제공), 만 14세 이상 여부<br>[선택] 휴대폰 번호</td></tr>
          <tr><td>교육·자격 신청</td><td>[필수] 참가자 이름, 생년월일, 휴대폰 번호, 이메일<br>[보호자 신청 시 필수] 보호자 이름, 참가자와의 관계<br>[선택] 소속 및 메모<br>[현금영수증 신청 시] 휴대폰 번호<br>[계산서 신청 시] 사업자등록번호, 상호, 대표자 이름, 이메일</td><td>신청서 작성</td></tr>
          <tr><td>온라인 학습</td><td>수강 기간, 챕터별 학습 완료 여부, 평가 응시 기록(제출한 답안, 점수, 합격 여부, 응시 일시), 수료번호, 수료일</td><td>온라인 학습 이용 과정에서 생성</td></tr>
          <tr><td>멤버십 가입·갱신</td><td>[필수] 이름, 생년월일, 휴대폰 번호, 이메일, 입금자명<br>[정회원 필수] 보유 자격명, 자격번호, 발급기관, 취득일<br>[준회원 출신 할인 시] 생존수영 능력 인증서 번호<br>[현금영수증 신청 시] 휴대폰 번호<br>[계산서 신청 시] 사업자등록번호, 상호, 대표자 이름, 이메일</td><td>멤버십 신청서 작성</td></tr>
          <tr><td>댓글 작성</td><td>작성자 이름, 댓글 내용, 작성 일시</td><td>댓글 작성</td></tr>
          <tr><td>자동 수집</td><td>로그인 상태 유지 정보, 접속 일시, 접속 IP 등 서비스 이용 기록</td><td>서비스 이용 과정에서 자동 생성</td></tr>
        </tbody>
      </table></div>

      <h2 id="p3">제3조 (개인정보의 처리 및 보유 기간)</h2>
      <p>협회는 법령에 따른 보유·이용기간 또는 정보주체로부터 개인정보를 수집할 때 동의받은 보유·이용기간 내에서 개인정보를 처리·보유합니다.</p>
      <ol>
        <li><b>회원 정보:</b> 회원 탈퇴 시까지. 탈퇴 즉시 파기합니다.</li>
        <li><b>교육·자격 신청 정보:</b> 신청일로부터 3년. 교육 이수 및 자격 취득 확인, 관련 민원 대응을 위해 회원이 탈퇴하더라도 이 기간 동안 보관합니다.</li>
        <li><b>멤버십 정보(회원번호, 등급, 기간, 보유 자격):</b> 멤버십 종료 또는 회원 탈퇴 후 5년. 회비 거래 기록과 함께 보관합니다.</li>
        <li><b>온라인 학습 기록(진도, 평가 응시 기록, 수료 정보):</b> 수강 기간 또는 수료 인정 기간 중 늦게 끝나는 날부터 3년. 자격 교육의 사전요건 확인과 수료 사실 증명을 위해 보관합니다.</li>
        <li><b>회비·교육비 납부 및 증빙 기록(신청서, 현금영수증·계산서 발급 정보):</b> 「국세기본법」 등 세법에 따라 5년</li>
        <li><b>댓글:</b> 작성자 또는 관리자가 삭제할 때까지. 회원 탈퇴 시 자동으로 삭제되지 않으므로, 필요한 경우 탈퇴 전에 직접 삭제하거나 협회에 삭제를 요청할 수 있습니다.</li>
      </ol>
      <p>다만, 관계 법령 위반에 따른 수사·조사 등이 진행 중인 경우에는 해당 수사·조사 종료 시까지 보유합니다.</p>

      <h2 id="p4">제4조 (개인정보의 파기 절차 및 방법)</h2>
      <ol>
        <li>협회는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다.</li>
        <li>보유기간이 지난 교육·자격 신청 정보는 보유기간 종료일로부터 5일 이내에 파기합니다.</li>
        <li>전자적 파일 형태의 정보는 복구할 수 없는 방법으로 영구 삭제하며, 종이에 출력된 개인정보는 분쇄하거나 소각하여 파기합니다.</li>
      </ol>

      <h2 id="p5">제5조 (개인정보의 제3자 제공)</h2>
      <p>협회는 정보주체의 개인정보를 제1조에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다.</p>
      <p>다만, 회비·교육비에 대한 현금영수증 및 계산서를 발급하는 경우에는 「부가가치세법」, 「조세특례제한법」 등 관계 법령에 따라 발급에 필요한 정보(휴대폰 번호 또는 사업자등록번호, 상호, 대표자 이름, 금액)를 국세청에 제공합니다. 이 밖에는 개인정보를 제3자에게 제공하지 않습니다.</p>

      <h2 id="p6">제6조 (개인정보 처리업무의 위탁)</h2>
      <p>협회는 원활한 서비스 제공을 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.</p>
      <div class="table-wrap"><table class="policy-table">
        <thead><tr><th>수탁자</th><th>위탁 업무</th></tr></thead>
        <tbody>
          <tr><td>Google LLC (Firebase)</td><td>온라인 학습 평가 채점 서버 운영(대한민국 서울 리전), 회원 인증(로그인), 회원 정보·신청서·게시글·댓글 데이터의 저장 및 관리</td></tr>
          <tr><td>GitHub, Inc. (GitHub Pages)</td><td>홈페이지 호스팅 (회원 정보는 저장하지 않으며, 접속 기록만 처리)</td></tr>
        </tbody>
      </table></div>
      <p>협회는 위탁계약 시 「개인정보 보호법」 제26조에 따라 위탁업무 수행 목적 외 개인정보 처리금지, 안전성 확보조치, 재위탁 제한 등 책임에 관한 사항을 확인하고, 수탁자가 개인정보를 안전하게 처리하는지 감독합니다. 위탁 업무의 내용이나 수탁자가 변경될 경우에는 지체 없이 본 개인정보 처리방침을 통하여 공개합니다.</p>

      <h2 id="p7">제7조 (개인정보의 국외 이전)</h2>
      <p>협회는 서비스 제공을 위해 다음과 같이 개인정보를 국외로 이전하여 처리하고 있습니다.</p>
      <div class="table-wrap"><table class="policy-table">
        <tbody>
          <tr><th>이전받는 자</th><td>Google LLC (Firebase)<br>연락처: <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener">firebase.google.com/support/privacy</a></td></tr>
          <tr><th>이전 국가</th><td>회원 인증 정보: 미국 등 Google 데이터센터 소재 국가<br>신청서·게시글·댓글 등 데이터: 대한민국(서울 리전)에 저장</td></tr>
          <tr><th>이전 항목</th><td>이름, 이메일, 비밀번호(암호화), 로그인 기록</td></tr>
          <tr><th>이전 일시 및 방법</th><td>회원가입 및 로그인 시 정보통신망을 통해 전송</td></tr>
          <tr><th>이전 목적</th><td>회원 인증 및 데이터 보관</td></tr>
          <tr><th>보유 기간</th><td>회원 탈퇴 시까지</td></tr>
        </tbody>
      </table></div>
      <p>정보주체는 개인정보의 국외 이전을 거부할 수 있습니다. 다만, 거부하는 경우 회원가입 및 로그인이 필요한 서비스(교육·자격 온라인 신청, 댓글)를 이용할 수 없으며, 교육·자격 신청은 전화 또는 이메일로 하실 수 있습니다.</p>

      <h2 id="p8">제8조 (만 14세 미만 아동의 개인정보 처리)</h2>
      <ol>
        <li>협회 홈페이지의 회원가입은 만 14세 이상만 가능합니다.</li>
        <li>만 14세 미만 아동의 교육 신청은 법정대리인(보호자)이 본인 계정으로 신청하며, 신청 시 법정대리인의 동의를 받습니다.</li>
        <li>이때 아동에 대해서는 참가자 이름과 생년월일 등 교육 신청에 필요한 최소한의 정보만 수집하며, 연락은 법정대리인의 연락처로 합니다.</li>
      </ol>

      <h2 id="p9">제9조 (정보주체와 법정대리인의 권리·의무 및 행사방법)</h2>
      <ol>
        <li>정보주체는 협회에 대해 언제든지 개인정보 열람, 정정·삭제, 처리정지 및 동의 철회를 요구할 수 있습니다.</li>
        <li>회원은 홈페이지 <a href="mypage.html">마이페이지</a>에서 자신의 정보를 직접 열람·수정하거나 회원 탈퇴를 할 수 있습니다.</li>
        <li>그 밖의 권리 행사는 제12조의 개인정보 보호책임자에게 서면, 전화, 이메일로 하실 수 있으며, 협회는 이에 대해 10일 이내에 조치합니다.</li>
        <li>권리 행사는 정보주체의 법정대리인이나 위임을 받은 자 등 대리인을 통하여 할 수 있습니다. 이 경우 위임장을 제출하셔야 합니다.</li>
        <li>다른 법령에서 그 개인정보가 수집 대상으로 명시되어 있는 경우에는 그 삭제를 요구할 수 없습니다.</li>
      </ol>

      <h2 id="p10">제10조 (개인정보의 안전성 확보조치)</h2>
      <ol>
        <li><b>관리적 조치:</b> 개인정보를 처리하는 관리자를 최소한으로 지정하고 관리합니다.</li>
        <li><b>기술적 조치:</b> 비밀번호는 암호화되어 저장·관리되며 협회도 알 수 없습니다. 데이터베이스 보안 규칙을 통해 회원 본인과 지정된 관리자만 해당 정보에 접근할 수 있도록 접근 권한을 통제합니다. 홈페이지와 주고받는 모든 정보는 HTTPS로 암호화하여 전송합니다.</li>
        <li><b>물리적 조치:</b> 개인정보가 저장되는 서버는 수탁자(Google)가 운영하는 보안이 갖춰진 데이터센터에서 관리됩니다.</li>
      </ol>

      <h2 id="p11">제11조 (개인정보 자동 수집 장치의 설치·운영 및 거부)</h2>
      <ol>
        <li>협회 홈페이지는 로그인 상태를 유지하기 위해 이용자의 브라우저 저장소(IndexedDB 등)에 인증 정보를 저장합니다.</li>
        <li>협회는 광고 또는 방문자 분석을 목적으로 한 쿠키나 추적 도구를 사용하지 않습니다.</li>
        <li>이용자는 브라우저 설정에서 사이트 데이터를 삭제하거나 저장을 거부할 수 있습니다. 다만, 이 경우 로그인 상태가 유지되지 않습니다.</li>
        <li>온라인 학습의 영상은 유튜브(Google) 플레이어로 재생됩니다. 협회는 쿠키 사용을 줄이는 유튜브의 개인정보 보호 강화 모드(youtube-nocookie.com)를 사용하지만, 영상을 재생하면 Google이 자체 정책에 따라 정보를 수집할 수 있습니다. 자세한 내용은 Google 개인정보처리방침(policies.google.com/privacy)을 확인해 주세요.</li>
      </ol>

      <h2 id="p12">제12조 (개인정보 보호책임자)</h2>
      <p>협회는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제를 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.</p>
      <div class="table-wrap"><table class="policy-table">
        <tbody>
          <tr><th>개인정보 보호책임자</th><td>사단법인 대한수상안전협회 사무국</td></tr>
          <tr><th>전화</th><td>010-3483-9209</td></tr>
          <tr><th>이메일</th><td>support@kwatersafety.com</td></tr>
          <tr><th>주소</th><td>서울특별시 강남구 학동로101길 11, 607호(청담동, 엘프론트 청담)</td></tr>
        </tbody>
      </table></div>

      <h2 id="p13">제13조 (권익침해 구제방법)</h2>
      <p>정보주체는 개인정보침해로 인한 구제를 받기 위하여 아래 기관에 분쟁해결이나 상담 등을 신청할 수 있습니다.</p>
      <ul>
        <li>개인정보분쟁조정위원회: (국번없이) 1833-6972 (www.kopico.go.kr)</li>
        <li>개인정보침해신고센터: (국번없이) 118 (privacy.kisa.or.kr)</li>
        <li>대검찰청: (국번없이) 1301 (www.spo.go.kr)</li>
        <li>경찰청: (국번없이) 182 (ecrm.police.go.kr)</li>
      </ul>

      <h2 id="p14">제14조 (개인정보 처리방침의 변경)</h2>
      <p>이 개인정보 처리방침은 ${ONLINE_POLICY_DATE}부터 적용됩니다. 내용이 추가·삭제 또는 수정되는 경우에는 시행 7일 전부터 홈페이지 공지사항을 통하여 고지합니다.</p>
      <ul>
        <li>${ONLINE_POLICY_DATE} 개정: 온라인 학습(진도·평가·수료 기록) 처리 목적·항목·보유 기간, 교육비 증빙 발급, 유튜브 영상 재생 안내 추가</li>
        <li>2026년 10월 4일 개정: 멤버십(일반회원·정회원) 가입·갱신, 회비 증빙(현금영수증·계산서) 발급에 관한 처리 목적, 항목, 보유 기간, 제3자 제공 추가</li>
        <li>2026년 9월 26일: 제정</li>
      </ul>
    </article>
  </section>`,{pageTitle:'개인정보처리방침'});

const simple=(id,title,page,posts)=>shell(T,`  <section class="page container">
    <div id="${id}"><p class="board-empty">불러오는 중…</p></div>
  </section>`,{page,posts,pageTitle:title});
P['login.html']=simple('login','로그인','login');
P['signup.html']=simple('signup','회원가입','signup');
P['mypage.html']=simple('mypage','마이페이지','mypage');
P['cart.html']=simple('cart','장바구니','cart');
P['write.html']=simple('write','게시물 작성','write');
P['admin.html']=simple('admin','관리자','admin',true);
P['programs.html']=shell(T,`  <section class="page container">
    <p class="page-lead">대한수상안전협회에서 운영하는 교육과 자격시험을 신청하실 수 있습니다.<br>원하는 과정을 장바구니에 담은 뒤 신청서를 제출해 주세요.</p>
    <div id="programs"><p class="board-empty">불러오는 중…</p></div>
  </section>`,{page:'programs'});

/* ---------- 멤버십 ---------- */
const G=M.tiers.general, F=M.tiers.full;
P['membership.html']=shell(T,`  <section class="page container">
    <p class="page-lead">대한수상안전협회의 회원이 되어 수상안전 문화를 함께 만들어 주세요.<br>회원은 무료 준회원과 연회비를 내는 ${G.name}·${F.name}으로 나뉩니다.</p>
    <div id="membership"><p class="board-empty">불러오는 중…</p></div>
  </section>`,{page:'membership-info'});
P['membership-apply.html']=simple('apply','멤버십 신청','membership-apply');

/* ---------- 온라인 학습 ---------- */
P['online.html']=shell(T,`  <section class="page container">
    <p class="page-lead">자격 교육을 신청하기 전에 온라인으로 먼저 공부하는 과정입니다.<br>영상과 글로 된 챕터를 모두 마치고 평가에 합격하면 수료증이 발급됩니다.</p>
    <div id="online"><p class="board-empty">불러오는 중…</p></div>
  </section>`,{page:'online'});
P['learn.html']=simple('learn','온라인 학습','learn');
P['course-certificate.html']=simple('cert','수료증','course-certificate');
P['edu-certificate.html']=simple('cert','이수증','edu-certificate');
P['qual-certificate.html']=simple('cert','자격증','qual-certificate');
P['survey.html']=simple('survey','사전 설문','survey');
P['payment-receipt.html']=simple('cert','납부확인서','payment-receipt');
P['verify.html']=shell(T,`  <section class="page container">
    <p class="page-lead">대한수상안전협회가 발급한 자격의 진위와 유효 여부를 확인할 수 있습니다.<br>자격증에 적힌 <b>자격번호</b>와 <b>성명</b>을 입력해 주세요.</p>
    <form class="form-card" id="verify-form">
      <label>자격번호<input name="no" required maxlength="40" placeholder="예: KWSA-CS-2026-0001" autocomplete="off"></label>
      <label>성명<input name="name" required maxlength="30" autocomplete="off"></label>
      <button class="btn btn-primary btn-block" type="submit">조회</button>
      <p class="form-help">개인정보 보호를 위해 자격번호와 성명이 모두 일치할 때만 결과를 보여 드리며, 성명은 일부를 가려서 표시합니다.</p>
    </form>
    <div id="verify-result" aria-live="polite"></div>
  </section>`,{page:'verify'});
P['membership-card.html']=simple('card','회원증','membership-card');

P['terms.html']=shell(T,`  <section class="page container">
    <article class="policy">
      <p class="policy-lead">이 약관은 사단법인 대한수상안전협회(이하 "협회")의 회원 제도와 회원의 권리·의무를 정합니다.</p>
      <p class="policy-date">시행일: 2026년 10월 4일</p>

      <h2 id="t1">제1조 (회원의 구분)</h2>
      <ol>
        <li><b>준회원:</b> 협회의 생존수영 교육을 이수하고 생존수영 능력 인증서를 받은 사람으로, 인증서 발급일부터 5년간 회비 없이 등록됩니다.</li>
        <li><b>${G.name}:</b> 만 14세 이상으로 협회의 목적에 동의하고 연회비를 낸 사람</li>
        <li><b>${F.name}:</b> 만 14세 이상으로 협회의 지도자 자격 또는 협회가 인정하는 수상안전 자격을 보유하고, 윤리강령에 서약하고, 협회의 심사를 거쳐 연회비를 낸 사람</li>
        <li>단체 회원은 두지 않습니다.</li>
      </ol>

      <h2 id="t2">제2조 (가입)</h2>
      <ol>
        <li>${G.name}·${F.name} 가입은 홈페이지 회원가입 후 멤버십 신청서를 제출하고 연회비를 입금하는 방식으로 합니다.</li>
        <li>협회는 입금(${F.name}은 보유 자격 포함)을 확인한 뒤 회원 자격을 부여하고 회원번호를 발급합니다.</li>
        <li>협회는 신청 내용이 사실과 다르거나 자격 요건을 갖추지 못한 경우 가입을 거절할 수 있으며, 이 경우 받은 회비를 전액 돌려드립니다.</li>
      </ol>

      <h2 id="t3">제3조 (회비)</h2>
      <ol>
        <li>연회비는 ${G.name} ${krw(G.fee)}, ${F.name} ${krw(F.fee)}이며, 회원 기간이 시작되기 전에 냅니다.</li>
        <li>준회원 출신이 ${G.name}으로 처음 가입하는 경우 첫해 회비를 ${pct(M.alumniDiscount)} 할인합니다.</li>
        <li>회비는 협회의 수입으로 처리하며, 요청에 따라 개인에게는 현금영수증을, 사업자에게는 계산서를 발급합니다. 회비는 기부금이 아니므로 기부금 영수증은 발급하지 않습니다.</li>
        <li>회비 금액이 바뀌는 경우 시행 30일 전까지 홈페이지에 알립니다. 이미 낸 회비의 기간에는 영향을 주지 않습니다.</li>
      </ol>

      <h2 id="t4">제4조 (회원 기간과 갱신)</h2>
      <ol>
        <li>회원 기간은 협회가 입금을 확인한 날부터 1년입니다.</li>
        <li>회원은 만료 ${M.renewWindowDays}일 전부터 갱신을 신청할 수 있습니다. 만료 전이나 만료 후 ${M.graceDays}일(유예 기간) 안에 갱신하면 기존 만료일 다음 날부터 1년이 이어집니다.</li>
        <li>유예 기간 안에는 회원 혜택을 계속 받을 수 있습니다. 유예 기간이 지나도록 갱신하지 않으면 회원 자격은 별도 통지 없이 끝납니다.</li>
        <li>자동 결제·자동 갱신은 하지 않습니다.</li>
      </ol>

      <h2 id="t5">제5조 (등급 전환)</h2>
      <p>${G.name}이 ${F.name} 자격 요건을 갖춘 경우, 차액(${krw(F.fee-G.fee)})을 내고 심사를 거쳐 ${F.name}으로 전환할 수 있습니다. 회원 기간은 그대로 유지됩니다.</p>

      <h2 id="t6">제6조 (회원의 혜택)</h2>
      <ol>
        <li>${G.name}은 협회 교육·자격 신청비 ${pct(G.discount)} 할인, 기본 자료실, 협력기관 할인, 디지털 회원증 등을 받습니다.</li>
        <li>${F.name}은 협회 교육·자격 신청비 ${pct(F.discount)} 할인, 연 1회 보수교육 무료, 전체 자료실, 협력기관 할인, 디지털 회원증을 받으며, 정관에 따라 총회 의결권과 임원 선거권을 가집니다.</li>
        <li>등급별 혜택의 자세한 내용은 <a href="membership.html">회원 안내</a> 페이지에 공개하며, 협회는 사정에 따라 혜택을 바꿀 수 있습니다. 혜택을 줄이는 경우 30일 전까지 알립니다.</li>
      </ol>

      <h2 id="t7">제7조 (해지와 환불)</h2>
      <ol>
        <li>회원은 언제든지 해지할 수 있습니다. 해지하면 다음 갱신을 하지 않으며, 이미 낸 회비의 남은 기간에는 회원 자격이 유지됩니다.</li>
        <li>가입 또는 갱신 후 ${M.refundDays}일 안에 회원 혜택을 이용하지 않은 경우 회비 전액을 돌려드립니다. 이때 발급한 현금영수증·계산서는 취소합니다.</li>
        <li>협회가 제9조에 따라 회원을 제명한 경우 남은 기간에 해당하는 회비를 돌려드립니다.</li>
        <li>그 밖의 환불은 관계 법령에 따릅니다.</li>
      </ol>

      <h2 id="t8">제8조 (회원의 의무와 윤리강령)</h2>
      <ol>
        <li>회원은 협회의 정관과 이 약관을 지켜야 합니다.</li>
        <li>${F.name}은 다음 윤리강령을 지켜야 합니다.
          <ul>
            <li>교육 참가자와 일반인의 안전을 무엇보다 우선합니다.</li>
            <li>보유한 자격의 범위 안에서만 지도합니다.</li>
            <li>아동과 취약한 사람을 보호하는 원칙을 지킵니다.</li>
            <li>자격과 협회와의 관계를 정확하게 표기하고, 과장하거나 사실과 다르게 알리지 않습니다.</li>
            <li>교육 참가자의 개인정보를 보호합니다.</li>
          </ul></li>
        <li>회원은 신청서에 적은 정보가 바뀌면 마이페이지에서 고치거나 협회에 알려야 합니다.</li>
      </ol>

      <h2 id="t9">제9조 (자격 정지와 제명)</h2>
      <ol>
        <li>협회는 회원이 거짓 정보로 가입하거나, 윤리강령을 위반하거나, 협회의 명예를 훼손한 경우 회원 자격을 정지하거나 제명할 수 있습니다.</li>
        <li>협회는 결정 전에 회원에게 소명할 기회를 드립니다.</li>
        <li>아동 안전과 관련된 중대한 위반으로 제명된 경우 다시 가입할 수 없습니다.</li>
        <li>회원 자격이 끝난 사람은 협회 회원이라는 명칭을 쓰거나 협회와 관계가 있는 것처럼 알려서는 안 됩니다.</li>
      </ol>

      <h2 id="t95">제9조의2 (온라인 학습)</h2>
      <ol>
        <li>온라인 학습은 신청 후 입금이 확인되어 협회가 승인한 날부터 과정별로 정한 수강 기간 동안 이용할 수 있습니다.</li>
        <li>모든 챕터를 마치고 평가에서 과정별 합격 점수 이상을 받으면 수료하며, 수료번호와 수료증이 발급됩니다. 수료는 과정별로 정한 인정 기간 동안 자격 교육의 사전요건으로 인정됩니다.</li>
        <li>평가는 본인이 직접 응시해야 합니다. 대리 응시, 답안 공유 등 부정한 방법이 확인되면 협회는 수료를 취소할 수 있습니다.</li>
        <li>강의 영상과 자료의 저작권은 협회 또는 원저작자에게 있으며, 수강 목적 외에 녹화·복제·배포할 수 없습니다.</li>
        <li><b>환불:</b> 학습을 시작하기 전(완료한 챕터가 없을 때)에는 전액을 돌려드립니다. 학습을 시작한 뒤에는 수강 기간의 3분의 1이 지나기 전 3분의 2, 2분의 1이 지나기 전 2분의 1을 돌려드리며, 그 이후나 수료한 뒤에는 돌려드리지 않습니다.</li>
      </ol>

      <h2 id="t10">제10조 (개인정보)</h2>
      <p>회원의 개인정보는 협회의 <a href="privacy.html">개인정보처리방침</a>에 따라 처리합니다.</p>

      <h2 id="t11">제11조 (약관의 변경)</h2>
      <p>협회는 필요한 경우 이 약관을 바꿀 수 있으며, 바뀐 약관은 시행 7일 전(회원에게 불리한 변경은 30일 전)부터 홈페이지에 알립니다.</p>
    </article>
  </section>`,{pageTitle:'회원 약관'});

for(const [f,c] of Object.entries(P)) fs.writeFileSync(path.join(OUT,f),c);
console.log(Object.keys(P).length+'개 페이지 생성');
})();
