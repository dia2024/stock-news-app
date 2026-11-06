# PRD: 해외 주식 뉴스 수집기 (AI News Collector)

- 작성일: 2026-11-03
- 상태: 초안

## 1. 개요

해외 주식 뉴스를 RSS로 필요할 때마다 수집하고, Claude AI가 한국어로 번역·요약해서 카드 형태로 보여주는 웹 앱이다. 수집한 뉴스는 카테고리별로 자동 분류되며, 원하는 뉴스는 노션에 저장할 수 있다.

### 목표
- 영문 해외 주식 뉴스를 한국어 요약으로 빠르게 훑어본다.
- 관심 주제(카테고리)별로 뉴스를 골라 본다.
- 중요한 뉴스를 노션에 모아 둔다.

### 대상 사용자
여러 명이 사용한다. 각 사용자는 자신의 카테고리, 뉴스 목록, 노션 연결을 따로 가진다.

## 2. 기능 요구사항

### F1. 로그인
- 앱에 들어오면 먼저 로그인해야 한다. 로그인하지 않은 사용자는 어떤 화면도 볼 수 없다.
- Clerk로 회원가입·로그인·로그아웃을 처리한다.

### F2. 뉴스 가져오기
- '뉴스 가져오기' 버튼을 누를 때만 수집한다. 자동·예약 수집은 하지 않는다.
- 등록된 RSS 피드를 읽고, 원문 URL 기준으로 이미 수집한 기사는 건너뛴다.
- 새 기사는 Claude API로 한국어 제목과 요약을 만든다.
- 처리 중에는 진행률을 보여 준다.

### F3. 자동 카테고리 분류
- 가져온 뉴스는 사용자의 카테고리 목록 중 하나로 자동 분류한다.
- 어느 카테고리에도 맞지 않으면 '미분류'로 둔다.

### F4. 카테고리별 보기
- 카테고리를 선택하면 해당 카테고리의 뉴스만 보여 준다.
- '전체'와 '미분류' 보기를 제공한다.

### F5. 카테고리 관리
- 카테고리를 언제든 추가, 이름 수정, 삭제할 수 있다.
- 카테고리를 삭제하면 그 카테고리의 뉴스는 '미분류'로 바뀐다.
- 새 사용자에게는 기본 카테고리를 만들어 준다. 예: 시장 동향, 기업 실적, 경제 지표, 연준·금리, 기술주

### F6. 뉴스 카드
카드에는 다음을 표시한다.
- 한국어 제목
- 한국어 요약
- 출처(Bloomberg, Reuters)와 발행 시각
- 카테고리
- 원문 링크
- 'notion 저장' 버튼

### F7. 노션 저장
- 사용자는 처음 한 번 자기 노션 계정을 연결한다(OAuth).
- 'notion 저장' 버튼을 누르면 해당 뉴스를 노션 페이지로 만든다. 페이지에는 제목, 요약, 출처, 원문 링크, 카테고리를 넣는다.
- 저장된 카드는 '저장됨'으로 표시하고 중복 저장을 막는다.
- 노션 연결이 만료되면 다시 연결하라고 안내한다.

## 3. 뉴스 소스

사용자가 지정한 사이트는 Bloomberg 뉴스레터 페이지(https://www.bloomberg.com/newsletters)와 Reuters(https://www.reuters.com/)이다. 두 주소 모두 RSS 피드가 아닌 일반 웹페이지이므로 아래 피드를 대신 쓴다. 피드 목록은 설정 파일로 분리해 쉽게 바꿀 수 있게 한다.

| 출처 | 피드 URL | 확인 결과 (2026-11-03) |
|---|---|---|
| Bloomberg Markets | `https://feeds.bloomberg.com/markets/news.rss` | 정상 응답. 항목마다 제목과 짧은 설명이 있음 |
| Reuters (Google News 경유) | `https://news.google.com/rss/search?q=when:24h+site:reuters.com&ceid=US:en&hl=en-US&gl=US` | 정상 응답. Reuters는 2020년 6월 공식 RSS를 중단함 |

### 소스 관련 제약
- 본문은 스크래핑하지 않는다. RSS의 제목과 설명만 요약하므로 요약이 짧을 수 있다.
- Google News 피드는 링크가 Google을 거쳐 가고 설명이 빈약할 수 있다.
- **Google News 피드 약관:** 피드에 "개인적·비상업적 피드 리더 용도로만 사용 가능하며 그 외 사용은 금지된다"는 문구가 있다. 여러 사용자가 쓰는 서비스로 운영하면 이 조건에 걸릴 수 있다. 공개 전에 이 피드를 계속 쓸지, 라이선스를 받은 다른 소스로 바꿀지 결정해야 한다.

## 4. 기술 스택

| 영역 | 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, TypeScript, Tailwind CSS) |
| 로그인 | Clerk |
| 데이터베이스 | Neon (Postgres), Drizzle ORM |
| 번역·요약·분류 | Claude API (`@anthropic-ai/sdk`) |
| 노션 저장 | 노션 호스팅 MCP 서버 (`https://mcp.notion.com/mcp`), `@modelcontextprotocol/sdk` |
| RSS 파싱 | `rss-parser` |
| 배포 | Vercel |

