ALTER TABLE "notion_connections" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "notion_connections" ADD COLUMN "connected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notion_connections" ADD COLUMN "database_id" text;--> statement-breakpoint
ALTER TABLE "notion_connections" ADD COLUMN "data_source_id" text;--> statement-breakpoint
ALTER TABLE "notion_connections" ADD COLUMN "refresh_lock_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notion_connections" ADD COLUMN "database_lock_until" timestamp with time zone;