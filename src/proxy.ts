import { clerkMiddleware } from "@clerk/nextjs/server";

// 로그인 없이 접근할 수 있는 경로. 그 밖의 모든 경로는 로그인이 필요하다.
// Clerk의 createRouteMatcher는 deprecated라서 경로를 직접 비교한다.
// 이 검사는 1차 방어선일 뿐이다. 데이터를 다루는 페이지·API·Server Function은
// 각자 auth()로 userId를 다시 확인해야 한다.
const PUBLIC_PATHS = ["/sign-in", "/sign-up"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicPath(request.nextUrl.pathname)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Next.js 내부 파일과 정적 파일은 건너뛴다(검색 파라미터에 있으면 제외하지 않음).
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // API 라우트는 항상 실행한다.
    "/(api|trpc)(.*)",
  ],
};
