import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { OAUTH_COOKIE, OAUTH_COOKIE_MAX_AGE } from "@/lib/notion/config";
import { encrypt } from "@/lib/notion/crypto";
import { beginNotionAuthorization } from "@/lib/notion/oauth";

/**
 * 노션 연결 시작(PRD 6절 '노션 연결').
 * 동적 클라이언트 등록(처음 한 번) 뒤 PKCE·state를 만들어 쿠키에 보관하고 노션 인가 페이지로 보낸다.
 */
export async function GET(request: NextRequest) {
  // proxy.ts의 검사와 별개로 직접 확인한다.
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  try {
    const state = randomBytes(24).toString("base64url");
    const { authorizationUrl, codeVerifier } = await beginNotionAuthorization(
      userId,
      state,
    );

    const response = NextResponse.redirect(authorizationUrl);
    // 쿠키 값은 암호화해 변조와 열람을 막는다. 콜백에서 userId도 함께 확인한다.
    response.cookies.set(
      OAUTH_COOKIE,
      encrypt(JSON.stringify({ state, codeVerifier, userId })),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        // 노션에서 돌아오는 최상위 GET 이동에도 쿠키가 실리도록 lax로 둔다.
        sameSite: "lax",
        path: "/api/notion",
        maxAge: OAUTH_COOKIE_MAX_AGE,
      },
    );
    return response;
  } catch (error) {
    console.error("[notion/connect] 노션 연결 시작 실패", error);
    return NextResponse.redirect(new URL("/?notion=error", request.url));
  }
}
