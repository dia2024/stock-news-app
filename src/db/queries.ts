import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "./index";
import {
  articles,
  categories,
  userArticles,
  userProfiles,
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
            // 분류 전이라 null이다. processNewsBatch가 Claude로 분류하고 채운다.
            // 순서는 schema.ts의 컬럼 정의 순서(notionPageId → classifiedAt → createdAt → deletedAt)와 같아야 한다.
            classifiedAt: sql`null::timestamptz`.as("classified_at"),
            createdAt: sql`now()`.as("created_at"),
            deletedAt: sql`null::timestamptz`.as("deleted_at"),
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

/** 사용자의 카테고리 목록. Claude 분류 선택지와 이름 → id 매핑에 쓴다. */
export async function getUserCategories(userId: string) {
  return db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.createdAt), asc(categories.name));
}

/** 이 사용자의 아직 분류하지 않은 기사 조건. skipIds(이번 실행에서 실패한 기사)는 뺀다. */
function pendingWhere(userId: string, skipIds: string[]): SQL | undefined {
  return and(
    eq(userArticles.userId, userId),
    isNull(userArticles.classifiedAt),
    isNull(userArticles.deletedAt),
    skipIds.length > 0 ? notInArray(userArticles.articleId, skipIds) : undefined,
  );
}

export type PendingArticle = Awaited<
  ReturnType<typeof getPendingArticles>
>[number];

/** 분류 대기 중인 기사를 최신 발행순으로 최대 limit건 고른다. 번역이 이미 있으면 titleKo가 채워져 있다. */
export async function getPendingArticles(
  userId: string,
  limit: number,
  skipIds: string[],
) {
  return db
    .select({
      id: articles.id,
      source: articles.source,
      originalTitle: articles.originalTitle,
      originalDescription: articles.originalDescription,
      titleKo: articles.titleKo,
      summaryKo: articles.summaryKo,
    })
    .from(userArticles)
    .innerJoin(articles, eq(userArticles.articleId, articles.id))
    .where(pendingWhere(userId, skipIds))
    .orderBy(sql`${articles.publishedAt} desc nulls last`, desc(articles.id))
    .limit(limit);
}

/** 분류 대기 중인 기사 수 */
export async function countPendingArticles(userId: string, skipIds: string[]) {
  const [{ total }] = await db
    .select({ total: count() })
    .from(userArticles)
    .where(pendingWhere(userId, skipIds));
  return total;
}

/**
 * Claude 처리 결과를 저장한다. 두 문장을 한 batch로 보내 함께 성공하거나 함께 실패한다.
 * - 번역은 공용 articles에 넣되 title_ko가 아직 null일 때만 쓴다. 다른 사용자가 동시에 번역했으면 그 결과를 그대로 둔다.
 * - categoryId는 호출하는 쪽에서 같은 사용자의 카테고리인지 확인한 값이어야 한다(FK는 소유자를 검사하지 않는다).
 */
export async function saveArticleResult(
  userId: string,
  articleId: string,
  result: {
    translation?: { titleKo: string; summaryKo: string };
    categoryId: string | null;
  },
) {
  const classify = db
    .update(userArticles)
    .set({ categoryId: result.categoryId, classifiedAt: sql`now()` })
    .where(
      and(
        eq(userArticles.userId, userId),
        eq(userArticles.articleId, articleId),
      ),
    );

  if (!result.translation) {
    await classify;
    return;
  }

  await db.batch([
    db
      .update(articles)
      .set(result.translation)
      .where(and(eq(articles.id, articleId), isNull(articles.titleKo))),
    classify,
  ]);
}

export type NewsItem = Awaited<
  ReturnType<typeof getUserNewsPage>
>["items"][number];

/** 대시보드 카테고리 탭의 선택. all = 전체, none = 미분류, 그 밖에는 카테고리 ID */
export type CategoryFilter =
  | { kind: "all" }
  | { kind: "none" }
  | { kind: "category"; id: string };

