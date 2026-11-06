# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 프로젝트

해외 주식 뉴스 RSS를 버튼으로 수집하고, Claude API로 한국어 제목·요약·카테고리 분류를 만들어 카드로 보여 주는 다중 사용자 웹 앱이다. 원하는 뉴스는 사용자의 노션에 저장한다. 요구사항, 데이터 모델, 처리 흐름, 구현 순서, 검증 기준은 모두 `PRD.md`에 있으니 기능 작업 전에 해당 절을 먼저 읽는다.

현재 상태: 패키지 설치만 끝났고 앱 코드는 없다(`src/app`은 create-next-app 기본 파일). 구현은 PRD 12절 순서(Clerk → Drizzle 스키마 → 카테고리 CRUD → RSS·Claude 수집 → 카드 목록 → 노션 OAuth·MCP → Vercel)로 진행한다.

## 명령어

- `npm run dev` — 개발 서버 (http://localhost:3000)
- `npm run build` — 프로덕션 빌드와 타입 검사. PRD의 기본 검증 기준이다.
- `npm run lint` — ESLint (flat config, `eslint-config-next`의 core-web-vitals + typescript)
- 테스트 러너는 아직 없다.
- Drizzle 설정(`drizzle.config.ts`)과 마이그레이션 스크립트는 아직 없다. 2단계에서 `drizzle-kit`과 `dotenv`로 추가할 예정이다.

## 스택과 설정상 주의점

- **Next.js 16.4 / React 19.3.** 학습 데이터와 API가 다르다. 코드를 쓰기 전에 `node_modules/next/dist/docs/`에서 해당 문서를 확인한다.
  - 인증 검사는 `middleware.ts`가 아니라 `src/proxy.ts`에 둔다.
  - `params`, `searchParams`, `cookies()`, `headers()`는 비동기로만 접근한다.
  - 페이지와 레이아웃 props에는 전역 타입 `PageProps<"/경로">`, `LayoutProps<"/경로">`를 쓴다.
- **`next.config.ts`에 `cacheComponents: true`와 `partialPrefetching: true`가 켜져 있다.** 데이터 조회는 기본적으로 동적이고, 캐시는 `use cache`로 명시한다. 라우트에 `export const runtime`을 두면 안 된다(Cache Components는 Node.js 런타임 전용). 오래 걸리는 라우트에는 `maxDuration`만 지정한다.
- **Tailwind CSS 4는 PostCSS가 아니라 Turbopack 로더(`@tailwindcss/turbopack`)로 처리한다.** 설정은 `next.config.ts`의 `turbopack.rules`에 있고, `postcss.config` 파일은 없다.
- 경로 별칭: `@/*` → `src/*`
- 주요 라이브러리: `@clerk/nextjs` 7, `drizzle-orm` + `@neondatabase/serverless`, `@anthropic-ai/sdk` 1.x, `@modelcontextprotocol/sdk`, `zod` 4, `rss-parser`.

## 아키텍처 핵심 (PRD 요약)

- **데이터 범위:** `articles`는 모든 사용자 공용이다. 번역·요약은 URL당 한 번만 하고 공유한다. `categories`, `user_articles`, `notion_connections`는 사용자별이며, 모든 조회와 변경은 Clerk `userId`로 제한한다. 미분류는 `user_articles.categoryId = null`로 표현하고, 카테고리를 삭제하면 이 값을 null로 바꾼다.
- **수집은 배치를 반복 호출한다:** 서버는 한 번 호출에 새 기사를 약 5건씩 처리하고 남은 건수를 돌려준다. 클라이언트는 남은 건이 0이 될 때까지 다시 호출하며 진행률을 표시한다. Vercel 실행 시간 제한 때문이다. 피드 하나가 실패해도 나머지는 계속 처리하고 실패한 피드를 알린다. 피드 목록은 설정 파일로 분리한다.
- **Claude 호출:** `client.messages.parse`와 Zod 스키마로 `titleKo`, `summaryKo`, `category`를 받는다. category는 사용자 카테고리 이름 또는 '미분류'로 제한한다. 모델은 `ANTHROPIC_MODEL` 환경변수로 바꿀 수 있고 기본값은 `claude-opus-5-5`다. 이미 번역된 기사는 분류만 한다. `stop_reason === "refusal"`이거나 실패한 기사는 저장하지 않고 다음 수집 때 다시 시도한다.
- **노션:** 호스팅 MCP 서버(`https://mcp.notion.com/mcp`)를 사용하며 사용자별 OAuth 2.1이 필수다. 동적 클라이언트 등록, PKCE S256, state 쿠키를 쓴다. 토큰은 `TOKEN_ENCRYPTION_KEY`로 암호화해 서버에만 저장한다. 갱신은 연결별로 직렬화하고, 갱신할 때마다 받은 새 refresh token을 원자적으로 저장한다. `invalid_grant`이면 재시도하지 않고 토큰을 지운 뒤 재연결을 안내한다. 저장은 `StreamableHTTPClientTransport`로 `notion-create-pages`를 호출하고, 반환된 ID를 `user_articles.notionPageId`에 넣어 중복 저장을 막는다.
- **신규 사용자:** 첫 접속 때 기본 카테고리(시장 동향, 기업 실적, 경제 지표, 연준·금리, 기술주)를 만든다. '미분류'는 실제 카테고리 행이 아니라 null로 표현한다.
- **환경변수:** PRD 8절 참고 (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `TOKEN_ENCRYPTION_KEY`, `APP_URL`). `.env*` 파일은 gitignore 대상이다.

## 뉴스 소스

| 출처 | 피드 URL |
|---|---|
| Bloomberg Markets | `https://feeds.bloomberg.com/markets/news.rss` |
| Reuters (Google News 경유) | `https://news.google.com/rss/search?q=when:24h+site:reuters.com&ceid=US:en&hl=en-US&gl=US` |

- 기사 본문은 스크래핑하지 않는다. RSS의 제목과 설명만 요약한다.
- Reuters는 공식 RSS가 없어서 Google News를 경유한다. 이 피드의 링크는 Google 리디렉션 URL이라 중복 판정 키(`articles.url`)로 쓸 때 주의한다. 설명이 빈약할 수 있다.
- Google News 피드는 개인적·비상업적 용도로만 허용된다(PRD 11절 미결 사항). 공개 운영 전에 소스를 결정해야 하므로, 피드를 설정 파일만 바꿔 교체할 수 있게 유지한다.

## 화면과 라우트

| 경로 | 내용 |
|---|---|
| `/sign-in`, `/sign-up` | Clerk 로그인·회원가입. 이 두 경로를 뺀 모든 경로는 `proxy.ts`에서 로그인을 요구한다. |
| `/` | '뉴스 가져오기' 버튼, 진행률, 노션 연결 상태, 카테고리 탭(전체 / 각 카테고리 / 미분류), 뉴스 카드 그리드 |
| `/categories` | 카테고리 추가·이름 수정·삭제 |
| `/api/notion/connect`, `/api/notion/callback` | 노션 OAuth 시작과 콜백 |

- 뉴스 카드에는 한국어 제목, 한국어 요약, 출처(Bloomberg/Reuters), 발행 시각, 카테고리, 원문 링크, 'notion 저장' 버튼을 넣는다. 이미 저장한 카드는 '저장됨'으로 표시한다.
- 노션 페이지에는 제목, 요약, 출처, 원문 링크, 카테고리를 넣는다. 부모를 지정하지 않으므로 개인 페이지로 생성된다.

## 범위 밖 (구현하지 않음)

자동·예약 수집, 기사 본문 스크래핑, 뉴스 검색, 알림, 모바일 앱, 노션 저장 위치 선택.

## 완료 검증 기준 (PRD 13절)

- `npm run build`와 타입 검사가 통과한다.
- 두 사용자로 로그인했을 때 카테고리와 뉴스 목록이 서로 분리된다.
- 뉴스 가져오기를 다시 눌러도 중복 기사나 재번역이 생기지 않는다.
- 카테고리를 추가·수정·삭제한 뒤에도 필터와 미분류 처리가 맞게 동작한다.
- 실제 노션 계정으로 연결과 저장이 되고, 연결이 만료되면 재연결 안내가 나온다.

## 저장소 환경

- Windows, D: 드라이브(파일 소유자를 기록하지 않는 파일 시스템이라 git `safe.directory` 예외가 전역 설정에 등록되어 있다). 기본 브랜치는 `master`다.
