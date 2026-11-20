"use client";

// 첫 화면을 그리기 전에 실행할 인라인 스크립트(Next.js 문서 preventing-flash-before-hydration.md).
// 서버 HTML에서는 text/javascript로 실행되고, 브라우저 렌더링에서는 text/plain으로 그려
// React의 '<script> 태그를 만났다' 개발 경고를 피한다. type 차이는 suppressHydrationWarning으로 넘긴다.
// 서버 컴포넌트에서는 typeof window가 늘 undefined라 브라우저 쪽 분기가 동작하지 않으므로 클라이언트 컴포넌트로 둔다.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