function categoryWhere(userId: string, filter: CategoryFilter) {
  const mine = and(
    eq(userArticles.userId, userId),
    isNull(userArticles.deletedAt),
  );
  if (filter.kind === "none") return and(mine, isNull(userArticles.categoryId));
  if (filter.kind === "category") {
    return and(mine, eq(userArticles.categoryId, filter.id));
  }
  return mine;
}

/** LIKE 패턴에서 특수 의미가 있는 \, %, _를 글자 그대로 찾도록 이스케이프한다(Postgres 기본 이스케이프 문자는 \). */
function escapeLike(term: string) {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * 검색어 조건. 공백으로 나눈 단어가 모두(AND) 들어 있는 기사를 고른다.
 * 각 단어는 한국어 제목·요약과 원문 제목·설명 중 어디에 있어도 된다(대소문자 무시).
 * 번역 전 기사는 titleKo·summaryKo가 null이라 원문에서만 찾는다.
 */
function keywordWhere(terms: string[]) {
  if (terms.length === 0) return undefined;
  return and(
    ...terms.map((term) => {
      const pattern = `%${escapeLike(term)}%`;
      return or(
        ilike(articles.titleKo, pattern),
        ilike(articles.summaryKo, pattern),
        ilike(articles.originalTitle, pattern),
        ilike(articles.originalDescription, pattern),
      );
    }),
  );
}

/**
 * 사용자의 뉴스 목록 중 한 페이지(page는 1부터)와 조건에 맞는 기사 수를 함께 가져온다.
 * 두 쿼리를 한 batch로 보내 왕복을 한 번으로 줄인다.
 * 미분류(none)에는 아직 분류 전인 기사도 들어간다.
 * keywords가 있으면 그 단어가 모두 들어 있는 기사만 고른다(keywordWhere).
 */
export async function getUserNewsPage(
  userId: string,
  page: number,
  pageSize: number,
  filter: CategoryFilter = { kind: "all" },
  keywords: string[] = [],
) {
  const where = and(categoryWhere(userId, filter), keywordWhere(keywords));
  const [items, [{ total }]] = await db.batch([
    userNewsQuery(userId)
      .where(where)
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    // 검색 조건이 articles 컬럼을 보므로 개수 쿼리도 articles를 붙인다.
    db
      .select({ total: count() })
      .from(userArticles)
      .innerJoin(articles, eq(userArticles.articleId, articles.id))
      .where(where),
  ]);
  return { items, total };
}

/** 신규 사용자에게 만들어 주는 기본 카테고리. 이 순서대로 탭에 나온다. */
export const DEFAULT_CATEGORIES = [
  "시장 동향",
  "기업 실적",
  "경제 지표",
  "연준·금리",
  "기술주",
];

/**
 * 처음 온 사용자에게 기본 카테고리를 만든다.
 * user_profiles에 행을 처음 넣은 요청만 카테고리를 만들므로, 사용자가 나중에 모두 지워도 다시 생기지 않는다.
 * 동시에 여러 번 불려도 user_profiles 기본 키 때문에 한 번만 만든다.
 */
export async function ensureDefaultCategories(userId: string) {
  const created = await db
    .insert(userProfiles)
    .values({ userId })
    .onConflictDoNothing()
    .returning({ userId: userProfiles.userId });
  if (created.length === 0) return;

  // 탭은 생성순으로 정렬하므로 같은 시각이 되지 않게 1ms씩 차이를 둔다.
  const base = Date.now();
  await db
    .insert(categories)
    .values(
      DEFAULT_CATEGORIES.map((name, i) => ({
        userId,
        name,
        createdAt: new Date(base + i),
      })),
    )
    .onConflictDoNothing();
}

/**
 * 카테고리별 기사 수와 함께 사용자의 카테고리 목록(생성순)을 가져온다.
 * 미분류 수와 전체 수도 함께 돌려준다.
 */
export async function getCategoriesWithCounts(userId: string) {
  const [rows, [{ total, uncategorized }]] = await db.batch([
    db
      .select({
        id: categories.id,
        name: categories.name,
        articleCount: count(userArticles.id),
      })
      .from(categories)
      .leftJoin(
        userArticles,
        and(
          eq(userArticles.categoryId, categories.id),
          eq(userArticles.userId, userId),
          isNull(userArticles.deletedAt),
        ),
      )
      .where(eq(categories.userId, userId))
      .groupBy(categories.id)
      .orderBy(asc(categories.createdAt), asc(categories.name)),
    db
      .select({
        total: count(),
        uncategorized: sql<number>`count(*) filter (where ${userArticles.categoryId} is null)`.mapWith(Number),
      })
      .from(userArticles)
      .where(
        and(eq(userArticles.userId, userId), isNull(userArticles.deletedAt)),
      ),
  ]);
  return { categories: rows, total, uncategorized };
}

/**
 * 사용자의 목록에서 기사 한 건을 지운다. 공용 articles 행은 다른 사용자도 쓰므로 그대로 둔다.
 * user_articles 행을 지우면 다음 수집 때 같은 기사가 다시 연결되므로, 행은 남기고 deletedAt만 채운다.
 * 이 사용자의 기사이고 아직 지우지 않았을 때만 바뀌며, 지웠으면 true다.
 */
export async function deleteUserArticle(userId: string, articleId: string) {
  const deleted = await db
    .update(userArticles)
    .set({ deletedAt: sql`now()` })
    .where(
      and(
        eq(userArticles.userId, userId),
        eq(userArticles.articleId, articleId),
        isNull(userArticles.deletedAt),
      ),
    )
    .returning({ id: userArticles.id });
  return deleted.length > 0;
}

/** 같은 사용자에게 이 이름의 카테고리가 있는지(excludeId는 이름을 바꾸는 카테고리 자신) */
async function categoryNameExists(
  userId: string,
  name: string,
  excludeId?: string,
) {
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.name, name)))
    .limit(1);
  return rows.length > 0 && rows[0].id !== excludeId;
}

