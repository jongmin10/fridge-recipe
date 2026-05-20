# 냉장고 레시피 🧊

냉장고 사진을 올리면 AI가 재료를 인식하고, 가진 재료로 만들 수 있는 레시피를 추천해주는 웹 애플리케이션입니다.

## 주요 기능

- **재료 인식** — 냉장고 사진 업로드 시 AI가 재료를 자동으로 인식하고 태그로 표시
- **레시피 추천** — 인식된 재료를 기반으로 AI가 레시피 3가지를 추천 (시간·난이도 필터 지원)
- **레시피북** — 회원가입/로그인 후 마음에 드는 레시피를 저장하고 검색

## 기술 스택

| 구분 | 사용 기술 |
|------|-----------|
| Backend | Node.js, Express 5, Multer |
| Frontend | Vanilla JS, HTML5, CSS3 |
| AI | OpenRouter API (nvidia vision/text 모델) |
| DB | JSON 파일 기반 (data/db.json) |
| 인증 | bcryptjs + 세션 토큰 (crypto.randomBytes) |

### AI 모델
- **이미지 인식** — `nvidia/nemotron-nano-12b-v2-vl:free`
- **레시피 생성** — `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`

## 시작하기

### 사전 요구사항

- Node.js 18 이상
- [OpenRouter](https://openrouter.ai) API 키

### 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/jongmin10/fridge-recipe.git
cd fridge-recipe

# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env
# .env 파일에 OPENROUTER_API_KEY 값을 입력

# 서버 실행
node server.mjs
```

브라우저에서 `http://localhost:3000` 접속

## 프로젝트 구조

```
fridge-recipe/
├── server.mjs          # Express 서버 (API 엔드포인트)
├── db.mjs              # JSON 파일 기반 데이터베이스
├── public/
│   ├── index.html      # 단일 페이지 앱
│   ├── app.js          # 프론트엔드 로직
│   └── style.css       # 스타일
├── data/               # DB 저장 위치 (gitignore)
├── .env.example        # 환경 변수 템플릿
└── PRD_step*.md        # 단계별 기획 문서
```

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/analyze` | 이미지 업로드 → 재료 인식 |
| POST | `/api/recipes` | 재료 목록 → 레시피 추천 |
| POST | `/api/auth/signup` | 회원가입 |
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET/PUT | `/api/profile` | 프로필 조회/수정 |
| GET/POST | `/api/recipes/saved` | 저장된 레시피 목록/저장 |
| DELETE | `/api/recipes/saved/:id` | 저장된 레시피 삭제 |

## 환경 변수

```
OPENROUTER_API_KEY=your_openrouter_api_key_here
```
