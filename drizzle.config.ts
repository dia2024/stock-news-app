import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit은 Next.js 밖에서 실행되므로 .env.local을 직접 읽는다.
config({ path: ".env.local", quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL이 .env.local에 없습니다.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // TypeScript의 camelCase 필드를 DB에서는 snake_case 컬럼으로 만든다. src/db/index.ts와 같아야 한다.
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