export type CategoryMutationResult =
  | { ok: true }
  | { ok: false; reason: "duplicate" | "not_found" };

/** 카테고리를 추가한다. 같은 이름이 있으면 duplicate다. */
export async function createCategory(
  userId: string,
  name: string,
): Promise<CategoryMutationResult> {
  const inserted = await db
    .insert(categories)
    .values({ userId, name })
    .onConflictDoNothing()
    .returning({ id: categories.id });
  return inserted.length > 0 ? { ok: true } : { ok: false, reason: "duplicate" };
}

/** 카테고리 이름을 바꾼다. 이 사용자의 카테고리일 때만 바뀐다. */
export async function renameCategory(
  userId: string,
  id: string,
  name: string,
): Promise<CategoryMutationResult> {
  if (await categoryNameExists(userId, name, id)) {
    return { ok: false, reason: "duplicate" };
  }
  const updated = await db
    .update(categories)
    .set({ name })
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning({ id: categories.id });
  return updated.length > 0 ? { ok: true } : { ok: false, reason: "not_found" };
}

/**
 * 카테고리를 삭제한다. 이 사용자의 카테고리일 때만 지운다.
 * 이 카테고리의 기사는 FK(ON DELETE SET NULL)로 미분류가 된다.
 */
export async function deleteCategory(
  userId: string,
  id: string,
): Promise<CategoryMutationResult> {
  const deleted = await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning({ id: categories.id });
  return deleted.length > 0 ? { ok: true } : { ok: false, reason: "not_found" };
}

/**
 * 사용자의 뉴스 목록을 최신 발행순으로 고르는 쿼리.
 * articles는 공용이라 user_articles로 이 사용자의 기사만 고른다(categoryWhere가 userId 조건을 넣는다).
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
    // 조건(사용자·카테고리)은 호출하는 쪽에서 .where()로 붙인다.
    // 발행 시각이 없는 기사는 뒤로 보내고, 그 안에서는 수집 시각순으로 정렬한다.
    // 마지막 id는 같은 시각의 기사들이 페이지마다 같은 순서로 나오게 하는 기준이다.
    .orderBy(
      sql`${articles.publishedAt} desc nulls last`,
      desc(articles.createdAt),
      desc(articles.id),
    )
    .$dynamic();
}
