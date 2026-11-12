ALTER TABLE "user_articles" ADD COLUMN "classified_at" timestamp with time zone;--> statement-breakpoint
-- 이미 시드한 예제 기사는 번역·분류가 끝난 상태라 Claude 처리 대상에서 뺀다.
UPDATE "user_articles" SET "classified_at" = now() WHERE "article_id" IN (SELECT "id" FROM "articles" WHERE "url" LIKE 'https://example.com/sample/%');
