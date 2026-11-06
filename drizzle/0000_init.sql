CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"source" text NOT NULL,
	"original_title" text NOT NULL,
	"original_description" text,
	"title_ko" text NOT NULL,
	"summary_ko" text NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_userId_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "notion_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"workspace_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"article_id" uuid NOT NULL,
	"category_id" uuid,
	"notion_page_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_articles_userId_articleId_unique" UNIQUE("user_id","article_id")
);
--> statement-breakpoint
ALTER TABLE "user_articles" ADD CONSTRAINT "user_articles_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_articles" ADD CONSTRAINT "user_articles_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_published_at_index" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "user_articles_user_id_category_id_index" ON "user_articles" USING btree ("user_id","category_id");