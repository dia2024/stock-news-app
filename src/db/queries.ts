import "server-only";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./index";
import {
  articles,
  categories,
  userArticles,
  type NewArticle,
} from "./schema";

type FetchedArticle = Pick<
  NewArticle,
  "url" | "source" | "originalTitle" | "originalDescription" | "publishedAt"
>;

/**
 * 피드에서 읽은 기사를 저장하고 이 사용자의 목록에 연결한다.
 * - articles는 공용이라 URL이 이미 있으면 그대로 두고(다른 사용자가 수집했거나 번역까지 끝났을 수 있다) 새 URL만 넣는다.
 * - 이미 있던 기사도 이 사용자의 user_articles에 없으면 연결한다. 분류 전이라 categoryId는 null(미분류)이다.
 * 두 문장을 한 batch로 보내 함께 성공하거나 함께 실패한다.
 */
export async function saveFetchedArticles(
  userId: string,
  items: FetchedArticle[],
) {
  if (items.length === 0) return { added: 0, linked: 0 };

  const urls = items.map((item) => item.url);

  const [added, linked] = await db.batch([
    db
      .insert(articles)
      .values(items)
      .onConflictDoNothing({ target: articles.url })
      .returning({ id: articles.id }),
    // insert ... select는 테이블의 모든 컬럼을 정의 순서대로 골라야 한다.
    db
      .insert(userArticles)
      .select(
        db
          .select({
            id: sql`gen_random_uuid()`.as("id"),
            userId: sql`${userId}`.as("user_id"),
            articleId: articles.id,
            categoryId: sql`null::uuid`.as("category_id"),
            notionPageId: sql`null::text`.as("notion_page_id"),
            createdAt: sql`now()`.as("created_at"),
          })
          .from(articles)
          .where(inArray(articles.url, urls)),
      )
      .onConflictDoNothing({
        target: [userArticles.userId, userArticles.articleId],
      })
      .returning({ id: userArticles.id }),
  ]);

  return { added: added.length, linked: linked.length };
}

export type NewsItem = Awaited<
  ReturnType<typeof getUserNewsPage>
>["items"][number];

/**
 * 사용자의 뉴스 목록 중 한 페이지(page는 1부터)와 전체 기사 수를 함께 가져온다.
 * 두 쿼리를 한 batch로 보내 왕복을 한 번으로 줄인다.
 */
export async function getUserNewsPage(
  userId: string,
  page: number,
  pageSize: number,
) {
  const [items, [{ total }]] = await db.batch([
    userNewsQuery(userId)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: count() })
      .from(userArticles)
      .where(eq(userArticles.userId, userId)),
  ]);
  return { items, total };
}

/**
 * 사용자의 뉴스 목록을 최신 발행순으로 고르는 쿼리.
 * articles는 공용이라 user_articles로 이 사용자의 기사만 고른다.
 * 카테고리는 같은 사용자의 것만 붙이고, 없으면 categoryName이 null(미분류)이다.
 */
function userNewsQuery(userId: string) {
  return db
    .select({
      id: articles.id,
      url: articles.url,
      source: articles.source,
      originalTitle: articles.originalTitle,
      originalDescription: articles.originalDescription,
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
    // 마지막 id는 같은 시각의 기사들이 페이지마다 같은 순서로 나오게 하는 기준이다.
    .orderBy(
      sql`${articles.publishedAt} desc nulls last`,
      desc(articles.createdAt),
      desc(articles.id),
    )
    .$dynamic();
}