### Next.js 16 참고
- `middleware.ts` 대신 `proxy.ts`를 쓴다. Clerk 인증 검사도 여기에 둔다.
- `params`, `searchParams`, `cookies()`, `headers()`는 비동기로만 접근할 수 있다.

## 5. 데이터 모델

| 테이블 | 범위 | 주요 컬럼 |
|---|---|---|
| `articles` | 전체 공용 | id, url(유니크), source, originalTitle, originalDescription, titleKo, summaryKo, publishedAt, createdAt |
| `categories` | 사용자별 | id, userId, name, createdAt (userId+name 유니크) |
| `user_articles` | 사용자별 | id, userId, articleId, categoryId(null = 미분류), notionPageId, createdAt (userId+articleId 유니크) |
| `notion_connections` | 사용자별 | userId, clientId, accessToken(암호화), refreshToken(암호화), expiresAt, workspaceName, createdAt, updatedAt |

- 번역·요약은 기사당 한 번만 해서 모든 사용자가 공유한다.
- 분류는 사용자마다 자기 카테고리 기준으로 따로 한다.
- 카테고리를 삭제하면 `user_articles.categoryId`를 null로 바꾼다.

## 6. 처리 흐름

### 뉴스 가져오기
1. 사용자가 버튼을 누른다.
2. 서버가 피드를 읽고 아직 저장되지 않은 URL만 고른다.
3. 새 기사를 소량(예: 5건)씩 Claude API로 보내 한국어 제목·요약과 분류 결과를 받는다.
4. 다른 사용자가 이미 번역한 기사는 번역 없이 분류만 한다.
5. 결과를 저장하고 남은 건수를 돌려준다.
6. 클라이언트는 남은 건이 없을 때까지 다시 호출하며 진행률을 표시한다.

이렇게 나누는 이유는 Vercel 함수 실행 시간 제한에 걸리지 않기 위해서다. 라우트에 `maxDuration`을 지정한다.

### Claude API 사용
- 구조화된 출력(`client.messages.parse` + Zod 스키마)으로 `titleKo`, `summaryKo`, `category`를 받는다.
- 카테고리 값은 사용자의 카테고리 이름 목록 또는 '미분류' 중 하나로 제한한다.
- 기본 모델은 `claude-opus-5-5`로 하고, 환경변수(`ANTHROPIC_MODEL`)로 바꿀 수 있게 한다.
- `stop_reason`이 `refusal`이거나 실패한 기사는 건너뛰고 다음 수집 때 다시 시도한다.

### 노션 연결 (OAuth 2.1)
노션 MCP는 토큰 방식 인증을 지원하지 않으므로 사용자별 OAuth가 필수다.
1. 메타데이터 탐색: `/.well-known/oauth-protected-resource`에 이어 `/.well-known/oauth-authorization-server`
2. 동적 클라이언트 등록: `token_endpoint_auth_method: none`, grant는 `authorization_code`와 `refresh_token`. 발급된 `client_id`는 저장해서 재사용한다.
3. PKCE(S256)와 `state`로 인가 요청을 보낸다. verifier와 state는 약 10분짜리 보안 쿠키에 보관한다.
4. 콜백에서 서버가 토큰을 교환하고 암호화해 저장한다. 첫 교환 때 받는 워크스페이스 정보도 함께 저장한다.

