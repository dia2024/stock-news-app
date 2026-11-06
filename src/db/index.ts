import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다.");
}

// Neon HTTP 드라이버: 쿼리마다 HTTP 요청 한 번이라 Vercel 서버리스 함수에 맞다.
// 대화형 트랜잭션(db.transaction)은 지원하지 않는다. 여러 쿼리를 함께 처리할 때는 db.batch()를 쓴다.
const sql = neon(process.env.DATABASE_URL);

export const db = drizzle({
  client: sql,
  schema,
  // drizzle.config.ts와 같은 값이어야 한다.
  casing: "snake_case",
});
