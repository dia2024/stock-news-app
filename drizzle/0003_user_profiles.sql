CREATE TABLE "user_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- 이미 카테고리가 있는 사용자는 기본 카테고리를 다시 만들지 않도록 처음 온 기록을 미리 넣는다.
INSERT INTO "user_profiles" ("user_id") SELECT DISTINCT "user_id" FROM "categories" ON CONFLICT DO NOTHING;
