import { UserButton } from "@clerk/nextjs";

// 로그인한 사용자만 들어올 수 있다(src/proxy.ts에서 보호).
// 뉴스 목록 화면은 이후 단계에서 채운다.
export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/15">
        <h1 className="text-lg font-semibold">AI 뉴스 수집기</h1>
        <UserButton />
      </header>
      <main className="flex flex-1 items-center justify-center p-4 text-zinc-500">
        뉴스 목록은 준비 중입니다.
      </main>
    </div>
  );
}