### 토큰 관리
- 액세스 토큰은 약 8시간 유효하며 만료 5~10분 전에 갱신한다. 갱신할 때마다 새 refresh token을 원자적으로 저장한다.
- refresh token은 첫 인가 후 180일, 또는 30일간 갱신이 없으면 만료된다.
- 갱신 응답이 `invalid_grant`면 토큰을 지우고 재연결을 안내한다. 재시도하지 않는다.
- 같은 연결에 대한 갱신이 동시에 일어나지 않도록 직렬화한다.

### 노션 저장
1. 서버가 MCP TypeScript SDK의 `StreamableHTTPClientTransport`로 Bearer 토큰을 붙여 접속한다.
2. `notion-create-pages` 도구를 호출한다. 부모를 지정하지 않으면 개인 페이지로 생성된다.
3. 반환된 페이지 ID를 `user_articles.notionPageId`에 저장한다.

## 7. 화면 구성

| 경로 | 내용 |
|---|---|
| `/sign-in`, `/sign-up` | Clerk 로그인·회원가입 |
| `/` | 상단: '뉴스 가져오기' 버튼, 진행률, 노션 연결 상태. 카테고리 탭(전체/각 카테고리/미분류). 뉴스 카드 그리드 |
| `/categories` | 카테고리 목록과 추가·수정·삭제 |
| `/api/notion/connect`, `/api/notion/callback` | 노션 OAuth 시작과 콜백 |

## 8. 환경변수

| 이름 | 용도 |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk |
| `DATABASE_URL` | Neon 연결 문자열 |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Claude API |
| `TOKEN_ENCRYPTION_KEY` | 노션 토큰 암호화 키(32바이트) |
| `APP_URL` | OAuth 리디렉션 URI 생성용 |

## 9. 비기능 요구사항
- **보안:** 모든 데이터 조회와 변경은 로그인한 사용자의 `userId`로 제한한다. 노션 토큰은 서버에만 두고 암호화해 저장한다.
- **비용:** 이미 번역한 기사는 다시 번역하지 않는다.
- **안정성:** 피드 하나가 실패해도 나머지 피드는 계속 처리하고, 실패한 피드를 화면에 알린다.

## 10. 범위 밖
- 자동·예약 수집
- 기사 본문 스크래핑
- 뉴스 검색, 알림, 모바일 앱
- 노션 저장 위치(특정 페이지나 데이터베이스) 선택. 1차 버전은 개인 페이지로 저장한다.

## 11. 위험과 미결 사항
1. **Google News 피드 약관:** 비상업적 개인 용도로만 허용된다. 공개 운영 전에 결정이 필요하다.
2. **뉴스 재배포 저작권:** 여러 사용자에게 번역·요약본을 보여 주는 것이 Bloomberg와 Reuters 약관에 걸릴 수 있어 공개 전에 검토해야 한다.
3. **노션 MCP 재인증:** refresh token 만료(최대 180일) 때문에 사용자가 주기적으로 다시 연결해야 할 수 있다.
4. **요약 품질:** RSS 설명만으로 요약하므로 내용이 얕을 수 있다.

## 12. 구현 순서
1. Clerk 로그인과 `proxy.ts` 보호 설정
2. Neon·Drizzle 스키마와 마이그레이션
3. 카테고리 CRUD
4. RSS 수집, Claude 처리, 배치 반복
5. 뉴스 카드 목록과 카테고리 필터
6. 노션 OAuth 연결과 MCP 저장
7. Vercel 배포와 환경변수 설정

## 13. 검증 기준
- `npm run build`와 타입 검사가 통과한다.
- 두 사용자로 로그인했을 때 카테고리와 뉴스 목록이 서로 분리된다.
- 뉴스 가져오기를 다시 눌러도 중복 기사나 재번역이 생기지 않는다.
- 카테고리를 추가·수정·삭제한 뒤 필터와 미분류 처리가 맞게 동작한다.
- 실제 노션 계정으로 연결과 저장이 되고, 만료 시 재연결 안내가 나온다.
- Vercel 배포본에서 전체 흐름이 동작한다.

## 14. 현재 진행 상황
- Next.js 16 프로젝트 생성 완료
- 필요한 패키지 설치 완료: Clerk, Drizzle, Neon, Anthropic SDK, MCP SDK, Zod, rss-parser
- 앱 코드는 아직 작성하지 않음
