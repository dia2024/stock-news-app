import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// 컬럼 이름은 casing: "snake_case" 설정으로 자동 변환된다(userId → user_id).
// userId는 Clerk 사용자 ID(user_...)다. Clerk에 사용자 테이블이 있으므로 여기서는 FK를 두지 않는다.

const createdAt = () =>
  timestamp({ withTimezone: true }).notNull().defaultNow();

/**
 * 기사 원문과 번역. 모든 사용자가 공유한다.
 * 수집 때는 원문만 저장하고, 번역·요약은 기사당 한 번만 해서 titleKo·summaryKo를 채운다.
 * titleKo가 null이면 아직 번역하지 않은 기사이며, 번역에 실패하면 null로 남아 다음에 다시 시도된다.
 */
export const articles = pgTable(
  "articles",
  {
    id: uuid().primaryKey().defaultRandom(),
    // 중복 판정 키
    url: text().notNull().unique(),
    // 피드 설정의 출처 이름(예: Bloomberg, WSJ). 피드 목록이 설정 파일로 바뀔 수 있어 enum으로 두지 않는다.
    source: text().notNull(),
    originalTitle: text().notNull(),
    originalDescription: text(),
    // null = 아직 번역하지 않음
    titleKo: text(),
    summaryKo: text(),
    publishedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.publishedAt)],
);

/** 사용자별 카테고리. '미분류'는 행이 아니라 user_articles.categoryId = null로 표현한다. */
export const categories = pgTable(
  "categories",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text().notNull(),
    name: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.userId, t.name)],
);

/** 사용자별 기사 목록과 분류 결과, 노션 저장 여부. */
export const userArticles = pgTable(
  "user_articles",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text().notNull(),
    articleId: uuid()
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    // null = 미분류. 카테고리를 삭제하면 DB가 자동으로 null로 바꾼다.
    categoryId: uuid().references(() => categories.id, {
      onDelete: "set null",
    }),
    // 노션에 저장한 페이지 ID. 값이 있으면 '저장됨'이고 다시 저장하지 않는다.
    notionPageId: text(),
    // Claude 분류를 마친 시각. null = 아직 분류 전(처리 대상).
    // categoryId = null만으로는 '미분류'와 '아직 처리 안 함'을 구분할 수 없어 따로 둔다.
    classifiedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.userId, t.articleId),
    index().on(t.userId, t.categoryId),
  ],
);

/**
 * 앱을 처음 쓴 사용자 기록. 사용자당 한 행이다.
 * 이 행을 처음 넣을 때만 기본 카테고리를 만든다. 그래서 사용자가 카테고리를 모두 지워도 다시 생기지 않는다.
 */
export const userProfiles = pgTable("user_profiles", {
  userId: text().primaryKey(),
  createdAt: createdAt(),
});

/**
 * 사용자별 노션 OAuth 연결. 사용자당 한 행이다.
 * clientId는 동적 클라이언트 등록 결과로, 토큰보다 먼저 저장되고 재연결할 때 재사용한다.
 * 토큰은 TOKEN_ENCRYPTION_KEY로 암호화한 값만 저장한다.
 * 갱신이 invalid_grant로 실패하면 토큰 컬럼만 null로 지우고 재연결을 안내한다.
 */
export const notionConnections = pgTable("notion_connections", {
  userId: text().primaryKey(),
  clientId: text().notNull(),
  accessToken: text(),
  refreshToken: text(),
  expiresAt: timestamp({ withTimezone: true }),
  workspaceName: text(),
  createdAt: createdAt(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type UserArticle = typeof userArticles.$inferSelect;
export type NotionConnection = typeof notionConnections.$inferSelect;
