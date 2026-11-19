# 해외 주식 뉴스 수집기 (AI News Collector)

해외 주식 뉴스 RSS를 버튼 하나로 모으고, Claude가 한국어 제목·요약을 만들고 카테고리로 분류해 카드로 보여 주는 웹 앱입니다. 원하는 뉴스는 내 노션 데이터베이스에 저장할 수 있습니다. 여러 사용자가 쓰며, 카테고리·뉴스 목록·노션 연결은 사용자마다 따로 관리됩니다.

## 주요 기능

- **뉴스 가져오기** — Bloomberg Markets, WSJ Markets, Investing.com 피드에서 최근 24시간 기사를 수집합니다. 같은 기사는 정규화한 URL로 중복을 막습니다.
- **한국어 번역·요약·분류** — Claude API로 한국어 제목과 요약을 만들고 사용자 카테고리로 분류합니다. 번역은 기사(URL)당 한 번만 하고 모든 사용자가 공유합니다. 처리는 5건씩 나눠 진행하며 진행률을 표시합니다.
- **카테고리별 보기** — 전체 / 각 카테고리 / 미분류 탭으로 걸러 보고, 한 페이지에 9건씩 봅니다.
- **카테고리 관리** — `/categories`에서 추가·이름 수정·삭제합니다. 처음 접속하면 기본 카테고리(시장 동향, 기업 실적, 경제 지표, 연준·금리, 기술주)가 만들어집니다.
- **노션 저장** — 노션 OAuth로 연결하면 '해외 주식 뉴스' 데이터베이스를 만들고, 카드의 'news 저장' 버튼으로 기사를 행으로 추가합니다.

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS 4 |
| 로그인 | Clerk 7 |
| 데이터베이스 | Neon (Postgres), Drizzle ORM |
| 번역·요약·분류 | Claude API (`@anthropic-ai/sdk`), Zod |
| 노션 저장 | 노션 호스팅 MCP 서버(`https://mcp.notion.com/mcp`), `@modelcontextprotocol/sdk` |
| RSS 파싱 | `rss-parser` |
| 배포 | Vercel |

## 시작하기

### 1. 준비물

- Node.js 20 이상
- [Clerk](https://clerk.com) 애플리케이션
- [Neon](https://neon.tech) Postgres 데이터베이스
- [Anthropic](https://console.anthropic.com) API 키
- 노션 계정(노션 저장을 쓸 때)

### 2. 설치

```bash
git clone https://github.com/dia2024/stock-news-app.git
cd stock-news-app
npm install
```

### 3. 환경변수

프로젝트 루트에 `.env.local`을 만들고 다음 값을 채웁니다. `.env*` 파일은 git에 올라가지 않습니다.

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Neon
DATABASE_URL=postgresql://...

# Claude API (ANTHROPIC_MODEL은 생략하면 claude-opus-5-5)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-5-5

# 노션 토큰 암호화 키: 32바이트를 base64(url) 또는 hex 64자로
TOKEN_ENCRYPTION_KEY=...

# OAuth 리디렉션 URI를 만들 때 쓰는 앱 주소
APP_URL=http://localhost:3000
```

암호화 키는 다음 명령으로 만들 수 있습니다.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. 데이터베이스 준비

```bash
npm run db:migrate
```

### 5. 개발 서버 실행

```bash
npm run dev
```

http://localhost:3000 에 접속해 로그인한 뒤 '뉴스 가져오기'를 누릅니다.

## 명령어

| 명령어 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 실행 |
| `npm run build` | 프로덕션 빌드와 타입 검사 |
| `npm run start` | 빌드한 앱 실행 |
| `npm run lint` | ESLint 검사 |
| `npm run db:generate -- --name <이름>` | `src/db/schema.ts` 변경으로 마이그레이션 SQL 생성 |
| `npm run db:migrate` | 마이그레이션을 `DATABASE_URL`의 DB에 적용 |
| `npm run db:studio` | 브라우저로 DB 보기 |
| `npm run db:seed -- <Clerk userId>` | 개발용 예제 기사 5건과 기본 카테고리 넣기 |
| `npm run notion:tools -- <Clerk userId> [도구 이름...]` | 그 사용자의 토큰으로 노션 MCP 도구 목록·입력 스키마 출력 |

## 화면과 라우트

| 경로 | 내용 |
|---|---|
| `/sign-in`, `/sign-up` | 로그인·회원가입 (이 두 경로 외에는 모두 로그인이 필요합니다) |
| `/` | 뉴스 가져오기, 진행률, 노션 연결 상태, 카테고리 탭, 뉴스 카드 목록 |
| `/categories` | 카테고리 추가·이름 수정·삭제 |
| `/api/notion/connect`, `/api/notion/callback` | 노션 OAuth 시작과 콜백 |

## 프로젝트 구조

```
src/
  app/
    dashboard/        대시보드 화면, 뉴스 수집·처리·노션 저장 Server Function
    categories/       카테고리 관리 화면
    api/notion/       노션 OAuth 라우트
    sign-in/, sign-up/
  db/                 Drizzle 스키마와 쿼리
  lib/
    news/             RSS 피드 목록과 수집·파싱
    ai/               Claude 번역·요약·분류
    notion/           OAuth, 토큰 암호화, MCP 접속, 데이터베이스 생성·저장
  proxy.ts            로그인 검사
drizzle/              마이그레이션 SQL
scripts/              시드, 노션 도구 확인 스크립트
```

## 동작 방식

1. '뉴스 가져오기'를 누르면 세 피드에서 최근 24시간 기사를 읽어 원문만 공용 `articles` 테이블에 저장하고 사용자 목록에 연결합니다. 피드 하나가 실패해도 나머지는 계속 처리합니다.
2. 클라이언트가 처리 배치를 반복 호출합니다. 한 번에 약 5건씩, 번역이 없는 기사는 번역·요약·분류를, 이미 번역된 기사는 분류만 합니다. Vercel 실행 시간 제한 때문에 나눠서 처리합니다.
3. Claude가 거절하거나 실패한 기사는 저장하지 않고 다음 수집 때 다시 시도합니다.
4. 노션은 OAuth 2.1(동적 클라이언트 등록, PKCE)로 연결하며, 토큰은 AES-256-GCM으로 암호화해 서버에만 저장합니다. 연결이 만료되면 재연결을 안내합니다.

## 문서

- [`PRD.md`](PRD.md) — 요구사항, 데이터 모델, 처리 흐름, 구현 순서, 검증 기준
- [`ui.md`](ui.md) — UI 가이드(색·글꼴, 레이아웃, 카드, 문구 규칙)
- [`CLAUDE.md`](CLAUDE.md) — 개발 메모와 주의점

## 참고

- 기사 본문은 스크래핑하지 않고 RSS의 제목과 설명만 요약합니다.
- WSJ·Investing.com 피드의 상업적 이용 조건은 공개 운영 전에 확인해야 합니다.

## 사용한 플러그인

- Frontend Design : UI 디자인 품질 향상
- commit-commands : 깃 워크플로 자동화
