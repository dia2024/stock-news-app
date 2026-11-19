// ui.md 4절 푸터. 페이지 맨 아래(mt-auto)에 붙고, 문구는 화면 가운데에 둔다.
// 연도는 고정 문자열이다. new Date()를 쓰면 Cache Components에서 정적 셸에 넣을 수 없다.
export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-200 dark:border-zinc-800">
      <p className="px-4 py-6 text-center text-xs text-zinc-500 sm:px-6 dark:text-zinc-400">
        Copyright 2026 Stock 뉴스 수집기. Powered by Claude
      </p>
    </footer>
  );
}
