import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { articles, categories, userArticles } from "./schema";

export type NewsItem = Awaited<ReturnType<typeof getUserNews>>[number];

/**
 * 사용자의 뉴스 목록을 최신 발행순으로 가져온다.
 * articles는 공용이라 user_articles로 이 사용자의 기사만 고른다.
 * 카테고리는 같은 사용자의 것만 붙이고, 없으면 categoryName이 null(미분류)이다.
 */
export async function getUserNews(userId: string) {
  return db
    .select({
      id: articles.id,
      url: articles.url,
      source: articles.source,
      titleKo: articles.titleKo,
      summaryKo: articles.summaryKo,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
      categoryName: categories.name,
      notionPageId: userArticles.notionPageId,
    })
    .from(userArticles)
    .innerJoin(articles, eq(userArticles.articleId, articles.id))
    .leftJoin(
      categories,
      and(
        eq(userArticles.categoryId, categories.id),
        eq(categories.userId, userId),
      ),
    )
    .where(eq(userArticles.userId, userId))
    // 발행 시각이 없는 기사는 뒤로 보내고, 그 안에서는 수집 시각순으로 정렬한다.
    .orderBy(sql`${articles.publishedAt} desc nulls last`, desc(articles.createdAt));
}
