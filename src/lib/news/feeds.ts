/**
 * 수집할 RSS 피드 목록. 소스를 바꿀 때는 이 파일만 고친다.
 * source는 articles.source에 그대로 저장되고 카드에 출처로 표시된다.
 */
export type FeedConfig = {
  source: string;
  url: string;
  /**
   * pubDate가 시간대 없이 오는 피드('2026-11-10 13:44:35')는 UTC로 해석한다.
   * 지정하지 않으면 실행 환경의 로컬 시간으로 해석돼 개발 PC(한국 시간)와 Vercel(UTC)의 결과가 달라진다.
   */
  naiveDateIsUtc?: boolean;
};

export const FEEDS: FeedConfig[] = [
  {
    source: "Bloomberg",
    // feeds.bloomberg.com은 bloomberg.com/feeds/...로 리디렉션된다.
    url: "https://feeds.bloomberg.com/markets/news.rss",
  },
  {
    source: "WSJ",
    // 예전 주소(feeds.a.dj.com)는 2025년 1월 이후 갱신이 멈췄다.
    url: "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain",
  },
  {
    source: "Investing.com",
    // Stock Market News. 항목에 설명(description)이 없다.
    url: "https://www.investing.com/rss/news_25.rss",
    naiveDateIsUtc: true,
  },
];

/** 버튼을 눌렀을 때 가져올 기사의 발행 시각 범위 */
export const FETCH_WINDOW_MS = 24 * 60 * 60 * 1000;
