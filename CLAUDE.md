# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## 프로젝트

해외 주식 뉴스 RSS를 버튼으로 수집하고, Claude API로 한국어 제목·요약·카테고리 분류를 만들어 카드로 보여 주는 다중 사용자 웹 앱이다. 원하는 뉴스는 사용자의 노션에 저장한다. 요구사항, 데이터 모델, 처리 흐름, 구현 순서, 검증 기준은 모두 `PRD.md`에 있으니 기능 작업 전에 해당 절을 먼저 읽는다. 화면을 만들거나 고칠 때는 `ui.md`(UI 가이드: 색·글꼴 토큰, 레이아웃, 카테고리 탭, 뉴스 카드, 상태 화면, 문구 규칙)를 먼저 읽고 따른다.

현재 상태: PRD 12절 1단계(Clerk)와 2단계(DB 스키마) 완료. 4단계 중 RSS 수집·저장만 완료(Claude 번역·분류, 배치 반복은 아직 없음). 구현은 PRD 12절 순서(Clerk → Drizzle 스키마 → 카테고리 CRUD → RSS·Claude 수집 → 카드 목록 → 노션 OAuth·MCP → Vercel)로 진행한다.

## 명령어

- `npm run dev` — 개발 서버 (http://localhost:3000)
- `npm run build` — 프로덕션 빌드와 타입 검사. PRD의 기본 검증 기준이다.
- `npm run lint` — ESLint (flat config, `eslint-config-next`의 core-web-vitals + typescript)
- 테스트 러너는 아직 없다.
- `npm run db:generate -- --name <이름>` — `src/db/schema.ts` 변경으로 `drizzle/`에 마이그레이션 SQL 생성
- `npm run db:migrate` — 마이그레이션을 `DATABASE_URL`의 Neon DB에 적용 (`drizzle.config.ts`가 `.env.local`을 읽는다)
- `npm run db:studio` — 브라우저로 DB 보기
- `npm run db:seed -- <Clerk userId>` — 개발용 예제 기사 5건과 기본 카테고리를 넣는다(`scripts/seed.ts`, 재실행해도 중복 없음). 예제 기사 URL은 `https://example.com/sample/`로 시작한다.
- 스키마는 생성된 마이그레이션 파일로만 바꾼다. 이미 적용된 `drizzle/*.sql`은 고치지 않는다.

## 데이터베이스

- `src/db/index.ts`의 `db`는 Neon **HTTP** 드라이버(`drizzle-orm/neon-http`)다. `db.transaction()`은 지원하지 않으니 여러 쿼리는 `db.batch()`로 묶거나 단일 SQL 문으로 처리한다. `server-only`라 서버 코드에서만 import한다.
- `casing: "snake_case"`가 `drizzle.config.ts`와 `src/db/index.ts` 양쪽에 있다. 스키마에는 컬럼 이름을 적지 않고 camelCase 필드만 쓴다.
- `userId` 컬럼은 Clerk 사용자 ID이며 FK가 없다. `user_articles.categoryId`는 `ON DELETE SET NULL`이라 카테고리를 삭제하면 미분류가 된다. 다만 FK는 카테고리 소유자를 검사하지 않으므로, 분류를 저장할 때 같은 사용자의 카테고리인지 코드에서 확인한다.
- `articles`에는 수집 때 원문만 넣고 `titleKo`·`summaryKo`는 null로 둔다(마이그레이션 0001). null은 '아직 번역 안 됨'이며, Claude 단계가 이 기사들을 골라 채운다. 카드는 번역이 없으면 임시로 원문 제목과 원문 설명(`originalDescription`)을 보여 준다. 원문을 `summaryKo`에 넣지 않는다.
- `notion_connections`는 사용자당 한 행이다. `clientId`는 토큰보다 먼저 저장되고, 연결이 끊겨도 토큰 컬럼만 null로 지운다.

## 스택과 설정상 주의점

- **Next.js 16.4 / React 19.3.** 학습 데이터와 API가 다르다. 코드를 쓰기 전에 `node_modules/next/dist/docs/`에서 해당 문서를 확인한다.
  - 인증 검사는 `middleware.ts`가 아니라 `src/proxy.ts`에 둔다.
  - `params`, `searchParams`, `cookies()`, `headers()`는 비동기로만 접근한다.
  - 페이지와 레이아웃 props에는 전역 타입 `PageProps<"/경로">`, `LayoutProps<"/경로">`를 쓴다.
- **`next.config.ts`에 `cacheComponents: true`와 `partialPrefetching: true`가 켜져 있다.** 데이터 조회는 기본적으로 동적이고, 캐시는 `use cache`로 명시한다. 라우트에 `export const runtime`을 두면 안 된다(Cache Components는 Node.js 런타임 전용). 오래 걸리는 라우트에는 `maxDuration`만 지정한다.
- **Tailwind CSS 4는 PostCSS가 아니라 Turbopack 로더(`@tailwindcss/turbopack`)로 처리한다.** 설정은 `next.config.ts`의 `turbopack.rules`에 있고, `postcss.config` 파일은 없다.
- **Clerk 7 (Core 3).** 학습 데이터와 API가 다르다.
  - `<SignedIn>`, `<SignedOut>`, `<Protect>`는 제거되었다. `<Show when="signed-in">`을 쓴다.
  - `createRouteMatcher`는 deprecated다. `src/proxy.ts`는 경로를 직접 비교해 1차로 막을 뿐이고, 데이터를 다루는 페이지·API·Server Function은 각자 `auth()`로 `userId`를 다시 확인한다.
  - 경로를 읽는 Clerk 컴포넌트(`<SignIn>`, `<SignUp>` 등)는 Cache Components 때문에 `<Suspense>`로 감싸야 빌드된다.
  - UI는 `@clerk/localizations`의 `koKR`로 한국어를 쓴다.
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
| Bloomberg Markets | `https://feeds.bloomberg.com/markets/news.rss` (bloomberg.com/feeds/...로 리디렉션) |
| WSJ Markets | `https://feeds.content.dowjones.io/public/rss/RSSMarketsMain` (예전 `feeds.a.dj.com`은 2025-01 이후 갱신 중단) |
| Investing.com Stock Market News | `https://www.investing.com/rss/news_25.rss` |

- 피드 목록은 `src/lib/news/feeds.ts`, 읽기·파싱은 `src/lib/news/fetch-feeds.ts`, 저장은 `src/db/queries.ts`의 `saveFetchedArticles`, 버튼은 `src/app/dashboard/`의 `fetchNews` Server Function과 `FetchNewsToolbar`다.
- 수집 범위는 발행 후 24시간 이내다. 발행 시각·링크·제목이 없는 기사는 건너뛴다.
- 중복 판정 키는 `normalizeUrl`(fetch-feeds.ts)로 정규화한 URL이다. https로 통일하고 `#` 이후, 추적 파라미터(`utm_*`, WSJ의 `mod` 등), 경로 끝 `/`를 지우며 남은 파라미터는 정렬한다. 한 번의 수집 안에서도, DB(`articles.url` 유니크·`ON CONFLICT DO NOTHING`)에서도 이 키로 중복을 막는다. 규칙을 바꾸면 기존 행의 키와 어긋나 중복이 생길 수 있으니 기존 URL에 적용해 보고 바꾼다.
- Investing.com은 설명이 없고 `pubDate`가 시간대 없이(`2026-11-10 13:44:35`, UTC) 와서 `naiveDateIsUtc`로 처리한다.
- 기사 본문은 스크래핑하지 않는다. RSS의 제목과 설명만 요약한다.
- WSJ·Investing.com 피드의 상업적 이용 조건은 공개 운영 전에 확인한다(PRD 11절).

## 화면과 라우트

| 경로 | 내용 |
|---|---|
| `/sign-in`, `/sign-up` | Clerk 로그인·회원가입. 이 두 경로를 뺀 모든 경로는 `proxy.ts`에서 로그인을 요구한다. |
| `/` | '뉴스 가져오기' 버튼, 진행률, 노션 연결 상태, 카테고리 탭(전체 / 각 카테고리 / 미분류), 뉴스 카드 그리드 |
| `/categories` | 카테고리 추가·이름 수정·삭제 |
| `/api/notion/connect`, `/api/notion/callback` | 노션 OAuth 시작과 콜백 |

- 뉴스 카드에는 한국어 제목, 한국어 요약, 출처(Bloomberg/WSJ/Investing.com), 발행 시각, 카테고리, 원문 링크, 'notion 저장' 버튼을 넣는다. 이미 저장한 카드는 '저장됨'으로 표시한다.
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

- Windows, `C:\ai-news-collector`(NTFS). 기본 브랜치는 `main`이다.
