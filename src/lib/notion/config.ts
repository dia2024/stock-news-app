/** 노션 호스팅 MCP 서버 */
export const NOTION_MCP_URL = "https://mcp.notion.com/mcp";

/** OAuth 리디렉션 URI. 동적 클라이언트 등록과 인가 요청, 토큰 교환에 같은 값을 써야 한다. */
export function notionRedirectUri() {
  const appUrl = process.env.APP_URL;
  if (!appUrl) throw new Error("APP_URL 환경변수가 설정되지 않았습니다.");
  return new URL("/api/notion/callback", appUrl).toString();
}

/** PKCE verifier와 state를 담는 쿠키(약 10분) */
export const OAUTH_COOKIE = "notion_oauth";
export const OAUTH_COOKIE_MAX_AGE = 10 * 60;

/** 앱이 사용자별로 만드는 노션 데이터베이스 이름 */
export const NOTION_DATABASE_TITLE = "해외 주식 뉴스";

/**
 * 데이터베이스 속성 이름(PRD 6절 '노션 데이터베이스').
 * 데이터베이스를 만들 때와 행을 추가할 때 같은 이름을 써야 하므로 여기서만 정의한다.
 */
export const NOTION_PROPS = {
  title: "제목",
  summary: "요약",
  source: "출처",
  category: "카테고리",
  url: "원문 링크",
  publishedAt: "발행일",
  savedAt: "저장일",
} as const;

/** 출처 선택지. 피드 설정(src/lib/news/feeds.ts)의 source 값과 같다. */
export const NOTION_SOURCE_OPTIONS = ["Bloomberg", "WSJ", "Investing.com"];
