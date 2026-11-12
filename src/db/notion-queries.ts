import "server-only";
import { and, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "./index";
import { articles, categories, notionConnections, userArticles } from "./schema";

// 노션 연결(notion_connections)과 노션 저장 관련 쿼리. 모든 쿼리는 userId로 제한한다.
// Neon HTTP 드라이버라 세션 잠금·트랜잭션을 쓸 수 없어, 직렬화는 *_lock_until 컬럼을 조건부 UPDATE로 잡는다.

export async function getNotionConnection(userId: string) {
  const [row] = await db
    .select()
    .from(notionConnections)
    .where(eq(notionConnections.userId, userId))
    .limit(1);
  return row;
}

/** 동적 등록으로 받은 clientId를 저장한다. 이미 행이 있으면 clientId만 바꾼다(토큰은 그 clientId에 묶이므로 비운다). */
export async function saveNotionClientId(userId: string, clientId: string) {
  await db
    .insert(notionConnections)
    .values({ userId, clientId })
    .onConflictDoUpdate({
      target: notionConnections.userId,
      set: {
        clientId,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
      },
    });
}

/**
 * OAuth 콜백에서 받은 토큰(암호화된 값)을 저장한다.
 * 다른 워크스페이스로 다시 연결했으면 이전 데이터베이스는 쓸 수 없으므로 databaseId를 비운다.
 * 워크스페이스 ID를 알 수 없으면 그대로 두고, 저장 때 데이터베이스를 못 찾으면 새로 만든다.
 */
export async function saveNotionTokens(
  userId: string,
  values: {
    accessToken: string;
    refreshToken: string | null;
    expiresAt: Date | null;
    workspaceId: string | null;
    workspaceName: string | null;
  },
) {
  const workspaceChanged = values.workspaceId
    ? sql`${notionConnections.workspaceId} is distinct from ${values.workspaceId}`
    : sql`false`;
  await db
    .update(notionConnections)
    .set({
      accessToken: values.accessToken,
      refreshToken: values.refreshToken,
      expiresAt: values.expiresAt,
      workspaceId: sql`coalesce(${values.workspaceId}, ${notionConnections.workspaceId})`,
      workspaceName: sql`coalesce(${values.workspaceName}, ${notionConnections.workspaceName})`,
      connectedAt: sql`coalesce(${notionConnections.connectedAt}, now())`,
      databaseId: sql`case when ${workspaceChanged} then null else ${notionConnections.databaseId} end`,
      dataSourceId: sql`case when ${workspaceChanged} then null else ${notionConnections.dataSourceId} end`,
      refreshLockUntil: null,
    })
    .where(eq(notionConnections.userId, userId));
}

/**
 * 토큰 갱신 잠금을 잡는다. 잡으면 최신 행을, 다른 요청이 잡고 있으면 undefined를 돌려준다.
 * 잠금은 30초 뒤 저절로 풀린다(갱신 도중 프로세스가 죽어도 영원히 막히지 않도록).
 */
export async function acquireRefreshLock(userId: string) {
  const [row] = await db
    .update(notionConnections)
    .set({ refreshLockUntil: sql`now() + interval '30 seconds'` })
    .where(
      and(
        eq(notionConnections.userId, userId),
        isNotNull(notionConnections.refreshToken),
        or(
          isNull(notionConnections.refreshLockUntil),
          lt(notionConnections.refreshLockUntil, sql`now()`),
        ),
      ),
    )
    .returning();
  return row;
}

/** 갱신한 토큰을 저장하고 잠금을 푼다. 한 문장이라 새 access·refresh token이 함께 저장된다. */
export async function saveRefreshedTokens(
  userId: string,
  values: { accessToken: string; refreshToken: string; expiresAt: Date | null },
) {
  await db
    .update(notionConnections)
    .set({ ...values, refreshLockUntil: null })
    .where(eq(notionConnections.userId, userId));
}

export async function releaseRefreshLock(userId: string) {
  await db
    .update(notionConnections)
    .set({ refreshLockUntil: null })
    .where(eq(notionConnections.userId, userId));
}

/** invalid_grant 등으로 연결이 끊겼을 때 토큰만 지운다. clientId·databaseId·connectedAt은 남긴다. */
export async function clearNotionTokens(userId: string) {
  await db
    .update(notionConnections)
    .set({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      refreshLockUntil: null,
    })
    .where(eq(notionConnections.userId, userId));
}

/** 데이터베이스 생성 잠금(60초). 잡으면 최신 행을 돌려준다. */
export async function acquireDatabaseLock(userId: string) {
  const [row] = await db
    .update(notionConnections)
    .set({ databaseLockUntil: sql`now() + interval '60 seconds'` })
    .where(
      and(
        eq(notionConnections.userId, userId),
        or(
          isNull(notionConnections.databaseLockUntil),
          lt(notionConnections.databaseLockUntil, sql`now()`),
        ),
      ),
    )
    .returning();
  return row;
}

/** 만든 데이터베이스 ID를 저장하고 잠금을 푼다. 실패했으면 ids 없이 불러 잠금만 푼다. */
export async function finishDatabaseLock(
  userId: string,
  ids?: { databaseId: string; dataSourceId: string | null },
) {
  await db
    .update(notionConnections)
    .set({ ...(ids ?? {}), databaseLockUntil: null })
    .where(eq(notionConnections.userId, userId));
}

/** 데이터베이스가 지워졌을 때 ID를 비운다. 이미 다른 요청이 새 ID로 바꿨으면 건드리지 않는다. */
export async function clearNotionDatabase(userId: string, databaseId: string) {
  await db
    .update(notionConnections)
    .set({ databaseId: null, dataSourceId: null })
    .where(
      and(
        eq(notionConnections.userId, userId),
        eq(notionConnections.databaseId, databaseId),
      ),
    );
}

/** 노션에 저장할 기사 한 건. 이 사용자의 목록에 있는 기사만 고른다. */
export async function getArticleForNotion(userId: string, articleId: string) {
  const [row] = await db
    .select({
      articleId: articles.id,
      url: articles.url,
      source: articles.source,
      originalTitle: articles.originalTitle,
      originalDescription: articles.originalDescription,
      titleKo: articles.titleKo,
      summaryKo: articles.summaryKo,
      publishedAt: articles.publishedAt,
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
    .where(
      and(eq(userArticles.userId, userId), eq(userArticles.articleId, articleId)),
    )
    .limit(1);
  return row;
}

/**
 * 만든 노션 페이지 ID를 저장한다. 이미 값이 있으면(동시에 두 번 누른 경우) 바꾸지 않는다.
 * 저장했으면 true다.
 */
export async function saveNotionPageId(
  userId: string,
  articleId: string,
  pageId: string,
) {
  const updated = await db
    .update(userArticles)
    .set({ notionPageId: pageId })
    .where(
      and(
        eq(userArticles.userId, userId),
        eq(userArticles.articleId, articleId),
        isNull(userArticles.notionPageId),
      ),
    )
    .returning({ id: userArticles.id });
  return updated.length > 0;
}

export type NotionStatus = "connected" | "expired" | "not_connected";

/** 화면에 보여 줄 연결 상태. 토큰이 지워졌는데 한 번이라도 연결했던 적이 있으면 만료다. */
export async function getNotionStatus(userId: string): Promise<NotionStatus> {
  const connection = await getNotionConnection(userId);
  if (connection?.accessToken) return "connected";
  return connection?.connectedAt ? "expired" : "not_connected";
}
