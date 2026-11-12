"use server";

import { auth } from "@clerk/nextjs/server";
import { refresh } from "next/cache";
import { z } from "zod";
import {
  countPendingArticles,
  ensureDefaultCategories,
  getPendingArticles,
  getUserCategories,
  saveArticleResult,
  saveFetchedArticles,
  type PendingArticle,
} from "@/db/queries";
import { classifyOnly, translateAndClassify } from "@/lib/ai/process-article";
import { FEEDS } from "@/lib/news/feeds";
import { fetchRecentFeedItems } from "@/lib/news/fetch-feeds";

/** 한 번 호출에 Claude로 처리할 기사 수. Vercel 실행 시간 제한(page.tsx의 maxDuration) 안에 끝나도록 작게 둔다. */
const BATCH_SIZE = 5;

export type FetchNewsResult =
  | {
      ok: true;
      /** articles에 새로 들어간 기사 수 */
      added: number;
      /** 이 사용자 목록에 새로 연결된 기사 수(다른 사용자가 먼저 수집한 기사 포함) */
      linked: number;
      failedFeeds: string[];
      /** 번역·분류를 기다리는 기사 수. 0보다 크면 클라이언트가 processNewsBatch를 반복 호출한다. */
      remaining: number;
    }
  | { ok: false; error: string };

export async function fetchNews(): Promise<FetchNewsResult> {
  // proxy.ts의 검사와 별개로 Server Function도 직접 사용자를 확인한다.
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "로그인이 필요합니다." };

  try {
    // 처음 쓰는 사용자는 기사를 저장하기 전에 기본 카테고리를 만들어야 첫 수집부터 분류된다.
    await ensureDefaultCategories(userId);
    const { items, failedFeeds } = await fetchRecentFeedItems();
    if (failedFeeds.length === FEEDS.length) {
      return {
        ok: false,
        error: "뉴스 피드를 읽지 못했습니다. 잠시 후 다시 시도해 주세요.",
      };
    }
    const { added, linked } = await saveFetchedArticles(userId, items);
    const remaining = await countPendingArticles(userId, []);
    refresh();
    return { ok: true, added, linked, failedFeeds, remaining };
  } catch (error) {
    console.error("[fetchNews] 뉴스 수집 실패", error);
    return {
      ok: false,
      error: "뉴스를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
}

export type ProcessBatchResult =
  | {
      ok: true;
      /** 이번 호출에서 번역·분류를 저장한 기사 수 */
      processed: number;
      /** 이번 호출에서 실패한 기사 ID. 클라이언트가 skipIds에 모아 다음 호출에 넘긴다. */
      failedIds: string[];
      /** skipIds와 failedIds를 뺀 남은 대기 건수 */
      remaining: number;
    }
  | { ok: false; error: string };

const skipIdsSchema = z.array(z.uuid()).max(1000);

/**
 * 분류 대기 중인 기사를 최대 BATCH_SIZE건 Claude로 처리한다.
 * - 번역이 없는 기사는 번역·요약·분류를, 이미 번역된 기사(다른 사용자가 처리)는 분류만 한다.
 * - 기사별로 병렬 호출하고, 실패·거절된 기사는 저장하지 않아 다음 수집 때 다시 시도된다.
 * - skipIds는 이번 실행에서 이미 실패한 기사로, 같은 기사를 계속 다시 고르지 않도록 뺀다.
 */
export async function processNewsBatch(
  skipIds: string[],
): Promise<ProcessBatchResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "로그인이 필요합니다." };

  const parsedSkip = skipIdsSchema.safeParse(skipIds);
  if (!parsedSkip.success) return { ok: false, error: "잘못된 요청입니다." };
  const skip = parsedSkip.data;

  try {
    const [userCategories, pending] = await Promise.all([
      getUserCategories(userId),
      getPendingArticles(userId, BATCH_SIZE, skip),
    ]);
    if (pending.length === 0) {
      return { ok: true, processed: 0, failedIds: [], remaining: 0 };
    }

    const categoryNames = userCategories.map((c) => c.name);
    // Claude가 고른 이름을 이 사용자의 카테고리 ID로 바꾼다. '미분류'나 목록에 없는 이름은 null이다.
    const categoryIdByName = new Map(
      userCategories.map((c) => [c.name, c.id]),
    );

    const results = await Promise.allSettled(
      pending.map((article) =>
        processArticle(userId, article, categoryNames, categoryIdByName),
      ),
    );

    const failedIds: string[] = [];
    results.forEach((result, i) => {
      if (result.status === "rejected") {
        failedIds.push(pending[i].id);
        console.error(
          `[processNewsBatch] 기사 처리 실패 ${pending[i].id}`,
          result.reason,
        );
      }
    });
    const processed = pending.length - failedIds.length;

    const remaining = await countPendingArticles(userId, [
      ...skip,
      ...failedIds,
    ]);
    if (processed > 0) refresh();
    return { ok: true, processed, failedIds, remaining };
  } catch (error) {
    console.error("[processNewsBatch] 배치 처리 실패", error);
    return {
      ok: false,
      error: "뉴스를 번역·분류하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
}

async function processArticle(
  userId: string,
  article: PendingArticle,
  categoryNames: string[],
  categoryIdByName: Map<string, string>,
) {
  if (article.titleKo && article.summaryKo) {
    const { category } = await classifyOnly(article, categoryNames);
    await saveArticleResult(userId, article.id, {
      categoryId: categoryIdByName.get(category) ?? null,
    });
    return;
  }

  const { titleKo, summaryKo, category } = await translateAndClassify(
    article,
    categoryNames,
  );
  await saveArticleResult(userId, article.id, {
    translation: { titleKo, summaryKo },
    categoryId: categoryIdByName.get(category) ?? null,
  });
}
