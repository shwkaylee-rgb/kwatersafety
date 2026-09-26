/* Firebase 설정
   Firebase 콘솔 > 프로젝트 설정 > 내 앱 > SDK 설정 및 구성 에서 복사한 값입니다.
   이 값들은 공개되어도 괜찮은 식별 정보이며, 데이터 보호는 firestore.rules 가 담당합니다.
   apiKey 가 비어 있으면 로그인·댓글·신청 기능이 꺼지고, 게시판은 posts.js 내용을 보여줍니다. */
export const firebaseConfig = {
  apiKey: 'AIzaSyBQCfHpFAoaxKhx94K9-xzivI1eiPbP1Y8',
  authDomain: 'kwatersafety.firebaseapp.com',
  projectId: 'kwatersafety',
  storageBucket: 'kwatersafety.firebasestorage.app',
  messagingSenderId: '451769425049',
  appId: '1:451769425049:web:e96ecb45e0afa4258aec08'
};
