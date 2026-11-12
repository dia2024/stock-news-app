import "server-only";
import {
  acquireDatabaseLock,
  clearNotionDatabase,
  finishDatabaseLock,
  getNotionConnection,
} from "@/db/notion-queries";
import {
  NOTION_DATABASE_TITLE,
  NOTION_PROPS as P,
  NOTION_SOURCE_OPTIONS,
} from "./config";
import { NotionToolError, withNotionMcp, type NotionMcp } from "./mcp";
import { NotionAuthRequiredError } from "./oauth";

// 노션 저장(PRD 6절 '노션 저장', '노션 데이터베이스')
// 도구 입력 형식은 노션 MCP의 tools/list 스키마를 따른다. 형식이 바뀌면 이 파일의 build* 함수만 고친다.

const UNCATEGORIZED = "미분류";
const SOURCE_COLORS: Record<string, string> = {
  Bloomberg: "purple",
  WSJ: "gray",
  "Investing.com": "blue",
};
const DATABASE_WAIT_MS = 30_000;

export type NotionArticle = {
  url: string;
  source: string;
  originalTitle: string;
  originalDescription: string | null;
  titleKo: string | null;
  summaryKo: string | null;
  publishedAt: Date | null;
  categoryName: string | null;
};

type DatabaseIds = { databaseId: string; dataSourceId: string | null };

/** 큰따옴표를 쓰지 않는 SQL DDL 식별자. 속성 이름은 config.ts 상수라 안전하지만 한 번 더 막는다. */
function quoteIdent(name: string) {
  return `"${name.replace(/"/g, "")}"`;
}

/** 노션 선택지 이름에는 쉼표를 쓸 수 없어 공백으로 바꾼다. */
function selectValue(value: string) {
  return value.replace(/,/g, " ").trim();
}

function quoteLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * notion-create-database 입력(tools/list로 확인, 2026-11-13).
 * schema는 SQL DDL: 열 이름은 큰따옴표, 선택지는 'opt':color 형식. parent를 빼면 개인 페이지 영역에 만든다.
 */
function buildCreateDatabaseArgs() {
  const sourceOptions = NOTION_SOURCE_OPTIONS.map(
    (name) => `${quoteLiteral(name)}:${SOURCE_COLORS[name] ?? "default"}`,
  ).join(", ");
  const columns = [
    `${quoteIdent(P.title)} TITLE`,
    `${quoteIdent(P.summary)} RICH_TEXT`,
    `${quoteIdent(P.source)} SELECT(${sourceOptions})`,
    // 사용자 카테고리 선택지는 처음 저장할 때 addSelectOption이 추가한다(노션은 없는 선택지를 받지 않는다).
    `${quoteIdent(P.category)} SELECT(${quoteLiteral(UNCATEGORIZED)}:gray)`,
    `${quoteIdent(P.url)} URL`,
    `${quoteIdent(P.publishedAt)} DATE`,
    `${quoteIdent(P.savedAt)} CREATED_TIME`,
  ];
  return {
    title: NOTION_DATABASE_TITLE,
    schema: `CREATE TABLE (${columns.join(", ")})`,
  };
}

