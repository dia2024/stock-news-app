import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

// ui.md 4절 헤더
export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/dashboard"
          className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
        >
          Stock 뉴스 수집기
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/categories"
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            카테고리 관리
          </Link>
          <UserButton />
        </nav>
      </div>
    </header>
  );
}
