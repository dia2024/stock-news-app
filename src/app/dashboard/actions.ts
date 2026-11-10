"use server";

import { auth } from "@clerk/nextjs/server";
import { refresh } from "next/cache";
import { saveFetchedArticles } from "@/db/queries";
import { FEEDS } from "@/lib/news/feeds";
import { fetchRecentFeedItems } from "@/lib/news/fetch-feeds";

export type FetchNewsResult =
  | {
      ok: true;
      /** articles에 새로 들어간 기사 수 */
      added: number;
      /** 이 사용자 목록에 새로 연결된 기사 수(다른 사용자가 먼저 수집한 기사 포함) */
      linked: number;
      failedFeeds: string[];
      /**
       * 남은 처리 건수. 지금은 한 번에 끝나 항상 0이다.
       * Claude 번역·분류를 붙이면 배치로 나눠 처리하고, 클라이언트는 0이 될 때까지 다시 호출한다.
       */
      remaining: number;
    }
  | { ok: false; error: string };

export async function fetchNews(): Promise<FetchNewsResult> {
  // proxy.ts의 검사와 별개로 Server Function도 직접 사용자를 확인한다.
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "로그인이 필요합니다." };

  try {
    const { items, failedFeeds } = await fetchRecentFeedItems();
    if (failedFeeds.length === FEEDS.length) {
      return {
        ok: false,
        error: "뉴스 피드를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.",
      };
    }
    const { added, linked } = await saveFetchedArticles(userId, items);
    refresh();
    return { ok: true, added, linked, failedFeeds, remaining: 0 };
  } catch (error) {
    console.error("[fetchNews] 뉴스 수집 실패", error);
    return {
      ok: false,
      error: "뉴스를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
}