/** 노션 페이지·데이터베이스·데이터 소스 ID(UUID, 하이픈 유무 무관)를 표준 형식으로 */
function normalizeId(raw: string) {
  const hex = raw.replace(/-/g, "").toLowerCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID = "[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}";
/** 노션 페이지·데이터베이스 주소(app.notion.com/p/<ID>, 예전 www.notion.so/<제목>-<ID>) 끝의 ID */
const NOTION_URL_ID = new RegExp(
  `notion\\.(?:so|com)/[^\\s"'<>{}]*?(${UUID})(?![0-9a-f])`,
  "i",
);

/**
 * notion-create-database 결과 텍스트에서 데이터베이스 ID와 데이터 소스 ID를 찾는다.
 * 결과에는 <database url="{{https://app.notion.com/p/<32자리 ID>}}">와
 * <data-source url="{{collection://<UUID>}}">가 들어 있다(2026-11-13 확인). 예전 주소 형식 notion.so도 받는다.
 */
export function parseCreatedDatabase(text: string): DatabaseIds {
  const dataSource = text.match(new RegExp(`collection://(${UUID})`, "i"));
  const database =
    text.match(NOTION_URL_ID) ??
    text.match(new RegExp(`"(?:database_)?id"\\s*:\\s*"(${UUID})"`, "i"));
  if (!database) {
    throw new Error(`데이터베이스 ID를 찾지 못했습니다: ${text.slice(0, 300)}`);
  }
  return {
    databaseId: normalizeId(database[1]),
    dataSourceId: dataSource ? normalizeId(dataSource[1]) : null,
  };
}

/**
 * notion-create-pages 입력(tools/list로 확인, 2026-11-13).
 * - 부모는 데이터 소스(collection://의 ID)가 원칙이다. 데이터 소스 ID를 못 얻었을 때만 database_id를 쓴다.
 * - 날짜는 date:{속성}:start / date:{속성}:is_datetime(0 또는 1)으로 나눠 넣는다.
 * - 속성 이름이 'id'·'url'이면 userDefined: 접두어가 필요하지만 '원문 링크'는 해당하지 않는다.
 * - allow_async를 넣지 않아 결과를 바로(동기) 받는다.
 */
function buildCreatePagesArgs(ids: DatabaseIds, article: NotionArticle) {
  const title = article.titleKo ?? article.originalTitle;
  const summary = article.summaryKo ?? article.originalDescription ?? "";
  const properties: Record<string, string | number> = {
    [P.title]: title,
    [P.summary]: summary,
    [P.source]: selectValue(article.source),
    [P.category]: selectValue(article.categoryName ?? UNCATEGORIZED),
    [P.url]: article.url,
  };
  if (article.publishedAt) {
    properties[`date:${P.publishedAt}:start`] = article.publishedAt.toISOString();
    properties[`date:${P.publishedAt}:is_datetime`] = 1;
  }
  // 본문에도 요약과 원문 링크를 넣어, 페이지를 열었을 때 바로 읽을 수 있게 한다.
  const content = [summary, `[원문 보기](${article.url})`]
    .filter(Boolean)
    .join("\n\n");

  return {
    parent: ids.dataSourceId
      ? { data_source_id: ids.dataSourceId }
      : { database_id: ids.databaseId },
    pages: [{ properties, content }],
  };
}

/** notion-create-pages 결과에서 만든 페이지 ID를 찾는다. */
export function parseCreatedPageId(text: string) {
  try {
    const json = JSON.parse(text) as { pages?: { id?: string }[] };
    const id = json.pages?.[0]?.id;
    if (id) return normalizeId(id);
  } catch {
    // JSON이 아니면 아래에서 텍스트로 찾는다.
  }
  const match =
    text.match(new RegExp(`"id"\\s*:\\s*"(${UUID})"`, "i")) ??
    text.match(NOTION_URL_ID);
  if (!match) throw new Error(`페이지 ID를 찾지 못했습니다: ${text.slice(0, 300)}`);
  return normalizeId(match[1]);
}

/** 데이터베이스(또는 부모)를 찾을 수 없다는 오류인지. 지워졌거나 휴지통에 있거나 다른 워크스페이스다. */
function isMissingParent(error: unknown) {
  return (
    error instanceof NotionToolError &&
    // 속성 이름 오류 같은 다른 실패로 데이터베이스를 새로 만들지 않도록 부모를 가리키는 문구만 본다.
    /object_not_found|(?:database|data source|data_source|parent)[^.\n]{0,40}(?:not found|could not be found|does not exist|archived|in trash)|could not find (?:the )?(?:database|data source|parent)/i.test(
      error.text,
    )
  );
}

/**
 * 이 사용자의 '해외 주식 뉴스' 데이터베이스 ID를 돌려준다. 없으면 만든다.
 * 같은 사용자가 동시에 여러 건을 저장해도 하나만 만들도록 databaseLockUntil로 직렬화한다.
 */
async function ensureDatabase(userId: string, mcp: NotionMcp): Promise<DatabaseIds> {
  const deadline = Date.now() + DATABASE_WAIT_MS;
  for (;;) {
    const connection = await getNotionConnection(userId);
    if (!connection) throw new NotionAuthRequiredError("not_connected");
    if (connection.databaseId) {
      return { databaseId: connection.databaseId, dataSourceId: connection.dataSourceId };
    }

    const locked = await acquireDatabaseLock(userId);
    if (locked) {
      // 잠금을 잡는 사이에 다른 요청이 만들었을 수 있다.
      if (locked.databaseId) {
        await finishDatabaseLock(userId);
        return { databaseId: locked.databaseId, dataSourceId: locked.dataSourceId };
      }
      try {
        const text = await mcp.callTool("notion-create-database", buildCreateDatabaseArgs());
        const ids = parseCreatedDatabase(text);
        await finishDatabaseLock(userId, ids);
        return ids;
      } catch (error) {
        await finishDatabaseLock(userId).catch(() => {});
        throw error;
      }
    }

    if (Date.now() > deadline) {
      throw new Error("노션 데이터베이스 생성을 기다리다 시간이 초과되었습니다.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

/** 데이터베이스 잠금(databaseLockUntil)을 잡고 fn을 실행한다. 다른 요청이 잡고 있으면 풀릴 때까지 기다린다. */
async function withDatabaseLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + DATABASE_WAIT_MS;
  while (!(await acquireDatabaseLock(userId))) {
    if (Date.now() > deadline) {
      throw new Error("노션 데이터베이스 잠금을 기다리다 시간이 초과되었습니다.");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  try {
    return await fn();
  } finally {
    await finishDatabaseLock(userId).catch(() => {});
  }
}

/**
 * 노션이 '없는 선택지'로 거부한 오류에서 속성 이름과 값을 꺼낸다(2026-11-13 확인).
 * 예: Invalid select value for property "카테고리": "기술주". ... the data source must be updated to add it.
 * 오류 텍스트는 JSON 안에 들어 있어 따옴표 앞에 역슬래시가 붙을 수 있다.
 */
export function parseInvalidSelect(error: unknown) {
  if (!(error instanceof NotionToolError)) return null;
  const match = error.text.match(
    /Invalid select value for property \\*"([^"\\]+)\\*": \\*"([^"\\]+)\\*"/,
  );
  return match ? { property: match[1], value: match[2] } : null;
}

type SelectOption = { name: string; color?: string };

/** notion-fetch(collection://) 결과의 <data-source-state> JSON에서 선택 속성의 현재 선택지를 읽는다. */
export function parseSelectOptions(fetched: string, property: string): SelectOption[] {
  let text = fetched;
  try {
    const json = JSON.parse(fetched) as { text?: unknown };
    if (typeof json.text === "string") text = json.text;
  } catch {
    // JSON이 아니면 그대로 찾는다.
  }
  const state = text.match(/<data-source-state>\s*([\s\S]*?)\s*<\/data-source-state>/);
  if (!state) throw new Error("데이터 소스 상태를 읽지 못했습니다.");
  const parsed = JSON.parse(state[1]) as {
    schema?: Record<string, { type?: string; options?: SelectOption[] }>;
  };
  const prop = parsed.schema?.[property];
  if (prop?.type !== "select" || !Array.isArray(prop.options)) {
    throw new Error(`'${property}' 선택 속성을 찾지 못했습니다.`);
  }
  return prop.options;
}

/**
 * 선택 속성에 선택지를 하나 추가한다. 노션은 없는 선택지 값을 받지 않는다.
 * ALTER COLUMN ... SET SELECT는 적지 않은 선택지를 지우므로, 현재 선택지를 모두 읽어 함께 적는다.
 * 두 요청이 동시에 서로 다른 선택지를 추가하다 한쪽이 지워지지 않도록 데이터베이스 잠금으로 직렬화한다.
 */
async function addSelectOption(
  userId: string,
  mcp: NotionMcp,
  ids: DatabaseIds,
  property: string,
  value: string,
) {
  const dataSource = ids.dataSourceId ?? ids.databaseId;
  await withDatabaseLock(userId, async () => {
    const fetched = await mcp.callTool("notion-fetch", {
      id: ids.dataSourceId ? `collection://${ids.dataSourceId}` : ids.databaseId,
    });
    const options = parseSelectOptions(fetched, property);
    // 기다리는 사이 다른 요청이 이미 추가했을 수 있다.
    if (options.some((o) => o.name === value)) return;
    const list = [...options, { name: value, color: "default" }]
      .map((o) => `${quoteLiteral(o.name)}:${o.color || "default"}`)
      .join(", ");
    await mcp.callTool("notion-update-data-source", {
      data_source_id: dataSource,
      statements: `ALTER COLUMN ${quoteIdent(property)} SET SELECT(${list})`,
    });
  });
}

/** 앱이 값을 넣는 선택 속성. 사용자가 노션에서 만든 다른 속성은 건드리지 않는다. */
const OWN_SELECT_PROPS: string[] = [P.category, P.source];

/**
 * 기사를 노션 데이터베이스에 한 행으로 추가하고 페이지 ID를 돌려준다.
 * - 데이터베이스를 찾을 수 없으면 ID를 비우고 한 번만 새로 만들어 다시 저장한다.
 * - 카테고리·출처 값이 아직 선택지에 없으면 선택지를 추가하고 다시 저장한다.
 */
export async function saveArticleToNotion(userId: string, article: NotionArticle) {
  return withNotionMcp(userId, async (mcp) => {
    let ids = await ensureDatabase(userId, mcp);
    let recreated = false;
    const added = new Set<string>();

    for (;;) {
      try {
        const text = await mcp.callTool("notion-create-pages", buildCreatePagesArgs(ids, article));
        return parseCreatedPageId(text);
      } catch (error) {
        const invalid = parseInvalidSelect(error);
        const key = invalid && `${invalid.property}\u0000${invalid.value}`;
        if (invalid && key && OWN_SELECT_PROPS.includes(invalid.property) && !added.has(key)) {
          added.add(key);
          await addSelectOption(userId, mcp, ids, invalid.property, invalid.value);
          continue;
        }
        if (!recreated && isMissingParent(error)) {
          recreated = true;
          await clearNotionDatabase(userId, ids.databaseId);
          ids = await ensureDatabase(userId, mcp);
          continue;
        }
        throw error;
      }
    }
  });
}
