import "server-only";
import {
  discoverOAuthServerInfo,
  exchangeAuthorization,
  refreshAuthorization,
  registerClient,
  startAuthorization,
  type OAuthServerInfo,
} from "@modelcontextprotocol/sdk/client/auth.js";
import { InvalidGrantError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import {
  acquireRefreshLock,
  clearNotionTokens,
  getNotionConnection,
  releaseRefreshLock,
  saveNotionClientId,
  saveNotionTokens,
  saveRefreshedTokens,
} from "@/db/notion-queries";
import { NOTION_MCP_URL, notionRedirectUri } from "./config";
import { decrypt, encrypt } from "./crypto";

// 노션 MCP OAuth 2.1 (PRD 6절 '노션 연결', '토큰 관리')
// 메타데이터 탐색 → 동적 클라이언트 등록 → PKCE(S256) 인가 → 토큰 교환·갱신

/** 노션 연결이 없거나 만료되어 사용자가 (다시) 연결해야 한다. */
export class NotionAuthRequiredError extends Error {
  constructor(readonly reason: "not_connected" | "expired") {
    super(reason === "expired" ? "노션 연결이 만료되었습니다." : "노션이 연결되지 않았습니다.");
    this.name = "NotionAuthRequiredError";
  }
}

// 만료 이 시간 전부터 미리 갱신한다(PRD: 5~10분 전).
const REFRESH_MARGIN_MS = 10 * 60 * 1000;
// 다른 요청이 갱신 중일 때 기다리는 최대 시간
const REFRESH_WAIT_MS = 15_000;

// 메타데이터는 거의 바뀌지 않으므로 프로세스 안에서 1시간 재사용한다.
let serverInfoCache: { info: OAuthServerInfo; at: number } | undefined;

async function getServerInfo() {
  if (serverInfoCache && Date.now() - serverInfoCache.at < 60 * 60 * 1000) {
    return serverInfoCache.info;
  }
  const info = await discoverOAuthServerInfo(NOTION_MCP_URL);
  if (!info.authorizationServerMetadata) {
    throw new Error("노션 인가 서버 메타데이터를 찾지 못했습니다.");
  }
  serverInfoCache = { info, at: Date.now() };
  return info;
}

/** RFC 8707 resource 값. 보호 리소스 메타데이터의 문자열을 그대로 쓴다. */
function resourceOf(info: OAuthServerInfo) {
  return info.resourceMetadata?.resource;
}

/**
 * 노션 인가 페이지 주소를 만든다. clientId가 없으면 동적 등록하고 저장한다.
 * 돌려준 codeVerifier와 state는 호출하는 쪽이 쿠키에 보관한다.
 */
export async function beginNotionAuthorization(userId: string, state: string) {
  const info = await getServerInfo();
  const redirectUri = notionRedirectUri();

  let clientId = (await getNotionConnection(userId))?.clientId;
  if (!clientId) {
    const client = await registerClient(info.authorizationServerUrl, {
      metadata: info.authorizationServerMetadata,
      clientMetadata: {
        client_name: "Stock 뉴스 수집기",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
    });
    clientId = client.client_id;
    await saveNotionClientId(userId, clientId);
  }

  const { authorizationUrl, codeVerifier } = await startAuthorization(
    info.authorizationServerUrl,
    {
      metadata: info.authorizationServerMetadata,
      clientInformation: { client_id: clientId },
      redirectUrl: redirectUri,
      state,
      resource: resourceOf(info),
    },
  );
  return { authorizationUrl, codeVerifier };
}

/**
 * 인가 코드를 토큰으로 바꿔 암호화해 저장한다.
 * 토큰 응답에 들어 있는 워크스페이스 정보(SDK 스키마는 버린다)를 읽으려고 응답을 한 번 복제해 본다.
 */
export async function completeNotionAuthorization(
  userId: string,
  code: string,
  codeVerifier: string,
) {
  const connection = await getNotionConnection(userId);
  if (!connection) throw new Error("노션 클라이언트 등록 정보가 없습니다.");
  const info = await getServerInfo();

  let raw: Record<string, unknown> = {};
  const tokens = await exchangeAuthorization(info.authorizationServerUrl, {
    metadata: info.authorizationServerMetadata,
    clientInformation: { client_id: connection.clientId },
    authorizationCode: code,
    codeVerifier,
    redirectUri: notionRedirectUri(),
    resource: resourceOf(info),
    fetchFn: async (input, init) => {
      const response = await fetch(input, init);
      if (response.ok) {
        raw = await response
          .clone()
          .json()
          .catch(() => ({}));
      }
      return response;
    },
  });

  await saveNotionTokens(userId, {
    accessToken: encrypt(tokens.access_token),
    refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
    expiresAt: expiresAtOf(tokens.expires_in),
    workspaceId: stringField(raw, "workspace_id"),
    workspaceName: stringField(raw, "workspace_name"),
  });
}

function expiresAtOf(expiresIn: number | undefined) {
  return expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
}

function stringField(obj: Record<string, unknown>, key: string) {
  const value = obj[key];
  return typeof value === "string" && value ? value : null;
}

function isFresh(expiresAt: Date | null) {
  // 만료 시각을 모르면 쓸 수 있다고 보고, 401이 나면 그때 갱신한다.
  return !expiresAt || expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS;
}

/**
 * 쓸 수 있는 액세스 토큰을 돌려준다. 만료가 가까우면 갱신한다.
 * forceRefresh는 MCP 서버가 401을 돌려줬을 때 쓴다.
 * 연결이 없거나 refresh token이 거부되면 NotionAuthRequiredError를 던진다.
 */
export async function getNotionAccessToken(
  userId: string,
  { forceRefresh = false } = {},
): Promise<string> {
  const connection = await getNotionConnection(userId);
  if (!connection?.accessToken) {
    throw new NotionAuthRequiredError(
      connection?.connectedAt ? "expired" : "not_connected",
    );
  }
  if (!forceRefresh && isFresh(connection.expiresAt)) {
    return decrypt(connection.accessToken);
  }
  return refreshNotionToken(userId, connection.accessToken);
}

/**
 * 갱신은 연결별로 직렬화한다. refresh token은 한 번 쓰면 바뀌므로(rotation)
 * 두 요청이 같은 refresh token으로 동시에 갱신하면 한쪽이 invalid_grant를 받는다.
 * staleAccessToken은 갱신이 필요하다고 판단한 시점의 토큰(암호문)이다. 그 사이 다른 요청이 갱신했으면 그 결과를 쓴다.
 */
async function refreshNotionToken(
  userId: string,
  staleAccessToken: string,
): Promise<string> {
  const deadline = Date.now() + REFRESH_WAIT_MS;

  for (;;) {
    const locked = await acquireRefreshLock(userId);
    if (locked) {
      // 잠금을 잡기 전에 다른 요청이 갱신을 끝냈으면 그 토큰을 쓴다.
      if (locked.accessToken && locked.accessToken !== staleAccessToken) {
        await releaseRefreshLock(userId);
        return decrypt(locked.accessToken);
      }
      return refreshWithLock(userId, locked.clientId, locked.refreshToken!);
    }

    // 다른 요청이 갱신 중이다. 결과를 기다린다.
    const current = await getNotionConnection(userId);
    if (!current?.refreshToken) {
      throw new NotionAuthRequiredError(current?.connectedAt ? "expired" : "not_connected");
    }
    if (current.accessToken && current.accessToken !== staleAccessToken) {
      return decrypt(current.accessToken);
    }
    if (Date.now() > deadline) {
      throw new Error("노션 토큰 갱신을 기다리다 시간이 초과되었습니다.");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function refreshWithLock(
  userId: string,
  clientId: string,
  encryptedRefreshToken: string,
) {
  try {
    const info = await getServerInfo();
    const tokens = await refreshAuthorization(info.authorizationServerUrl, {
      metadata: info.authorizationServerMetadata,
      clientInformation: { client_id: clientId },
      refreshToken: decrypt(encryptedRefreshToken),
      resource: resourceOf(info),
    });
    // 새 refresh token을 받으면 반드시 함께 저장한다(이전 것은 이미 무효다).
    // 새 값이 없으면 SDK가 이전 값을 그대로 돌려준다.
    await saveRefreshedTokens(userId, {
      accessToken: encrypt(tokens.access_token),
      refreshToken: tokens.refresh_token
        ? encrypt(tokens.refresh_token)
        : encryptedRefreshToken,
      expiresAt: expiresAtOf(tokens.expires_in),
    });
    return tokens.access_token;
  } catch (error) {
    if (error instanceof InvalidGrantError) {
      // refresh token 만료·폐기. 재시도하지 않고 재연결을 안내한다.
      await clearNotionTokens(userId);
      throw new NotionAuthRequiredError("expired");
    }
    await releaseRefreshLock(userId).catch(() => {});
    throw error;
  }
}
