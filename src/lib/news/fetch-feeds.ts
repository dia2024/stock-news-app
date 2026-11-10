import "server-only";
import Parser from "rss-parser";
import { FEEDS, FETCH_WINDOW_MS, type FeedConfig } from "./feeds";

export type FeedItem = {
  url: string;
  source: string;
  originalTitle: string;
  originalDescription: string | null;
  publishedAt: Date;
};

export type FetchFeedsResult = {
  items: FeedItem[];
  /** 읽지 못한 피드의 source 이름 */
  failedFeeds: string[];
};

const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "Mozilla/5.0 (compatible; StockNewsCollector/1.0)";

// 같은 기사인데 유입 경로만 다른 링크가 중복 저장되지 않도록 지우는 쿼리 파라미터
// (WSJ의 mod, 광고·소셜 유입 표시 등). 기사 식별에 쓰일 수 있는 다른 파라미터는 남긴다.
const TRACKING_PARAMS = /^(utm_.+|mod|cmpid|fbclid|gclid|ref|src|srnd|leadsource)$/i;

const parser = new Parser();

/**
 * 모든 피드를 동시에 읽어 지난 24시간 안에 발행된 기사만 돌려준다.
 * 피드 하나가 실패해도 나머지 결과는 그대로 돌려주고, 실패한 피드는 failedFeeds에 담는다.
 */
export async function fetchRecentFeedItems(
  now = Date.now(),
): Promise<FetchFeedsResult> {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const since = now - FETCH_WINDOW_MS;

  const items = new Map<string, FeedItem>();
  const failedFeeds: string[] = [];

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`[feeds] ${FEEDS[i].source} 피드를 읽지 못했습니다`, result.reason);
      failedFeeds.push(FEEDS[i].source);
      return;
    }
    for (const item of result.value) {
      const time = item.publishedAt.getTime();
      if (time < since || time > now + 60 * 60 * 1000) continue;
      // 여러 피드에 같은 기사가 있으면 먼저 읽은 것을 쓴다.
      if (!items.has(item.url)) items.set(item.url, item);
    }
  });

  return { items: [...items.values()], failedFeeds };
}

async function fetchFeed(feed: FeedConfig): Promise<FeedItem[]> {
  const res = await fetch(feed.url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
    },
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const parsed = await parser.parseString(await res.text());

  const items: FeedItem[] = [];
  for (const entry of parsed.items) {
    const url = normalizeUrl(entry.link);
    const title = entry.title?.trim();
    const publishedAt = parseDate(entry.pubDate, feed.naiveDateIsUtc);
    // 링크·제목·발행 시각 중 하나라도 없으면 24시간 안의 기사인지, 무엇인지 알 수 없어 건너뛴다.
    if (!url || !title || !publishedAt) continue;

    items.push({
      url,
      source: feed.source,
      originalTitle: title,
      originalDescription: entry.contentSnippet?.trim() || null,
      publishedAt,
    });
  }
  return items;
}

/**
 * articles.url은 중복 판정 키라서, 같은 기사를 가리키는 링크가 같은 문자열이 되도록 맞춘다.
 * http→https, 호스트 소문자(URL이 처리), #이후·추적 파라미터 제거, 경로 끝 '/' 제거, 남은 파라미터 정렬.
 */
export function normalizeUrl(link: string | undefined): string | null {
  if (!link) return null;
  try {
    const url = new URL(link.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.protocol = "https:";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    return url.toString();
  } catch {
    return null;
  }
}

const NAIVE_DATE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/;

function parseDate(value: string | undefined, naiveIsUtc = false): Date | null {
  if (!value) return null;
  const text = value.trim();
  const naive = naiveIsUtc ? NAIVE_DATE.exec(text) : null;
  const date = new Date(naive ? `${naive[1]}T${naive[2]}Z` : text);
  return Number.isNaN(date.getTime()) ? null : date;
}
