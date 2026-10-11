# Time Flow (흐름)

한 해가 얼마나 흘렀는지 한눈에 보여주는 시계 겸 플래너. ADHD가 있는 사람도 신년 계획을 작게, 쉽게 세울 수 있도록 만들었다.

- 메인: 큰 연도, 흐르는 캔버스 게이지, 초 단위 롤링 시계. 시간대(새벽·아침·낮·오후·저녁·밤)에 따라 분위기가 바뀐다.
- 하단 부채꼴 다이얼로 연도·월 선택 → 달력 → 모트모트 양식 일일 플래너.
- 형광펜으로 타임라인과 할 일을 같은 색으로 잇는다.
- 연간 계획 페이지: 한 문장, 목표 최대 5개, 365일 지도.

## 실행

```bash
npm install
npm run dev
```

`http://localhost:5190` 에서 열린다. 주소 뒤에 `?demo` 를 붙이면 샘플 기록으로 볼 수 있다.

## 계정 (선택)

로그인 없이도 쓸 수 있고, 기록은 이 기기의 브라우저에 자동 저장된다. 계정을 켜면 이메일 링크로 로그인해서 기기 간에 이어 쓸 수 있고, 로그인 전에 쓴 기록은 그대로 계정으로 옮겨진다.

1. [Supabase](https://supabase.com) 에서 프로젝트를 만든다.
2. SQL Editor 에 [`supabase/schema.sql`](supabase/schema.sql) 을 붙여 넣고 실행한다.
3. Authentication → URL Configuration 의 Site URL / Redirect URLs 에 앱 주소(개발 중에는 `http://localhost:5190`)를 넣는다.
4. `.env.example` 을 `.env.local` 로 복사하고 Project URL 과 publishable 키(예전 이름: anon 키)를 채운 뒤 개발 서버를 다시 띄운다.

같은 항목(하루 / 한 해 계획)을 여러 기기에서 고치면 나중에 고친 쪽이 남는다. 오프라인에서 쓴 기록은 기기에 보관했다가 연결되면 올라간다. 설계 결정은 [DESIGN.md](DESIGN.md) 참고.

React · TypeScript · Vite · StyleX
