import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { NOTION_MCP_URL } from "./config";
import { getNotionAccessToken } from "./oauth";

/** MCP 도구가 isError로 실패를 돌려줬다. text는 노션이 준 오류 문구다. */
export class NotionToolError extends Error {
  constructor(
    readonly tool: string,
    readonly text: string,
  ) {
    super(`노션 도구 ${tool} 실패: ${text.slice(0, 500)}`);
    this.name = "NotionToolError";
  }
}

export type NotionMcp = {
  /** 도구를 호출하고 결과의 텍스트 내용을 이어 붙여 돌려준다. isError면 NotionToolError를 던진다. */
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
};

async function connect(accessToken: string) {
  const client = new Client({ name: "stock-news-collector", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(NOTION_MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  await client.connect(transport);
  return client;
}

function isUnauthorized(error: unknown) {
  return error instanceof StreamableHTTPError && error.code === 401;
}

/**
 * 사용자의 토큰으로 노션 MCP에 접속해 fn을 실행하고 연결을 닫는다.
 * 접속이 401이면 토큰을 강제로 갱신해 한 번만 다시 접속한다(만료 시각보다 일찍 무효가 된 경우).
 * 연결이 없거나 만료되면 getNotionAccessToken이 NotionAuthRequiredError를 던진다.
 */
export async function withNotionMcp<T>(
  userId: string,
  fn: (mcp: NotionMcp) => Promise<T>,
): Promise<T> {
  let client: Client;
  try {
    client = await connect(await getNotionAccessToken(userId));
  } catch (error) {
    if (!isUnauthorized(error)) throw error;
    client = await connect(
      await getNotionAccessToken(userId, { forceRefresh: true }),
    );
  }

  try {
    return await fn({
      async callTool(name, args) {
        const result = await client.callTool({ name, arguments: args });
        const text = (Array.isArray(result.content) ? result.content : [])
          .map((part) => (part.type === "text" ? part.text : ""))
          .join("\n");
        if (result.isError) throw new NotionToolError(name, text);
        return text;
      },
    });
  } finally {
    await client.close().catch(() => {});
  }
}
