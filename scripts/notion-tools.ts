/**
 * 개발용: 노션 MCP 도구 목록과 입력 스키마를 출력한다. 사용법: npx tsx scripts/notion-tools.ts <Clerk userId> [도구 이름...]
 *
 * 저장된 액세스 토큰을 복호화해 tools/list만 호출한다. 토큰을 갱신하지 않으므로(refresh token rotation과 겹치지 않도록)
 * 액세스 토큰이 만료되었으면 앱에서 노션 저장을 한 번 하거나 다시 연결한 뒤 실행한다.
 * 도구 이름을 주면 그 도구의 입력 스키마와 설명 전체를, 없으면 이름 목록만 출력한다. 토큰은 출력하지 않는다.
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { notionConnections } from "../src/db/schema";
import { decrypt } from "../src/lib/notion/crypto";
import { NOTION_MCP_URL } from "../src/lib/notion/config";

config({ path: ".env.local", quiet: true });

const [userId, ...toolNames] = process.argv.slice(2);
if (!userId?.startsWith("user_")) {
  console.error("사용법: npx tsx scripts/notion-tools.ts <Clerk userId(user_...)> [도구 이름...]");
  process.exit(1);
}

async function main() {
  const db = drizzle({ client: neon(process.env.DATABASE_URL!), casing: "snake_case" });
  const [row] = await db
    .select()
    .from(notionConnections)
    .where(eq(notionConnections.userId, userId));
  if (!row?.accessToken) {
    console.error("이 사용자는 노션에 연결되어 있지 않습니다.");
    process.exit(1);
  }
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    console.error("액세스 토큰이 만료되었습니다. 앱에서 노션 저장을 한 번 하거나 다시 연결하세요.");
    process.exit(1);
  }

  const client = new Client({ name: "stock-news-collector-dev", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(NOTION_MCP_URL), {
      requestInit: {
        headers: { Authorization: `Bearer ${decrypt(row.accessToken)}` },
      },
    }),
  );
  const { tools } = await client.listTools();
  if (toolNames.length === 0) {
    console.log(tools.map((t) => t.name).join("\n"));
  } else {
    for (const tool of tools.filter((t) => toolNames.includes(t.name))) {
      console.log(`## ${tool.name}\n\n${tool.description ?? ""}\n`);
      console.log(JSON.stringify(tool.inputSchema, null, 2));
      console.log();
    }
  }
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
