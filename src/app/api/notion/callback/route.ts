import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { OAUTH_COOKIE } from "@/lib/notion/config";
import { decrypt } from "@/lib/notion/crypto";
import { completeNotionAuthorization } from "@/lib/notion/oauth";

const cookieSchema = z.object({
  state: z.string().min(1),
  codeVerifier: z.string().min(1),
  userId: z.string().min(1),
});

function readCookie(value: string | undefined) {
  if (!value) return null;
  try {
    return cookieSchema.parse(JSON.parse(decrypt(value)));
  } catch {
    return null;
  }
}

function sameString(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * 노션 OAuth 콜백. state를 확인하고 인가 코드를 토큰으로 바꿔 암호화해 저장한 뒤 대시보드로 돌려보낸다.
 * 결과는 ?notion=connected|denied|error 로 대시보드에 알린다.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const params = request.nextUrl.searchParams;
  const saved = readCookie(request.cookies.get(OAUTH_COOKIE)?.value);

  let result: "connected" | "denied" | "error" = "error";
  if (params.get("error")) {
    // 사용자가 노션 화면에서 취소했다.
    result = params.get("error") === "access_denied" ? "denied" : "error";
  } else {
    const code = params.get("code");
    const state = params.get("state");
    if (
      code &&
      state &&
      saved &&
      saved.userId === userId &&
      sameString(saved.state, state)
    ) {
      try {
        await completeNotionAuthorization(userId, code, saved.codeVerifier);
        result = "connected";
      } catch (error) {
        console.error("[notion/callback] 토큰 교환 실패", error);
      }
    } else {
      console.warn("[notion/callback] state 또는 쿠키가 맞지 않습니다.");
    }
  }

  const response = NextResponse.redirect(
    new URL(`/dashboard?notion=${result}`, request.url),
  );
  // verifier와 state는 한 번만 쓴다.
  response.cookies.delete({ name: OAUTH_COOKIE, path: "/api/notion" });
  return response;
}
